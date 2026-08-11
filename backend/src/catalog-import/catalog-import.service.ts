import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CatalogImportRowStatus, CatalogImportSessionStatus, Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join, sep } from 'path';
import { parseCsvBuffer } from './parsing';
import { mapCatalogRows, CatalogMappingProfile, MappedCatalogRow } from './mapping';
import { RAKIZA_CSV_PROFILE } from './profiles/rakiza.profile';
import { ValidationMatchingService, ClassifiedCatalogRow } from './matching';
import { PrismaService } from '../prisma/prisma.service';

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
      this.prisma.catalogImportRow.findMany({ where, orderBy: { rowNumber: 'asc' }, skip: (page - 1) * pageSize, take: pageSize, select: { id: true, rowNumber: true, rawValues: true, normalizedValues: true, matchedProductId: true, status: true, validationErrors: true, detectedChanges: true } }),
    ]);
    return { page, pageSize, total, totalPages: Math.ceil(total / pageSize), rows };
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
