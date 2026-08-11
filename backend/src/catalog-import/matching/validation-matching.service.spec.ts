import { ValidationMatchingService } from './validation-matching.service';
import { MappedCatalogRow } from '../mapping';

const profile = { sourceSystem: 'RAKIZA', fileFormat: 'CSV' as const, sourceCurrency: 'LYD', storeCurrency: 'LYD', columnMapping: {}, categoryMapping: {}, brandMapping: {} };
const row = (overrides: Partial<MappedCatalogRow> = {}): MappedCatalogRow => ({
  rowNumber: 1, sourceSystem: 'RAKIZA', externalId: 'A-1', sourceBarcode: 'B-1', name: 'منتج عربي', price: 100,
  currency: 'LYD', sourceCategory: 'Computers', mappedCategoryId: 'cat-1', sourceBrand: null, mappedBrandId: null,
  sourceDescription: null, mappingWarnings: [], mappingErrors: [], parserErrors: [], sourceRow: {} as never, ...overrides,
});
const database = (identities: unknown[] = [], products: unknown[] = [], categories: unknown[] = [{ id: 'cat-1' }], brands: unknown[] = []) => ({
  productSourceIdentity: { findMany: jest.fn().mockResolvedValue(identities) },
  product: { findMany: jest.fn().mockResolvedValue(products) },
  category: { findMany: jest.fn().mockResolvedValue(categories) },
  brand: { findMany: jest.fn().mockResolvedValue(brands) },
});
const identity = (overrides: Record<string, unknown> = {}) => ({ id: 'identity-1', productId: 'product-1', sourceSystem: 'RAKIZA', externalId: 'A-1', sourceBarcode: 'B-1', lastImportedPrice: null, lastImportedName: null, ...overrides });
const product = (overrides: Record<string, unknown> = {}) => ({ id: 'product-1', price: 100, name: 'منتج عربي', categoryId: 'cat-1', brandId: null, ...overrides });

describe('ValidationMatchingService', () => {
  it.each([
    ['new candidate', row(), [], [], 'NEW'],
    ['zero price', row({ price: 0 }), [], [], 'INVALID'],
    ['negative price', row({ price: -1 }), [], [], 'INVALID'],
    ['missing name', row({ name: null }), [], [], 'INVALID'],
    ['missing external id', row({ externalId: null }), [], [], 'INVALID'],
    ['unmapped category', row({ mappedCategoryId: null }), [], [], 'INVALID'],
    ['missing category in db', row({ mappedCategoryId: 'missing' }), [], [], 'INVALID'],
    ['unknown mapped brand', row({ mappedBrandId: 'brand-missing' }), [], [], 'INVALID'],
  ])('%s', async (_label, input, identities, products, expected) => {
    const result = await new ValidationMatchingService(database(identities, products) as never).validateAndClassify([input], profile);
    expect(result.rows[0].classification).toBe(expected);
  });

  it('matches exact external identity and detects unchanged, price, category and combined changes', async () => {
    const db = database([identity()], [product()]);
    const service = new ValidationMatchingService(db as never);
    expect((await service.validateAndClassify([row()], profile)).rows[0].classification).toBe('UNCHANGED');
    expect((await service.validateAndClassify([row({ price: 120 })], profile)).rows[0]).toMatchObject({ classification: 'PRICE_CHANGED', matchedProductId: 'product-1' });
    expect((await service.validateAndClassify([row({ mappedCategoryId: 'cat-2' })], { ...profile } as never)).rows[0].classification).toBe('INVALID');
    const combined = await service.validateAndClassify([row({ price: 120, mappedCategoryId: 'cat-1' })], profile);
    expect(combined.rows[0].changes.price).toBeDefined();
  });

  it('detects category changes when the mapped category exists', async () => {
    const db = database([identity()], [product({ categoryId: 'cat-old' })], [{ id: 'cat-1' }]);
    const result = await new ValidationMatchingService(db as never).validateAndClassify([row()], profile);
    expect(result.rows[0].classification).toBe('CATEGORY_CHANGED');
    expect(result.rows[0].changes.category).toEqual({ currentId: 'cat-old', incomingId: 'cat-1' });
  });

  it('treats changed barcode, broken identity and duplicate source barcode as conflicts', async () => {
    const changed = await new ValidationMatchingService(database([identity({ sourceBarcode: 'old' })], [product()]) as never).validateAndClassify([row({ sourceBarcode: 'new' })], profile);
    expect(changed.rows[0].classification).toBe('CONFLICT');
    const broken = await new ValidationMatchingService(database([identity()], []) as never).validateAndClassify([row()], profile);
    expect(broken.rows[0].identityMatch).toBe('BROKEN_EXTERNAL_ID');
    const duplicate = await new ValidationMatchingService(database([identity({ externalId: 'other', sourceBarcode: 'B-1' })], []) as never).validateAndClassify([row({ sourceBarcode: 'B-1' })], profile);
    expect(duplicate.rows[0].classification).toBe('CONFLICT');
  });

  it('never matches by name or silently links a manual product barcode', async () => {
    const result = await new ValidationMatchingService(database([], []) as never).validateAndClassify([row({ name: 'Existing Manual Product', sourceBarcode: 'MANUAL-1' })], profile);
    expect(result.rows[0].classification).toBe('NEW');
    expect(result.rows[0].matchedProductId).toBeNull();
    expect(result.rows[0].identityMatch).toBe('MANUAL_BARCODE_UNAVAILABLE');
  });

  it('allows ignored brands and validates existing mapped brands', async () => {
    const ignored = await new ValidationMatchingService(database() as never).validateAndClassify([row({ sourceBrand: 'Ø¹Ø§Ù…' })], profile);
    expect(ignored.rows[0].classification).toBe('NEW');
    const valid = await new ValidationMatchingService(database([], [], [{ id: 'cat-1' }], [{ id: 'brand-1' }]) as never).validateAndClassify([row({ mappedBrandId: 'brand-1' })], profile);
    expect(valid.rows[0].classification).toBe('NEW');
  });

  it('exposes manual price and name limitations instead of guessing', async () => {
    const result = await new ValidationMatchingService(database([identity()], [product({ name: 'Merchant enriched', price: 90 })]) as never).validateAndClassify([row({ price: 100 })], profile);
    expect(result.rows[0].changes.price?.manualOverrideSuspected).toBeNull();
    expect(result.rows[0].changes.name?.manualEnrichmentUnknown).toBe(true);
    expect(result.rows[0].warnings.map((warning) => warning.code)).toEqual(expect.arrayContaining(['MANUAL_OVERRIDE_HISTORY_UNAVAILABLE', 'NAME_ENRICHMENT_UNKNOWN']));
  });

  it('uses nullable source snapshots to detect a manual price override and preserve an enriched Arabic name', async () => {
    const db = database([identity({ lastImportedPrice: 100, lastImportedName: 'منتج عربي' })], [product({ price: 90, name: 'منتج عربي محسّن' })]);
    const result = await new ValidationMatchingService(db as never).validateAndClassify([row({ price: 120, name: 'منتج عربي' })], profile);
    expect(result.rows[0].changes.price).toMatchObject({ lastImported: 100, manualOverrideSuspected: true });
    expect(result.rows[0].warnings.map((warning) => warning.code)).toContain('MANUAL_OVERRIDE_SUSPECTED');
    expect(result.rows[0].warnings.map((warning) => warning.code)).toContain('MERCHANT_NAME_ENRICHMENT_DETECTED');
  });

  it('is idempotent and uses batch reads rather than per-row queries', async () => {
    const db = database([identity()], [product()]);
    const input = [row(), row({ rowNumber: 2, externalId: 'missing', sourceBarcode: null })];
    const service = new ValidationMatchingService(db as never);
    const first = await service.validateAndClassify(input, profile);
    const second = await service.validateAndClassify(input, profile);
    expect(second.rows.map((item) => item.classification)).toEqual(first.rows.map((item) => item.classification));
    expect(db.productSourceIdentity.findMany).toHaveBeenCalledTimes(2);
    expect(db.product.findMany).toHaveBeenCalledTimes(2);
  });
});
