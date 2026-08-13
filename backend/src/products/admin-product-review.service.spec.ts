import { Decimal } from '@prisma/client/runtime/library';

import { AdminProductReviewService } from './admin-product-review.service';
import { ProductReadinessService } from './product-readiness.service';

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1', name: 'Imported laptop', slug: 'imported-laptop', status: 'INACTIVE',
    price: new Decimal(100), baseCurrency: 'LYD', shortDescription: 'Short', description: 'Long',
    brand: null, brandId: null, specs: {}, warrantyText: null, sku: null, updatedAt: new Date('2026-01-01'),
    category: { id: 'c1', name: 'Laptops', slug: 'laptops', isActive: true, isVisible: true },
    brandRef: null, images: [], media: [],
    sourceIdentities: [{ sourceSystem: 'RAKIZA', externalId: '10', sourceBarcode: '123', lastImportedName: 'Imported laptop', lastImportedAt: new Date('2026-01-01') }],
    _count: { media: 0, images: 0 },
    ...overrides,
  };
}

describe('AdminProductReviewService', () => {
  it('returns compact imported origin/readiness data without source snapshots', async () => {
    const prisma = {
      product: { findMany: jest.fn().mockResolvedValue([product()]), count: jest.fn().mockResolvedValue(1) },
    };
    const service = new AdminProductReviewService(prisma as never, new ProductReadinessService());
    const result = await service.list({ page: 1, limit: 10 });
    expect(result.items[0]).toMatchObject({
      origin: 'IMPORTED', sourceSystems: ['RAKIZA'], source: { sourceSystem: 'RAKIZA', externalId: '10', sourceBarcode: '123' },
      readiness: { readyToPublish: false, blockers: expect.arrayContaining(['MISSING_IMAGE']) },
    });
    expect(result.items[0]).not.toHaveProperty('description');
    expect(result.items[0]).not.toHaveProperty('specs');
    expect(result.items[0]).not.toHaveProperty('sourceIdentities');
    expect(result.pagination).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
  });

  it('derives MANUAL origin and uses server pagination', async () => {
    const prisma = { product: { findMany: jest.fn().mockResolvedValue([product({ sourceIdentities: [] })]), count: jest.fn().mockResolvedValue(21) } };
    const service = new AdminProductReviewService(prisma as never, new ProductReadinessService());
    const result = await service.list({ origin: 'MANUAL', page: 2, limit: 10 });
    expect(result.items[0].origin).toBe('MANUAL');
    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }));
    expect(result.pagination.totalPages).toBe(3);
  });

  it('translates issue and readiness filters into database predicates', async () => {
    const prisma = { product: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) } };
    const service = new AdminProductReviewService(prisma as never, new ProductReadinessService());
    await service.list({ issue: 'MISSING_IMAGE', readiness: 'BLOCKED' });
    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { AND: expect.any(Array) } }));
  });

  it('returns authoritative summary counts', async () => {
    const counts = [344, 12, 332, 333, 11, 338, 6, 338, 333, 329, 0, 0];
    const prisma = { product: { count: jest.fn().mockImplementation(() => Promise.resolve(counts.shift())) } };
    const service = new AdminProductReviewService(prisma as never, new ProductReadinessService());
    await expect(service.summary()).resolves.toEqual({
      total: 344, active: 12, inactive: 332, imported: 333, manual: 11,
      blocked: 338, ready: 6, missingImage: 338, missingBrand: 333,
      missingSpecs: 329, invalidPrice: 0, invalidCategory: 0,
    });
  });
});
