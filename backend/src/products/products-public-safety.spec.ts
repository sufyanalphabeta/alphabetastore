import { NotFoundException } from '@nestjs/common';

import { ProductStatus } from '../prisma/prisma-client';
import { ProductsService } from './products.service';

function serviceWith(prismaOverrides: Record<string, unknown> = {}) {
  const prisma = {
    product: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      ...prismaOverrides,
    },
    recentlyViewedItem: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
    category: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    brand: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const cache = { get: jest.fn().mockResolvedValue(undefined), set: jest.fn(), del: jest.fn() };
  const pricing = { getPricingSettings: jest.fn(), computePrice: jest.fn() };
  return { service: new ProductsService(prisma as never, {} as never, pricing as never, cache as never), prisma, cache };
}

describe('ProductsService public safety', () => {
  it('uses publication-safe cache namespaces', async () => {
    const listSetup = serviceWith();
    await listSetup.service.findAll({ page: 1 });
    expect(listSetup.cache.get).toHaveBeenCalledWith('products:list:public:{"page":1}');

    const detailSetup = serviceWith();
    await expect(detailSetup.service.findOneBySlug('inactive')).rejects.toBeInstanceOf(NotFoundException);
    expect(detailSetup.cache.get).toHaveBeenCalledWith('products:detail:public:inactive');
  });

  it('forces ACTIVE for public list and ignores any untyped inactive request', async () => {
    const { service, prisma } = serviceWith();
    await service.findAll({ status: ProductStatus.INACTIVE } as never);
    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ AND: expect.arrayContaining([{ status: ProductStatus.ACTIVE }]) }),
    }));
  });

  it('keeps public search and category/brand filters under ACTIVE', async () => {
    const { service, prisma } = serviceWith();
    await service.findAll({ q: 'hp', category: 'laptops', brandId: 'brand-1' });
    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ AND: expect.arrayContaining([{ status: ProductStatus.ACTIVE }]) }),
    }));
  });

  it.each(['findFeatured', 'findBestSellers', 'findNewArrivals'] as const)('%s queries ACTIVE products only', async (method) => {
    const { service, prisma } = serviceWith();
    await service[method]();
    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: ProductStatus.ACTIVE }),
    }));
  });

  it('returns ACTIVE detail and returns 404 for an inactive/missing public detail', async () => {
    const active = { id: 'p1', slug: 'active', status: 'ACTIVE', images: [], media: [], category: {}, sourceRelations: [] };
    const activeSetup = serviceWith({ findUnique: jest.fn().mockResolvedValue(active) });
    await expect(activeSetup.service.findOneBySlug('active')).resolves.toMatchObject({ id: 'p1' });
    expect(activeSetup.prisma.product.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { slug: 'active', status: ProductStatus.ACTIVE } }));

    const inactiveSetup = serviceWith({ findUnique: jest.fn().mockResolvedValue(null) });
    await expect(inactiveSetup.service.findOneBySlug('inactive')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('filters public by-ids and category counts to ACTIVE', async () => {
    const { service, prisma } = serviceWith();
    await service.findByIds(['p1']);
    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['p1'] }, status: ProductStatus.ACTIVE } }));
    await service.countsByCategory();
    expect(prisma.product.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { status: ProductStatus.ACTIVE } }));
  });

  it('does not record views for inactive products', async () => {
    const { service, prisma } = serviceWith({ findUnique: jest.fn().mockResolvedValue({ id: 'p1', status: 'INACTIVE' }) });
    await service.recordView('p1', {});
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('invalidates public list and detail caches after deactivation', async () => {
    const existing = { id: 'p1', slug: 'item', price: { equals: () => true }, baseCurrency: 'LYD', comparePrice: null, images: [] };
    const updated = { ...existing, status: 'INACTIVE', media: [], category: {}, sourceRelations: [] };
    const { service, cache } = serviceWith({
      findUnique: jest.fn().mockResolvedValue(existing),
      update: jest.fn().mockResolvedValue(updated),
    });
    cache.get.mockResolvedValueOnce(['products:list:{}']);
    await service.update('p1', { status: ProductStatus.INACTIVE });
    expect(cache.del).toHaveBeenCalledWith('products:detail:public:p1');
    expect(cache.del).toHaveBeenCalledWith('products:detail:public:item');
    expect(cache.del).toHaveBeenCalledWith('products:list:{}');
  });
});
