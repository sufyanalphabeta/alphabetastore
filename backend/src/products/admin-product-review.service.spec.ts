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

  it('returns only the safe reviewer summary in queue rows', async () => {
    const reviewedAt = new Date('2026-08-13T12:00:00Z');
    const prisma = { product: { findMany: jest.fn().mockResolvedValue([product({
      catalogReviewedAt: reviewedAt,
      catalogReviewedBy: { id: 'admin-1', name: 'Admin', email: 'private@example.com', passwordHash: 'secret' },
    })]) } };
    const service = new AdminProductReviewService(prisma as never, new ProductReadinessService());

    const result = await service.list({ page: 1, limit: 10 });

    expect(result.items[0]).toMatchObject({ reviewed: true, catalogReviewedAt: reviewedAt, reviewedBy: { id: 'admin-1', name: 'Admin' } });
    expect(result.items[0].reviewedBy).not.toHaveProperty('email');
    expect(result.items[0].reviewedBy).not.toHaveProperty('passwordHash');
  });

  it('derives MANUAL origin and uses server pagination', async () => {
    const products = Array.from({ length: 21 }, (_, index) => product({ id: `p${index + 1}`, slug: `manual-${index + 1}`, sourceIdentities: [] }));
    const prisma = { product: { findMany: jest.fn().mockResolvedValue(products) } };
    const service = new AdminProductReviewService(prisma as never, new ProductReadinessService());
    const result = await service.list({ origin: 'MANUAL', page: 2, limit: 10 });
    expect(result.items[0].origin).toBe('MANUAL');
    expect(result.items).toHaveLength(10);
    expect(result.pagination.totalPages).toBe(3);
  });

  it('applies issue and readiness filters through the authoritative domain evaluation', async () => {
    const ready = product({ id: 'ready', slug: 'ready', media: [], images: [{ imageUrl: '/real.jpg' }], _count: { media: 0, images: 1 } });
    const blocked = product({ id: 'blocked', slug: 'blocked' });
    const prisma = { product: { findMany: jest.fn().mockResolvedValue([ready, blocked]) } };
    const service = new AdminProductReviewService(prisma as never, new ProductReadinessService());
    const result = await service.list({ issue: 'MISSING_IMAGE', readiness: 'BLOCKED' });
    expect(result.items.map((item) => item.id)).toEqual(['blocked']);
  });

  it('returns authoritative summary counts', async () => {
    const products = [
      product({ id: 'ready', slug: 'ready', status: 'ACTIVE', media: [], images: [{ imageUrl: '/legacy.jpg' }], _count: { media: 0, images: 1 }, catalogReviewedAt: new Date(), catalogReviewedBy: { id: 'u1', name: 'Admin' } }),
      product({ id: 'image', slug: 'image', status: 'INACTIVE' }),
      product({ id: 'category', slug: 'category', status: 'INACTIVE', category: { id: 'c2', name: 'Hidden', slug: 'hidden', isActive: true, isVisible: false }, media: [], images: [{ imageUrl: '/legacy.jpg' }], _count: { media: 0, images: 1 } }),
      product({ id: 'price', slug: 'price', status: 'INACTIVE', price: new Decimal(0), media: [], images: [{ imageUrl: '/legacy.jpg' }], _count: { media: 0, images: 1 }, sourceIdentities: [] }),
    ];
    const prisma = { product: { findMany: jest.fn().mockResolvedValue(products) } };
    const service = new AdminProductReviewService(prisma as never, new ProductReadinessService());
    await expect(service.summary()).resolves.toEqual({
      total: 4, active: 1, inactive: 3, imported: 3, manual: 1,
      blocked: 3, ready: 1, missingImage: 1, missingBrand: 4,
      missingSpecs: 4, invalidPrice: 1, invalidCategory: 1, reviewed: 1, unreviewed: 3,
      needsReview: 3, readyToPublish: 0, published: 1,
    });
  });

  it('returns the next matching product deterministically and skips the current product', async () => {
    const prisma = { product: { findMany: jest.fn().mockResolvedValue([
      product({ id: 'p1', slug: 'current-product' }),
      product({ id: 'p2', slug: 'next-product' }),
    ]) } };
    const service = new AdminProductReviewService(prisma as never, new ProductReadinessService());
    await expect(service.next('p1', { origin: 'IMPORTED', issue: 'MISSING_IMAGE', sort: 'name' })).resolves.toEqual({
      item: { id: 'p2', slug: 'next-product' },
    });
    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: expect.any(Array) },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    }));
  });

  it('returns null when no other product matches the preserved review context', async () => {
    const prisma = { product: { findMany: jest.fn().mockResolvedValue([product({ id: 'p1', slug: 'current-product' })]) } };
    const service = new AdminProductReviewService(prisma as never, new ProductReadinessService());
    await expect(service.next('p1', { readiness: 'READY' })).resolves.toEqual({ item: null });
  });

  it.each([[true, { catalogReviewedAt: { not: null } }], [false, { catalogReviewedAt: null }]])('filters reviewed=%s on the server', async (reviewed, predicate) => {
    const prisma = { product: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) } };
    const service = new AdminProductReviewService(prisma as never, new ProductReadinessService());
    await service.list({ reviewed });
    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { AND: expect.arrayContaining([predicate]) } }));
  });

  it.each([
    ['NEEDS_REVIEW', ['blocked', 'ready-unreviewed']],
    ['READY_TO_PUBLISH', ['ready-reviewed']],
    ['PUBLISHED', ['published']],
  ])('applies authoritative workspace=%s state', async (workspace, expectedIds) => {
    const products = [
      product({ id: 'blocked', slug: 'blocked' }),
      product({ id: 'ready-unreviewed', slug: 'ready-unreviewed', images: [{ imageUrl: '/image.jpg' }], _count: { media: 0, images: 1 } }),
      product({ id: 'ready-reviewed', slug: 'ready-reviewed', images: [{ imageUrl: '/image.jpg' }], _count: { media: 0, images: 1 }, catalogReviewedAt: new Date(), catalogReviewedBy: { id: 'u1', name: 'Admin' } }),
      product({ id: 'published', slug: 'published', status: 'ACTIVE', images: [{ imageUrl: '/image.jpg' }], _count: { media: 0, images: 1 }, catalogReviewedAt: new Date(), catalogReviewedBy: { id: 'u1', name: 'Admin' } }),
    ];
    const prisma = { product: { findMany: jest.fn().mockResolvedValue(products) } };
    const service = new AdminProductReviewService(prisma as never, new ProductReadinessService());
    const result = await service.list({ workspace: workspace as never, page: 1, limit: 20 });
    expect(result.items.map((item) => item.id)).toEqual(expectedIds);
  });

  it('filters products by their exact Catalog Import session relation', async () => {
    const prisma = { product: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new AdminProductReviewService(prisma as never, new ProductReadinessService());
    await service.list({ importSessionId: '11111111-1111-4111-8111-111111111111' });
    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: expect.arrayContaining([{ catalogImportRows: { some: { sessionId: '11111111-1111-4111-8111-111111111111' } } }]) },
    }));
  });
});
