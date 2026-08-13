import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CatalogImportRowStatus, CatalogImportSessionStatus, Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { Decimal } from '@prisma/client/runtime/library';
import { mkdir, writeFile } from 'fs/promises';
import { join, sep } from 'path';
import { parseCsvBuffer } from './parsing';
import { mapCatalogRow, mapCatalogRows, CatalogMappingProfile, MappedCatalogRow } from './mapping';
import { RAKIZA_CSV_PROFILE } from './profiles/rakiza.profile';
import { ValidationMatchingService, ClassifiedCatalogRow } from './matching';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriesService } from '../categories/categories.service';
import { ParsedCsvRow } from './parsing/csv.types';
import { ProductSkuService } from '../products/product-sku.service';
import { ProductReviewAuditService } from '../products/product-review-audit.service';

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const SAFE_RAKIZA_CATEGORY_MAP: Record<string, string> = {
  'A4 Printer': 'Printers & Scanners',
  'Barcode Printer': 'Printers & Scanners',
  'AIO PC': 'Computers',
  Bag: 'Bags & Cases',
  'Barcode Scanner': 'Barcode Scanners',
  Cable: 'Cables & Adapters',
  'Cash Drawer': 'Cash Drawers',
  'Desktop PC': 'Desktops',
  'Flash Drive': 'USB Flash Drives',
  HDD: 'Hard Drives (HDD)',
  Laptop: 'Laptops',
  Monitor: 'Monitors',
  'Mouse&Keyboard': 'Keyboards & Mice',
  Network: 'Networking',
  'POS System': 'POS Systems',
  'Receipt Printer': 'Receipt Printers',
  SSD: 'Solid State Drives (SSD)',
  'UPS Battery Backup': 'Power & UPS',
  RAM: 'Components',
  'Spare Parts': 'Components',
  'Power Adapter': 'Cables & Adapters',
};

type ImportQuery = { page?: number; pageSize?: number; status?: CatalogImportRowStatus };

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

@Injectable()
export class CatalogImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matchingService: ValidationMatchingService,
    private readonly categoriesService: CategoriesService,
    private readonly productSkuService: ProductSkuService,
    private readonly productReviewAuditService: ProductReviewAuditService,
  ) {}

  async createPreview(file: Express.Multer.File, userId: string) {
    this.assertCsvFile(file);
    const profile = await this.ensureRakizaProfile();
    const storedFileRef = await this.storeFile(file.buffer);
    const checksum = createHash('sha256').update(file.buffer).digest('hex');
    const session = await this.prisma.catalogImportSession.create({
      data: {
        profileId: profile.id,
        initiatedByUserId: userId,
        originalFilename: file.originalname.slice(0, 255),
        storedFileRef,
        fileFormat: 'CSV',
        fileSizeBytes: file.size,
        fileChecksum: checksum,
        status: CatalogImportSessionStatus.UPLOADED,
      },
    });

    await this.prisma.catalogImportSession.update({ where: { id: session.id }, data: { status: CatalogImportSessionStatus.ANALYZING, startedAt: new Date() } });
    try {
      const parsed = parseCsvBuffer(file.buffer, { filename: file.originalname, mimeType: file.mimetype, maxFileSizeBytes: MAX_FILE_SIZE });
      const mapping = mapCatalogRows(parsed.rows, parsed.headers, profile.config);
      if (!mapping.profileValidation.valid) throw new BadRequestException({ message: 'Import profile is invalid.', errors: mapping.profileValidation.errors });
      const matching = await this.matchingService.validateAndClassify(mapping.rows, profile.config);
      await this.persistRowsAndSummary(session.id, mapping.rows, matching.rows, matching.counts, parsed.totalRows);
      return this.findSession(session.id);
    } catch (error) {
      await this.prisma.catalogImportSession.update({ where: { id: session.id }, data: { status: CatalogImportSessionStatus.FAILED, failureSummary: this.failureMessage(error), completedAt: new Date() } });
      throw error;
    }
  }

  async listSessions() {
    return this.prisma.catalogImportSession.findMany({ orderBy: { createdAt: 'desc' }, include: { profile: { select: { name: true, sourceSystem: true } } } });
  }

  async findSession(id: string) {
    const session = await this.prisma.catalogImportSession.findUnique({ where: { id }, include: { profile: { select: { name: true, sourceSystem: true } } } });
    if (!session) throw new NotFoundException('Import session not found.');
    const issueCounts = await this.issueCounts(id);
    return { ...session, issueCounts };
  }

  async findRows(id: string, query: ImportQuery) {
    await this.assertSession(id);
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 50));
    const where = { sessionId: id, ...(query.status ? { status: query.status } : {}) };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.catalogImportRow.count({ where }),
      this.prisma.catalogImportRow.findMany({ where, orderBy: { rowNumber: 'asc' }, skip: (page - 1) * pageSize, take: pageSize, select: { id: true, rowNumber: true, rawValues: true, normalizedValues: true, matchedProductId: true, status: true, validationErrors: true, detectedChanges: true, applyResult: true, appliedAt: true } }),
    ]);
    return { page, pageSize, total, totalPages: Math.ceil(total / pageSize), rows };
  }

  async apply(id: string, adminUserId: string) {
    const session = await this.prisma.catalogImportSession.findUnique({ where: { id }, include: { profile: true } });
    if (!session) throw new NotFoundException('Import session not found.');
    if (session.status === CatalogImportSessionStatus.COMPLETED) throw new BadRequestException('Import session has already been applied.');
    if (session.status !== CatalogImportSessionStatus.READY_FOR_REVIEW) throw new BadRequestException('Only sessions ready for review can be applied.');

    const approved = await this.prisma.catalogImportSession.updateMany({
      where: { id, status: CatalogImportSessionStatus.READY_FOR_REVIEW },
      data: { status: CatalogImportSessionStatus.APPROVED, approvedAt: new Date(), approvedByUserId: adminUserId },
    });
    if (approved.count !== 1) throw new BadRequestException('Import session is no longer ready for review.');
    await this.prisma.catalogImportSession.update({ where: { id }, data: { status: CatalogImportSessionStatus.APPLYING, appliedAt: new Date() } });

    const profile = this.profileFromRecord(session.profile);
    const rows = await this.prisma.catalogImportRow.findMany({ where: { sessionId: id }, orderBy: { rowNumber: 'asc' }, select: { id: true, rowNumber: true, rawValues: true, normalizedValues: true, matchedProductId: true, status: true, detectedChanges: true } });
    const results: Array<{ rowId: string; rowNumber: number; status: 'APPLIED' | 'SKIPPED'; reason?: string }> = [];
    let failed = false;
    for (const row of rows) {
      const detectedChanges = (row.detectedChanges ?? {}) as { name?: unknown; sourceBarcode?: unknown };
      const hasSourceMetadataChange = Boolean(detectedChanges.name || detectedChanges.sourceBarcode);
      if (!(['NEW', 'PRICE_CHANGED', 'CATEGORY_CHANGED'] as string[]).includes(row.status) && !(row.status === CatalogImportRowStatus.UNCHANGED && hasSourceMetadataChange)) {
        await this.markApplyResult(row.id, 'SKIPPED', { reason: `ROW_STATUS_${row.status}` });
        results.push({ rowId: row.id, rowNumber: row.rowNumber, status: 'SKIPPED', reason: `ROW_STATUS_${row.status}` });
        continue;
      }
      try {
        const parsed = this.parsedRow(row);
        const mapped = mapCatalogRow(parsed, profile);
        const result = await this.applyRow(id, row.id, row.status, row.matchedProductId, mapped, profile, adminUserId);
        results.push({ rowId: row.id, rowNumber: row.rowNumber, ...result });
      } catch (error) {
        failed = true;
        const reason = error instanceof Error ? error.message.slice(0, 500) : 'ROW_APPLY_FAILED';
        await this.markApplyResult(row.id, 'SKIPPED', { reason, failed: true });
        results.push({ rowId: row.id, rowNumber: row.rowNumber, status: 'SKIPPED', reason });
      }
    }

    const appliedCount = results.filter((result) => result.status === 'APPLIED').length;
    const skippedCount = results.length - appliedCount;
    await this.prisma.catalogImportSession.update({
      where: { id },
      data: { status: failed ? CatalogImportSessionStatus.FAILED : CatalogImportSessionStatus.COMPLETED, appliedCount, skippedCount, completedAt: new Date(), failureSummary: failed ? 'One or more rows failed during apply; successful row transactions were preserved.' : null },
    });
    return { sessionId: id, status: failed ? CatalogImportSessionStatus.FAILED : CatalogImportSessionStatus.COMPLETED, appliedCount, skippedCount, results };
  }

  private async applyRow(sessionId: string, rowId: string, rowStatus: CatalogImportRowStatus, matchedProductId: string | null, row: MappedCatalogRow, profile: CatalogMappingProfile, adminUserId: string) {
    if (!row.externalId || !row.name || !row.price || !row.mappedCategoryId) throw new BadRequestException('Row is missing required apply fields.');
    const externalId = row.externalId;
    const name = row.name;
    const price = row.price;
    const categoryId = row.mappedCategoryId;
    const appliedAt = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      if (rowStatus === CatalogImportRowStatus.NEW) {
        const category = await tx.category.findUnique({ where: { id: categoryId }, select: { id: true, isActive: true } });
        if (!category?.isActive) return { status: 'SKIPPED' as const, reason: 'CATEGORY_NOT_ACTIVE' };
        const brand = row.mappedBrandId ? await tx.brand.findUnique({ where: { id: row.mappedBrandId }, select: { id: true } }) : null;
        if (row.mappedBrandId && !brand) return { status: 'SKIPPED' as const, reason: 'BRAND_NOT_FOUND' };
        const slug = await this.uniqueImportedSlug(tx, name, externalId);
        // Product schema requires descriptions. Prefer the source specification;
        // when Rakiza leaves it empty, use the exact source name as a neutral,
        // non-marketing fallback so the inactive product can be enriched later.
        const descriptionOrigin = row.sourceDescription?.trim() ? 'SOURCE_DESCRIPTION' : 'SOURCE_NAME_FALLBACK';
        const description = (row.sourceDescription?.trim() || name).slice(0, 10000);
        const sku = await this.productSkuService.resolve(undefined, tx);
        const product = await tx.product.create({ data: { categoryId: category.id, name: name.slice(0, 160), slug, description, shortDescription: description.slice(0, 255), price: new Decimal(price), baseCurrency: 'LYD', stockQty: 0, status: 'INACTIVE', brandId: brand?.id ?? null, sku } });
        await tx.productSourceIdentity.create({ data: { productId: product.id, sourceSystem: profile.sourceSystem, externalId: externalId.slice(0, 160), sourceBarcode: row.sourceBarcode?.slice(0, 120) ?? null, lastImportedPrice: new Decimal(price), lastImportedName: name.slice(0, 160), lastImportedSourceCategory: row.sourceCategory?.slice(0, 160) ?? null, lastImportedCategoryId: categoryId, lastImportedAt: appliedAt } });
        await tx.catalogImportRow.update({ where: { id: rowId }, data: { matchedProductId: product.id, status: CatalogImportRowStatus.APPLIED, appliedAt, applyResult: json({ action: 'PRODUCT_CREATED', productId: product.id, stockQty: 0, descriptionOrigin }) } });
        return { status: 'APPLIED' as const };
      }

      if (!matchedProductId) return { status: 'SKIPPED' as const, reason: 'MATCHED_PRODUCT_REQUIRED' };
      const identity = await tx.productSourceIdentity.findUnique({ where: { sourceSystem_externalId: { sourceSystem: profile.sourceSystem, externalId } } });
      const product = await tx.product.findUnique({ where: { id: matchedProductId } });
      if (!identity || !product) return { status: 'SKIPPED' as const, reason: 'SOURCE_PRODUCT_NOT_FOUND' };
      if (row.sourceBarcode && row.sourceBarcode !== identity.sourceBarcode) {
        const barcodeConflict = await tx.productSourceIdentity.findFirst({ where: { sourceSystem: profile.sourceSystem, sourceBarcode: row.sourceBarcode, NOT: { id: identity.id } }, select: { id: true } });
        if (barcodeConflict) return { status: 'SKIPPED' as const, reason: 'BARCODE_SOURCE_CONFLICT' };
      }
      const updates: Record<string, unknown> = {};
      const productUpdates: Record<string, unknown> = {};
      const protectedChanges: string[] = [];
      const incomingPrice = new Decimal(price);
      if (!product.price.equals(incomingPrice)) {
        if (identity.lastImportedPrice && product.price.equals(identity.lastImportedPrice)) productUpdates.price = incomingPrice;
        else protectedChanges.push('MANUAL_OVERRIDE_PROTECTED');
      }
      if (product.categoryId !== categoryId) {
        if (identity.lastImportedCategoryId && product.categoryId === identity.lastImportedCategoryId) productUpdates.categoryId = categoryId;
        else protectedChanges.push('MANUAL_CATEGORY_OVERRIDE_PROTECTED');
      }
      if (row.sourceBarcode !== identity.sourceBarcode) updates.sourceBarcode = row.sourceBarcode;
      const reviewInvalidated = this.productReviewAuditService.productUpdateInvalidates(product, productUpdates);
      if (Object.keys(productUpdates).length) await tx.product.update({ where: { id: product.id }, data: productUpdates });
      if (productUpdates.price) await tx.priceHistory.create({ data: { productId: product.id, oldBasePrice: product.price, newBasePrice: incomingPrice, oldComparePrice: product.comparePrice, newComparePrice: product.comparePrice, oldCurrency: product.baseCurrency, newCurrency: product.baseCurrency, exchangeRateUsed: new Decimal(1), changeReason: `catalog_import:${profile.sourceSystem}`, changedByUserId: adminUserId } });
      await tx.productSourceIdentity.update({ where: { id: identity.id }, data: { sourceBarcode: row.sourceBarcode, lastImportedPrice: incomingPrice, lastImportedName: name.slice(0, 160), lastImportedSourceCategory: row.sourceCategory?.slice(0, 160) ?? null, lastImportedCategoryId: categoryId, lastImportedAt: appliedAt } });
      if (reviewInvalidated) await this.productReviewAuditService.invalidate(tx, product.id);
      await tx.catalogImportRow.update({ where: { id: rowId }, data: { status: CatalogImportRowStatus.APPLIED, appliedAt, applyResult: json({ action: 'PRODUCT_UPDATED', protectedChanges, productFieldsChanged: Object.keys(productUpdates), sourceMetadataChanged: Object.keys(updates).filter((key) => key === 'sourceBarcode') }) } });
      return { status: 'APPLIED' as const };
    });
    if (result.status === 'SKIPPED') await this.markApplyResult(rowId, 'SKIPPED', { reason: result.reason });
    return result;
  }

  private async markApplyResult(rowId: string, status: 'APPLIED' | 'SKIPPED', applyResult: Record<string, unknown>) {
    await this.prisma.catalogImportRow.update({ where: { id: rowId }, data: { status, appliedAt: status === 'APPLIED' ? new Date() : null, applyResult: json(applyResult) } });
  }

  private parsedRow(row: { rowNumber: number; rawValues: Prisma.JsonValue; normalizedValues: Prisma.JsonValue | null }): ParsedCsvRow {
    return { rowNumber: row.rowNumber, raw: (row.rawValues ?? {}) as Record<string, string>, normalized: (row.normalizedValues ?? {}) as Record<string, string | null>, parseErrors: [] };
  }

  private async uniqueImportedSlug(tx: Prisma.TransactionClient, name: string, externalId: string) {
    const base = this.slugify(name) || this.slugify(externalId) || `imported-${createHash('sha1').update(externalId).digest('hex').slice(0, 12)}`;
    let slug = base.slice(0, 180);
    const existing = await tx.product.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) return slug;
    slug = `${base.slice(0, 165)}-${createHash('sha1').update(externalId).digest('hex').slice(0, 12)}`;
    let suffix = 2;
    while (await tx.product.findUnique({ where: { slug }, select: { id: true } })) slug = `${base.slice(0, 175)}-${suffix++}`;
    return slug;
  }

  private slugify(value: string) {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
  }

  async listUnmappedCategories(id: string) {
    const session = await this.getReviewSession(id);
    const profile = this.profileFromRecord(session.profile);
    const sourceHeader = profile.columnMapping.sourceCategory;
    const nameHeader = profile.columnMapping.name;
    const mapping = profile.categoryMapping ?? {};
    const rows = await this.prisma.catalogImportRow.findMany({
      where: { sessionId: id },
      select: { rawValues: true, normalizedValues: true },
    });
    const grouped = new Map<string, { affectedRows: number; sampleProductNames: string[] }>();
    for (const row of rows) {
      const sourceCategory = this.valueFromRow(row, sourceHeader);
      if (!sourceCategory) continue;
      const current = grouped.get(sourceCategory) ?? { affectedRows: 0, sampleProductNames: [] };
      current.affectedRows += 1;
      const productName = this.valueFromRow(row, nameHeader);
      if (productName && current.sampleProductNames.length < 5 && !current.sampleProductNames.includes(productName)) current.sampleProductNames.push(productName);
      grouped.set(sourceCategory, current);
    }
    const mappedIds = [...new Set([...grouped.keys()].map((category) => mapping[category]).filter(Boolean))];
    const categories = mappedIds.length ? await this.prisma.category.findMany({ where: { id: { in: mappedIds } }, select: { id: true, name: true, slug: true, parentId: true, isActive: true, isVisible: true } }) : [];
    const byId = new Map(categories.map((category) => [category.id, category]));
    return [...grouped.entries()].map(([sourceCategory, details]) => {
      const mappedCategoryId = mapping[sourceCategory] ?? null;
      const mappedCategory = mappedCategoryId ? byId.get(mappedCategoryId) ?? null : null;
      return { sourceCategory, ...details, currentMapping: mappedCategory ? { id: mappedCategory.id, name: mappedCategory.name, slug: mappedCategory.slug, parentId: mappedCategory.parentId } : null, unsupported: !mappedCategory };
    }).filter((item) => item.unsupported).sort((a, b) => b.affectedRows - a.affectedRows || a.sourceCategory.localeCompare(b.sourceCategory));
  }

  async resolveCategory(id: string, body: unknown) {
    const input = body as { sourceCategory?: unknown; categoryId?: unknown; create?: { name?: unknown; parentCategoryId?: unknown } };
    const sourceCategory = typeof input?.sourceCategory === 'string' ? input.sourceCategory.trim() : '';
    if (!sourceCategory) throw new BadRequestException('sourceCategory is required.');
    const session = await this.getReviewSession(id);
    const profile = this.profileFromRecord(session.profile);
    const sourceHeader = profile.columnMapping.sourceCategory;
    const rows = await this.prisma.catalogImportRow.findMany({ where: { sessionId: id }, select: { rawValues: true, normalizedValues: true } });
    if (!rows.some((row) => this.valueFromRow(row, sourceHeader) === sourceCategory)) throw new BadRequestException('Source category does not belong to this import session.');

    let categoryId: string;
    const wantsCreate = input?.create !== undefined;
    const hasCategoryId = typeof input?.categoryId === 'string' && input.categoryId.trim().length > 0;
    if (wantsCreate === hasCategoryId) throw new BadRequestException('Provide exactly one of categoryId or create.');
    if (hasCategoryId) {
      const category = await this.prisma.category.findUnique({ where: { id: input.categoryId as string }, select: { id: true, isActive: true, isVisible: true } });
      if (!category) throw new NotFoundException('Category not found.');
      if (!category.isActive || !category.isVisible) throw new BadRequestException('Category is not active and usable.');
      categoryId = category.id;
    } else {
      const create = input.create as { name?: unknown; parentCategoryId?: unknown };
      const name = typeof create?.name === 'string' ? create.name.trim() : '';
      const parentId = typeof create?.parentCategoryId === 'string' ? create.parentCategoryId : undefined;
      if (!name) throw new BadRequestException('create.name is required.');
      if (parentId) {
        const parent = await this.prisma.category.findUnique({ where: { id: parentId }, select: { id: true, isActive: true, isVisible: true } });
        if (!parent) throw new NotFoundException('Parent category not found.');
        if (!parent.isActive || !parent.isVisible) throw new BadRequestException('Parent category is not active and usable.');
      }
      categoryId = (await this.categoriesService.createFromImport(name, parentId)).id;
    }

    const updatedProfile = await this.prisma.$transaction(async (tx) => {
      const current = await tx.catalogImportProfile.findUnique({ where: { id: session.profile.id }, select: { categoryMapping: true } });
      const nextMapping = { ...((current?.categoryMapping ?? {}) as Record<string, unknown>), [sourceCategory]: categoryId };
      return tx.catalogImportProfile.update({ where: { id: session.profile.id }, data: { categoryMapping: json(nextMapping) }, select: { id: true, categoryMapping: true } });
    });
    const refreshed = await this.reevaluateSession(id, updatedProfile.categoryMapping as Record<string, string>);
    return { mapping: { sourceCategory, categoryId }, session: refreshed };
  }

  private async reevaluateSession(id: string, categoryMapping: Record<string, string>) {
    const session = await this.getReviewSession(id);
    const profile = this.profileFromRecord({ ...session.profile, categoryMapping });
    const storedRows = await this.prisma.catalogImportRow.findMany({ where: { sessionId: id }, orderBy: { rowNumber: 'asc' }, select: { rowNumber: true, rawValues: true, normalizedValues: true } });
    const parsedRows: ParsedCsvRow[] = storedRows.map((row) => ({ rowNumber: row.rowNumber, raw: (row.rawValues ?? {}) as Record<string, string>, normalized: (row.normalizedValues ?? {}) as Record<string, string | null>, parseErrors: [] }));
    const headers = [...new Set(parsedRows.flatMap((row) => Object.keys(row.raw)))];
    const mapping = mapCatalogRows(parsedRows, headers, profile);
    if (!mapping.profileValidation.valid) throw new BadRequestException({ message: 'Import profile is invalid.', errors: mapping.profileValidation.errors });
    const matching = await this.matchingService.validateAndClassify(mapping.rows, profile);
    await this.persistRowsAndSummary(id, mapping.rows, matching.rows, matching.counts, parsedRows.length);
    return this.findSession(id);
  }

  private async getReviewSession(id: string) {
    const session = await this.prisma.catalogImportSession.findUnique({ where: { id }, include: { profile: true } });
    if (!session) throw new NotFoundException('Import session not found.');
    if (session.status !== CatalogImportSessionStatus.READY_FOR_REVIEW) throw new BadRequestException('Only sessions ready for review can resolve categories.');
    return session;
  }

  private valueFromRow(row: { rawValues: Prisma.JsonValue | null; normalizedValues: Prisma.JsonValue | null }, header?: string) {
    if (!header) return null;
    const normalized = row.normalizedValues as Record<string, unknown> | null;
    const raw = row.rawValues as Record<string, unknown> | null;
    const value = normalized?.[header] ?? raw?.[header];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private async ensureRakizaProfile() {
    const existing = await this.prisma.catalogImportProfile.findFirst({ where: { sourceSystem: 'RAKIZA', name: 'Rakiza CSV', isActive: true } });
    if (existing) return { ...existing, config: this.profileFromRecord(existing) };
    const categories = await this.prisma.category.findMany({ where: { name: { in: Object.values(SAFE_RAKIZA_CATEGORY_MAP) } }, select: { id: true, name: true } });
    const ids = Object.fromEntries(categories.map((category) => [category.name, category.id]));
    const categoryMapping = Object.fromEntries(Object.entries(SAFE_RAKIZA_CATEGORY_MAP).filter(([, storeName]) => ids[storeName]).map(([sourceName, storeName]) => [sourceName, ids[storeName]]));
    const data = await this.prisma.catalogImportProfile.create({ data: { name: 'Rakiza CSV', sourceSystem: 'RAKIZA', fileFormat: 'CSV', columnMapping: json(RAKIZA_CSV_PROFILE.columnMapping), categoryMapping: json(categoryMapping), brandMapping: json({}), sourceCurrency: 'LYD', importMode: 'PRODUCTS_AND_PRICES', updatePolicy: json({ zeroPrice: 'INVALID', missingName: 'INVALID', ignoredBrandValues: RAKIZA_CSV_PROFILE.options?.ignoredBrandValues ?? [] }) } });
    return { ...data, config: { ...RAKIZA_CSV_PROFILE, categoryMapping, brandMapping: {} } };
  }

  private profileFromRecord(record: any): CatalogMappingProfile {
    return { sourceSystem: record.sourceSystem, fileFormat: 'CSV', sourceCurrency: String(record.sourceCurrency), storeCurrency: 'LYD', importMode: String(record.importMode), columnMapping: record.columnMapping as CatalogMappingProfile['columnMapping'], categoryMapping: (record.categoryMapping ?? {}) as Record<string, string>, brandMapping: (record.brandMapping ?? {}) as Record<string, string>, options: { ignoredBrandValues: RAKIZA_CSV_PROFILE.options?.ignoredBrandValues ?? [], stripSurroundingAsterisks: true } };
  }

  private async persistRowsAndSummary(sessionId: string, mappedRows: MappedCatalogRow[], classifiedRows: ClassifiedCatalogRow[], counts: Record<string, number>, totalRows: number) {
    await this.prisma.$transaction(async (tx) => {
      await tx.catalogImportRow.deleteMany({ where: { sessionId } });
      await tx.catalogImportRow.createMany({ data: classifiedRows.map((row) => ({ sessionId, rowNumber: row.rowNumber, rawValues: json(row.mappedRow.sourceRow.raw), normalizedValues: json(row.mappedRow.sourceRow.normalized), matchedProductId: row.matchedProductId, status: row.classification as CatalogImportRowStatus, validationErrors: json({ errors: row.validationErrors, warnings: row.warnings }), detectedChanges: json(row.changes) })) });
      await tx.catalogImportSession.update({ where: { id: sessionId }, data: { totalRows, newCount: counts.NEW ?? 0, unchangedCount: counts.UNCHANGED ?? 0, changedCount: (counts.PRICE_CHANGED ?? 0) + (counts.CATEGORY_CHANGED ?? 0), conflictCount: counts.CONFLICT ?? 0, invalidCount: counts.INVALID ?? 0, status: CatalogImportSessionStatus.READY_FOR_REVIEW, analyzedAt: new Date(), completedAt: new Date() } });
    });
  }

  private async issueCounts(sessionId: string) {
    const rows = await this.prisma.catalogImportRow.findMany({ where: { sessionId }, select: { validationErrors: true } });
    return rows.reduce<Record<string, number>>((result, row) => { const value = row.validationErrors as { errors?: Array<{ code?: string }>; warnings?: Array<{ code?: string }> } | null; const codes = new Set([...((value?.errors ?? [])), ...((value?.warnings ?? []))].map((issue) => issue.code).filter((code): code is string => Boolean(code))); codes.forEach((code) => { result[code] = (result[code] ?? 0) + 1; }); return result; }, {});
  }

  private async assertSession(id: string) { if (!(await this.prisma.catalogImportSession.findUnique({ where: { id }, select: { id: true } }))) throw new NotFoundException('Import session not found.'); }
  private assertCsvFile(file: Express.Multer.File) { if (!file?.buffer?.length) throw new BadRequestException('CSV file is required.'); if (file.size > MAX_FILE_SIZE) throw new BadRequestException('CSV file exceeds the 25MB limit.'); if (!file.originalname.toLowerCase().endsWith('.csv')) throw new BadRequestException('Only CSV files are supported.'); if (!['text/csv', 'application/csv', 'application/vnd.ms-excel'].includes(file.mimetype.toLowerCase())) throw new BadRequestException('Unsupported CSV MIME type.'); }
  private async storeFile(buffer: Buffer) { const directory = join(process.cwd(), 'uploads', 'imports'); await mkdir(directory, { recursive: true }); const ref = `imports/${randomUUID()}.csv`; await writeFile(join(process.cwd(), 'uploads', ref.replace('/', sep)), buffer, { flag: 'wx' }); return ref; }
  private failureMessage(error: unknown) { return error instanceof BadRequestException ? JSON.stringify(error.getResponse()) : error instanceof Error ? error.message.slice(0, 2000) : 'Import analysis failed.'; }
}
