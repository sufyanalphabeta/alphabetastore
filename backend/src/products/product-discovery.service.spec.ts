import { Decimal } from '@prisma/client/runtime/library';

import { BaseCurrency } from '../prisma/prisma-client';
import { ProductsService } from './products.service';

const settings = { exchangeRate: new Decimal(5.2), defaultCurrency: 'LYD', autoRound: false };

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'HP Laptop',
    slug: 'hp-laptop',
    sku: 'AB-000001',
    price: new Decimal(100),
    baseCurrency: BaseCurrency.USD,
    exchangeRateOverride: null,
    comparePrice: null,
    discountType: null,
    discountValue: null,
    discountStartAt: null,
    discountEndAt: null,
    stockQty: 3,
    isFeatured: false,
    hasVariants: false,
    brand: 'HP',
    brandRef: { id: 'brand-1', name: 'HP', slug: 'hp', logoUrl: null },
    category: { id: 'category-1', name: 'Laptops', slug: 'laptops', isActive: true },
    ratingAvg: new Decimal(0),
    ratingCount: 0,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    images: [{ imageUrl: '/legacy.webp' }],
    media: [],
    _count: { media: 0 },
    ...overrides,
  };
}

function setup(rows = [product()]) {
  const prisma = {
    product: {
      findMany: jest.fn().mockResolvedValue(rows),
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(rows.length),
      groupBy: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
    recentlyViewedItem: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
    category: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    brand: { findMany: jest.fn().mockResolvedValue([]) },
    productMedia: { count: jest.fn().mockResolvedValue(0) },
  };
  const cache = { get: jest.fn().mockResolvedValue(undefined), set: jest.fn(), del: jest.fn() };
  const pricing = {
    getPricingSettings: jest.fn().mockResolvedValue(settings),
    computePrice: jest.fn().mockImplementation((row) => ({
      finalPrice: row.baseCurrency === BaseCurrency.USD ? row.price.mul(5.2) : row.price,
      displayBasePrice: row.baseCurrency === BaseCurrency.USD ? row.price.mul(5.2) : row.price,
      comparePrice: null,
      hasActiveDiscount: false,
      discountPercent: 0,
    })),
  };
  const categoryTree = {
    resolveScope: jest.fn().mockResolvedValue({ categoryIds: ['category-1', 'category-child'] }),
    getPublicCounts: jest.fn().mockResolvedValue([]),
  };
  const service = new ProductsService(
    prisma as never,
    {} as never,
    pricing as never,
    cache as never,
    { resolve: jest.fn() } as never,
    { evaluate: jest.fn() } as never,
    { productUpdateInvalidates: jest.fn(), invalidationData: jest.fn() } as never,
    categoryTree as never,
  );
  return { service, prisma, categoryTree };
}

describe('ProductsService storefront discovery', () => {
  it('filters an entire recursive category scope and keeps ACTIVE publication safety', async () => {
    const { service, prisma, categoryTree } = setup();
    await service.findAll({ category: 'computers', page: 1, limit: 12 });
    expect(categoryTree.resolveScope).toHaveBeenCalledWith('computers', { publicOnly: true });
    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: [{ status: 'ACTIVE' }, { categoryId: { in: ['category-1', 'category-child'] } }] },
    }));
  });

  it('supports relation and legacy brand filtering', async () => {
    const { service, prisma } = setup();
    await service.findAll({ brand: 'HP', page: 1, limit: 12 });
    const where = prisma.product.findMany.mock.calls[0][0].where;
    expect(where.AND[1].OR).toEqual(expect.arrayContaining([
      { brand: { contains: 'HP', mode: 'insensitive' } },
      { brandRef: { name: { contains: 'HP', mode: 'insensitive' } } },
    ]));
  });

  it.each([
    ['in-stock', { stockQty: { gt: 0 } }],
    ['out-of-stock', { stockQty: { lte: 0 } }],
  ])('supports %s availability', async (availability, expected) => {
    const { service, prisma } = setup();
    await service.findAll({ availability: availability as 'in-stock' | 'out-of-stock', page: 1, limit: 12 });
    expect(prisma.product.findMany.mock.calls[0][0].where.AND).toContainEqual(expected);
  });

  it('returns a compact LYD-only public card projection', async () => {
    const { service } = setup();
    const result = await service.findAll({ page: 1, limit: 12 }) as any;
    expect(result.items[0]).toMatchObject({ price: '520.00', currency: 'LYD', cardImageUrl: '/legacy.webp', inStock: true });
    expect(result.items[0]).not.toHaveProperty('baseCurrency');
    expect(result.items[0]).not.toHaveProperty('stockQty');
    expect(result.items[0]).not.toHaveProperty('status');
    expect(result.items[0]).not.toHaveProperty('description');
  });

  it('prefers READY ProductMedia and never falls back when media exists but is not READY', async () => {
    const ready = product({
      media: [{ mediaAsset: { processingStatus: 'READY', variants: { card: { url: '/card.webp' } } } }],
      _count: { media: 1 },
    });
    const pending = product({ id: '22222222-2222-4222-8222-222222222222', media: [], _count: { media: 1 } });
    const { service } = setup([ready, pending]);
    const result = await service.findAll({ page: 1, limit: 12 }) as any;
    expect(result.items[0].cardImageUrl).toBe('/card.webp');
    expect(result.items[1].cardImageUrl).toBeNull();
  });

  it('returns null for the storefront placeholder contract when no image exists', async () => {
    const { service } = setup([product({ images: [], media: [], _count: { media: 0 } })]);
    const result = await service.findAll({ page: 1, limit: 12 }) as any;
    expect(result.items[0].cardImageUrl).toBeNull();
  });

  it('paginates and counts without loading the full catalog', async () => {
    const { service, prisma } = setup();
    await service.findAll({ q: 'hp', page: 2, limit: 8 });
    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 8, take: 8 }));
    expect(prisma.product.count).toHaveBeenCalledTimes(1);
  });

  it('runs LYD price filtering/sorting in PostgreSQL before fetching the page payload', async () => {
    const { service, prisma } = setup();
    prisma.$queryRaw.mockResolvedValue([
      { id: '11111111-1111-4111-8111-111111111111', display_price: '520.00', total: 1, position: BigInt(1), is_meta: false },
      { id: null, display_price: null, total: 1, position: null, is_meta: true },
    ]);
    const result = await service.findAll({ minPrice: 500, maxPrice: 550, sort: 'price-asc', page: 1, limit: 12 }) as any;
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.product.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['11111111-1111-4111-8111-111111111111'] }, status: 'ACTIVE' } }));
    expect(result.pagination.total).toBe(1);
    expect(result.items[0].price).toBe('520.00');
  });

  it.each(['price-asc', 'price-desc'] as const)('keeps %s server-side before pagination', async (sort) => {
    const { service, prisma } = setup();
    prisma.$queryRaw.mockResolvedValue([{ id: null, display_price: null, total: 0, position: null, is_meta: true }]);
    await service.findAll({ sort, page: 1, limit: 12 });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.product.findMany).not.toHaveBeenCalled();
  });

  it('supports combined recursive category, brand, availability and LYD price constraints', async () => {
    const { service, prisma, categoryTree } = setup();
    prisma.$queryRaw.mockResolvedValue([{ id: null, display_price: null, total: 0, position: null, is_meta: true }]);
    await service.findAll({
      category: 'computers',
      brandSlug: 'hp',
      availability: 'in-stock',
      minPrice: 100,
      maxPrice: 40000,
      sort: 'price-desc',
      page: 1,
      limit: 12,
    });
    expect(categoryTree.resolveScope).toHaveBeenCalledWith('computers', { publicOnly: true });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
