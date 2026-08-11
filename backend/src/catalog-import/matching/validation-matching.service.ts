import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CatalogMappingProfile, MappedCatalogRow, MappingIssue } from '../mapping';
import { ClassifiedCatalogRow, DetectedChanges, IdentityMatch, RowClassification, ValidationMatchingResult } from './validation-matching.types';

type IdentityRecord = { id: string; productId: string; sourceSystem: string; externalId: string; sourceBarcode: string | null; lastImportedPrice: unknown; lastImportedName: string | null };
type ProductRecord = { id: string; price: unknown; name: string; categoryId: string; brandId: string | null };

const issue = (code: string, message: string, field?: string): MappingIssue => ({ code, message, ...(field ? { field: field as never } : {}) });
const key = (sourceSystem: string, externalId: string) => `${sourceSystem}\u0000${externalId}`;
const numberValue = (value: unknown): number | null => value == null ? null : Number(value);

@Injectable()
export class ValidationMatchingService {
  constructor(private readonly prisma: PrismaService) {}

  async validateAndClassify(rows: MappedCatalogRow[], profile: CatalogMappingProfile): Promise<ValidationMatchingResult> {
    const externalIds = [...new Set(rows.map((row) => row.externalId).filter((value): value is string => Boolean(value)))];
    const barcodes = [...new Set(rows.map((row) => row.sourceBarcode).filter((value): value is string => Boolean(value)))];
    const categoryIds = [...new Set(rows.map((row) => row.mappedCategoryId).filter((value): value is string => Boolean(value)))];
    const brandIds = [...new Set(rows.map((row) => row.mappedBrandId).filter((value): value is string => Boolean(value)))];

    const identities = await this.prisma.productSourceIdentity.findMany({
      where: { sourceSystem: profile.sourceSystem, OR: [
        ...(externalIds.length ? [{ externalId: { in: externalIds } }] : []),
        ...(barcodes.length ? [{ sourceBarcode: { in: barcodes } }] : []),
      ] },
      select: { id: true, productId: true, sourceSystem: true, externalId: true, sourceBarcode: true, lastImportedPrice: true, lastImportedName: true },
    }) as IdentityRecord[];
    const productIds = [...new Set(identities.map((identity) => identity.productId))];
    const [products, categories, brands] = await Promise.all([
      productIds.length ? this.prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, price: true, name: true, categoryId: true, brandId: true } }) : [],
      categoryIds.length ? this.prisma.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true } }) : [],
      brandIds.length ? this.prisma.brand.findMany({ where: { id: { in: brandIds } }, select: { id: true } }) : [],
    ]) as [ProductRecord[], { id: string }[], { id: string }[]];

    const identityByKey = new Map(identities.map((identity) => [key(identity.sourceSystem, identity.externalId), identity]));
    const identityKeyCounts = new Map<string, number>();
    identities.forEach((identity) => {
      const identityKey = key(identity.sourceSystem, identity.externalId);
      identityKeyCounts.set(identityKey, (identityKeyCounts.get(identityKey) ?? 0) + 1);
    });
    const duplicateIdentityKeys = new Set([...identityKeyCounts].filter(([, count]) => count > 1).map(([identityKey]) => identityKey));
    const identitiesByBarcode = new Map<string, IdentityRecord[]>();
    identities.forEach((identity) => { if (identity.sourceBarcode) identitiesByBarcode.set(identity.sourceBarcode, [...(identitiesByBarcode.get(identity.sourceBarcode) ?? []), identity]); });
    const productById = new Map(products.map((product) => [product.id, product]));
    const categoryIdsInDb = new Set(categories.map((category) => category.id));
    const brandIdsInDb = new Set(brands.map((brand) => brand.id));
    const classified = rows.map((row) => this.classifyRow(row, profile, identityByKey, duplicateIdentityKeys, identitiesByBarcode, productById, categoryIdsInDb, brandIdsInDb));
    const counts = classified.reduce<Record<RowClassification, number>>((result, row) => { result[row.classification] += 1; return result; }, { NEW: 0, UNCHANGED: 0, PRICE_CHANGED: 0, CATEGORY_CHANGED: 0, CONFLICT: 0, INVALID: 0 });
    return { rows: classified, counts };
  }

  private classifyRow(row: MappedCatalogRow, profile: CatalogMappingProfile, identityByKey: Map<string, IdentityRecord>, duplicateIdentityKeys: Set<string>, identitiesByBarcode: Map<string, IdentityRecord[]>, productById: Map<string, ProductRecord>, categoryIdsInDb: Set<string>, brandIdsInDb: Set<string>): ClassifiedCatalogRow {
    const validationErrors = [...row.parserErrors.map((message) => issue('PARSER_ERROR', message)), ...row.mappingErrors];
    const warnings = [...row.mappingWarnings];
    if (!row.externalId) validationErrors.push(issue('EXTERNAL_ID_REQUIRED', 'External product identity is required.', 'externalId'));
    if (!row.name) validationErrors.push(issue('NAME_REQUIRED', 'Product name is required.', 'name'));
    if (row.price == null) validationErrors.push(issue('PRICE_REQUIRED', 'Price is required.', 'price'));
    else if (row.price <= 0) validationErrors.push(issue(row.price === 0 ? 'ZERO_PRICE' : 'NEGATIVE_PRICE', 'Price must be greater than zero.', 'price'));
    if (!row.mappedCategoryId) validationErrors.push(issue('CATEGORY_MAPPING_REQUIRED', 'A mapped store category is required.', 'sourceCategory'));
    else if (!categoryIdsInDb.has(row.mappedCategoryId)) validationErrors.push(issue('MAPPED_CATEGORY_NOT_FOUND', 'Mapped store category does not exist.', 'sourceCategory'));
    if (row.mappedBrandId && !brandIdsInDb.has(row.mappedBrandId)) validationErrors.push(issue('MAPPED_BRAND_NOT_FOUND', 'Mapped brand does not exist.', 'sourceBrand'));

    const identity = row.externalId ? identityByKey.get(key(profile.sourceSystem, row.externalId)) : undefined;
    const duplicateIdentity = row.externalId ? duplicateIdentityKeys.has(key(profile.sourceSystem, row.externalId)) : false;
    const barcodeMatches = row.sourceBarcode ? identitiesByBarcode.get(row.sourceBarcode) ?? [] : [];
    let identityMatch: IdentityMatch = 'NONE';
    let matchedProductId: string | null = null;
    let product: ProductRecord | undefined;
    if (identity) {
      identityMatch = 'EXACT_EXTERNAL_ID';
      matchedProductId = identity.productId;
      product = productById.get(identity.productId);
      if (!product) { identityMatch = 'BROKEN_EXTERNAL_ID'; warnings.push(issue('BROKEN_PRODUCT_REFERENCE', 'Source identity points to a missing product.')); }
      if (duplicateIdentity) warnings.push(issue('DUPLICATE_SOURCE_IDENTITY', 'Duplicate source identity was returned; database uniqueness is expected to prevent this.'));
    } else if (barcodeMatches.length) {
      identityMatch = 'BARCODE_SOURCE_CONFLICT';
      warnings.push(issue('BARCODE_SOURCE_CONFLICT', 'Barcode belongs to another imported source identity.'));
    } else if (row.sourceBarcode) {
      identityMatch = 'MANUAL_BARCODE_UNAVAILABLE';
      warnings.push(issue('MANUAL_BARCODE_MATCH_UNAVAILABLE', 'Products have no dedicated barcode field; SKU is intentionally not used as barcode.'));
    }
    if (validationErrors.length) return { rowNumber: row.rowNumber, classification: 'INVALID', matchedProductId, identityMatch, validationErrors, warnings, changes: {}, mappedRow: row };
    if (!identity) return { rowNumber: row.rowNumber, classification: barcodeMatches.length ? 'CONFLICT' : 'NEW', matchedProductId: null, identityMatch, validationErrors, warnings, changes: {}, mappedRow: row };
    if (duplicateIdentity) return { rowNumber: row.rowNumber, classification: 'CONFLICT', matchedProductId, identityMatch, validationErrors, warnings, changes: {}, mappedRow: row };
    if (!product) return { rowNumber: row.rowNumber, classification: 'CONFLICT', matchedProductId, identityMatch, validationErrors, warnings, changes: {}, mappedRow: row };

    const changes: DetectedChanges = {};
    const currentPrice = numberValue(product.price);
    if (currentPrice !== row.price) {
      const lastImportedPrice = numberValue(identity.lastImportedPrice);
      changes.price = { current: currentPrice, lastImported: lastImportedPrice, incoming: row.price, manualOverrideSuspected: lastImportedPrice == null ? null : currentPrice !== lastImportedPrice };
      if (lastImportedPrice == null) warnings.push(issue('MANUAL_OVERRIDE_HISTORY_UNAVAILABLE', 'No lastImportedPrice snapshot exists, so manual price override cannot be proven.'));
      else if (currentPrice !== lastImportedPrice) warnings.push(issue('MANUAL_OVERRIDE_SUSPECTED', 'Current store price differs from the last imported source price.'));
    }
    if (product.categoryId !== row.mappedCategoryId) changes.category = { currentId: product.categoryId, incomingId: row.mappedCategoryId };
    if (identity.sourceBarcode !== row.sourceBarcode) changes.sourceBarcode = { current: identity.sourceBarcode, incoming: row.sourceBarcode };
    if (product.name !== row.name) {
      const manualEnrichmentUnknown = identity.lastImportedName == null;
      changes.name = { current: product.name, incoming: row.name, manualEnrichmentUnknown };
      warnings.push(issue(manualEnrichmentUnknown ? 'NAME_ENRICHMENT_UNKNOWN' : 'MERCHANT_NAME_ENRICHMENT_DETECTED', manualEnrichmentUnknown ? 'Name differs, but no previous source name exists.' : 'Store name differs from the last imported source name; preserve merchant enrichment.'));
    }
    const classification: RowClassification = changes.price ? 'PRICE_CHANGED' : changes.category ? 'CATEGORY_CHANGED' : 'UNCHANGED';
    return { rowNumber: row.rowNumber, classification, matchedProductId, identityMatch, validationErrors, warnings, changes, mappedRow: row };
  }
}
