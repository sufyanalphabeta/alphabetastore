import { Decimal } from '@prisma/client/runtime/library';

import { AdminProductReviewService } from './admin-product-review.service';
import { ProductReadinessService } from './product-readiness.service';
import { ProductsService } from './products.service';

function productState(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    name: 'Ready product',
    slug: 'ready-product',
    status: 'ACTIVE',
    price: new Decimal(100),
    baseCurrency: 'LYD',
    shortDescription: 'Short',
    description: 'Description',
    brand: 'AlfaBeta',
    brandId: null,
    specs: { cpu: 'i7' },
    warrantyText: '1 year',
    sku: 'AB-000001',
    updatedAt: new Date('2026-08-13T00:00:00Z'),
    category: { id: 'c1', name: 'Computers', slug: 'computers', isActive: true, isVisible: true },
    brandRef: null,
    images: [],
    media: [{ role: 'PRIMARY', sortOrder: 0, mediaAsset: { processingStatus: 'READY', originalWidth: 1200, originalHeight: 1200, variants: {} } }],
    sourceIdentities: [],
    sourceRelations: [],
    variants: [],
    priceHistory: [],
    _count: { media: 1, images: 0 },
    ...overrides,
  };
}

function servicesWith(getProducts: () => ReturnType<typeof productState>[]) {
  const prisma = {
    product: {
      findMany: jest.fn().mockImplementation(() => Promise.resolve(getProducts())),
      findUnique: jest.fn().mockImplementation(() => Promise.resolve(getProducts()[0] ?? null)),
      findFirst: jest.fn().mockImplementation(() => Promise.resolve(getProducts()[0] ?? null)),
    },
  };
  const readiness = new ProductReadinessService();
  const cache = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
  const attributes = { missingRequiredForProduct: jest.fn().mockResolvedValue([]), publicProductAttributes: jest.fn().mockResolvedValue({ attributes: [], specs: [], comparisonAttributes: [] }) };
  const products = new (ProductsService as any)(prisma, {}, {}, cache, {}, readiness, {}, {}, attributes);
  return { queue: new AdminProductReviewService(prisma as never, readiness, attributes as never), products, prisma };
}

describe('Admin product readiness consistency', () => {
  it.each([
    ['ready product', {}, []],
    ['missing image', { media: [], images: [], _count: { media: 0, images: 0 } }, ['MISSING_IMAGE']],
    ['non-ready primary ignores legacy image', { media: [{ role: 'PRIMARY', mediaAsset: { processingStatus: 'FAILED', variants: {} } }], images: [{ imageUrl: '/legacy.jpg' }], _count: { media: 1, images: 1 } }, ['MISSING_IMAGE']],
    ['legacy image without ProductMedia', { media: [], images: [{ imageUrl: '/legacy.jpg' }], _count: { media: 0, images: 1 } }, []],
    ['inactive category', { category: { id: 'c1', name: 'Computers', slug: 'computers', isActive: false, isVisible: true } }, ['INVALID_CATEGORY']],
    ['invisible category', { category: { id: 'c1', name: 'Computers', slug: 'computers', isActive: true, isVisible: false } }, ['INVALID_CATEGORY']],
    ['zero price', { price: new Decimal(0) }, ['INVALID_PRICE']],
  ])('returns identical Queue and Detail readiness for %s', async (_label, overrides, blockers) => {
    const state = productState(overrides);
    const { queue, products } = servicesWith(() => [state]);

    const queueResult = await queue.list({ limit: 20 });
    const detailResult = await products.findOneAdmin(state.slug);

    expect(queueResult.items[0].readiness).toEqual(detailResult.readiness);
    expect(detailResult.readiness.blockers).toEqual(blockers);
  });

  it('re-evaluates fresh media, primary, and category state without an admin readiness cache', async () => {
    let state = productState({ media: [], images: [], _count: { media: 0, images: 0 } });
    const { products, prisma } = servicesWith(() => [state]);
    await expect(products.findOneAdmin(state.slug)).resolves.toMatchObject({ readiness: { blockers: ['MISSING_IMAGE'] } });

    state = productState();
    await expect(products.findOneAdmin(state.slug)).resolves.toMatchObject({ readiness: { readyToPublish: true } });

    state = productState({ media: [{ role: 'PRIMARY', mediaAsset: { processingStatus: 'FAILED', variants: {} } }], _count: { media: 1, images: 0 } });
    await expect(products.findOneAdmin(state.slug)).resolves.toMatchObject({ readiness: { blockers: ['MISSING_IMAGE'] } });

    state = productState({ category: { id: 'c1', name: 'Computers', slug: 'computers', isActive: true, isVisible: false } });
    await expect(products.findOneAdmin(state.slug)).resolves.toMatchObject({ readiness: { blockers: ['INVALID_CATEGORY'] } });
    expect(prisma.product.findUnique).toHaveBeenCalledTimes(4);
  });

  it('keeps summary counts equal to authoritative READY and BLOCKED list filters', async () => {
    const states = [
      productState({ id: 'ready', slug: 'ready' }),
      productState({ id: 'image', slug: 'image', media: [], images: [], _count: { media: 0, images: 0 } }),
      productState({ id: 'category', slug: 'category', category: { id: 'c2', name: 'Hidden', slug: 'hidden', isActive: true, isVisible: false } }),
    ];
    const { queue } = servicesWith(() => states);
    const [summary, ready, blocked] = await Promise.all([
      queue.summary(),
      queue.list({ readiness: 'READY', limit: 20 }),
      queue.list({ readiness: 'BLOCKED', limit: 20 }),
    ]);

    expect(summary.ready).toBe(ready.pagination.total);
    expect(summary.blocked).toBe(blocked.pagination.total);
    expect(summary.ready + summary.blocked).toBe(summary.total);
  });
});
