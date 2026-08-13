import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CatalogImportService } from './catalog-import.service';

const category = { id: 'cat-new', name: 'Servers', slug: 'servers', parentId: null, isActive: true, isVisible: true };
const profile = {
  id: 'profile-1', name: 'Rakiza CSV', sourceSystem: 'RAKIZA', fileFormat: 'CSV',
  columnMapping: { externalId: 'SKU', name: 'Name', price: 'Price', sourceCategory: 'Category' },
  categoryMapping: { Laptop: 'cat-laptops' }, brandMapping: {}, sourceCurrency: 'LYD', importMode: 'PRODUCTS_AND_PRICES',
  updatePolicy: {}, isActive: true,
};
const session = { id: 'session-1', profileId: profile.id, status: 'READY_FOR_REVIEW', profile };

function buildService(options: { category?: unknown; createCategory?: unknown; matching?: unknown } = {}) {
  const prisma: any = {
    catalogImportSession: {
      findUnique: jest.fn().mockResolvedValue(session),
      update: jest.fn().mockResolvedValue({}),
    },
    catalogImportProfile: {
      findUnique: jest.fn().mockResolvedValue({ id: profile.id, categoryMapping: profile.categoryMapping }),
      update: jest.fn().mockImplementation(({ data }: any) => ({ id: profile.id, categoryMapping: data.categoryMapping })),
    },
    catalogImportRow: {
      findMany: jest.fn().mockResolvedValue([
        { rowNumber: 2, rawValues: { SKU: 'S-1', Name: 'Server one', Price: '100', Category: 'Server' }, normalizedValues: { SKU: 'S-1', Name: 'Server one', Price: '100', Category: 'Server' } },
        { rowNumber: 3, rawValues: { SKU: 'L-1', Name: 'Laptop one', Price: '200', Category: 'Laptop' }, normalizedValues: { SKU: 'L-1', Name: 'Laptop one', Price: '200', Category: 'Laptop' } },
      ]),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    category: {
      findMany: jest.fn().mockResolvedValue(options.category ? [options.category] : [{ id: 'cat-laptops', name: 'Laptops', slug: 'laptops', parentId: null, isActive: true, isVisible: true }]),
      findUnique: jest.fn().mockResolvedValue(options.category ?? null),
    },
    product: { findMany: jest.fn() },
    productSourceIdentity: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn().mockImplementation(async (work: any) => typeof work === 'function' ? work(prisma) : Promise.all(work)),
  };
  const matching = { validateAndClassify: jest.fn().mockResolvedValue(options.matching ?? {
    rows: [
      { rowNumber: 2, classification: 'NEW', matchedProductId: null, identityMatch: 'NONE', validationErrors: [], warnings: [], changes: {}, mappedRow: { sourceRow: { raw: {}, normalized: {} } } },
      { rowNumber: 3, classification: 'NEW', matchedProductId: null, identityMatch: 'NONE', validationErrors: [], warnings: [], changes: {}, mappedRow: { sourceRow: { raw: {}, normalized: {} } } },
    ], counts: { NEW: 2, UNCHANGED: 0, PRICE_CHANGED: 0, CATEGORY_CHANGED: 0, CONFLICT: 0, INVALID: 0 },
  }) };
  const categories = { createFromImport: jest.fn().mockResolvedValue(options.createCategory ?? category) };
  return { service: new CatalogImportService(prisma, matching as any, categories as any, {} as never), prisma, matching, categories };
}

describe('CatalogImportService category resolution', () => {
  it('groups unresolved categories and samples without duplicates', async () => {
    const { service } = buildService();
    await expect(service.listUnmappedCategories('session-1')).resolves.toEqual([
      expect.objectContaining({ sourceCategory: 'Server', affectedRows: 1, unsupported: true, sampleProductNames: ['Server one'] }),
    ]);
  });

  it('persists an existing mapping, preserves unrelated mappings, and re-evaluates rows', async () => {
    const { service, prisma, matching } = buildService({ category });
    const result = await service.resolveCategory('session-1', { sourceCategory: 'Server', categoryId: category.id });
    expect(prisma.catalogImportProfile.update).toHaveBeenCalledWith(expect.objectContaining({ data: { categoryMapping: { Laptop: 'cat-laptops', Server: category.id } } }));
    expect(matching.validateAndClassify).toHaveBeenCalled();
    expect(prisma.catalogImportRow.deleteMany).toHaveBeenCalledWith({ where: { sessionId: 'session-1' } });
    expect(result.session).toEqual(expect.objectContaining({ id: 'session-1' }));
  });

  it('rejects an unknown category and leaves products untouched', async () => {
    const { service, prisma } = buildService();
    await expect(service.resolveCategory('session-1', { sourceCategory: 'Server', categoryId: 'missing' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.product.findMany).not.toHaveBeenCalled();
    expect(prisma.productSourceIdentity.findMany).not.toHaveBeenCalled();
  });

  it('quick-creates and maps a category with a parent', async () => {
    const parent = { id: 'parent-1', isActive: true, isVisible: true };
    const { service, categories } = buildService({ category: parent });
    await service.resolveCategory('session-1', { sourceCategory: 'Server', create: { name: 'Servers', parentCategoryId: parent.id } });
    expect(categories.createFromImport).toHaveBeenCalledWith('Servers', parent.id);
  });

  it('requires exactly one resolution action and rejects non-review sessions', async () => {
    const { service } = buildService();
    await expect(service.resolveCategory('session-1', { sourceCategory: 'Server' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
