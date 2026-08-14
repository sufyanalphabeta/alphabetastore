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
    productMedia: { count: jest.fn().mockResolvedValue(0) },
  };
  const cache = { get: jest.fn().mockResolvedValue(undefined), set: jest.fn(), del: jest.fn() };
  const pricing = { getPricingSettings: jest.fn(), computePrice: jest.fn() };
  const sku = { resolve: jest.fn().mockResolvedValue('AB-000001') };
  const readiness = { evaluate: jest.fn() };
  const reviewAudit = { productUpdateInvalidates: jest.fn().mockReturnValue(false), invalidationData: jest.fn().mockReturnValue({}) };
  const categoryTree = {
    resolveScope: jest.fn().mockResolvedValue({ categoryIds: ['category-1'] }),
    getPublicCounts: jest.fn().mockResolvedValue([]),
  };
  return { service: new ProductsService(prisma as never, {} as never, pricing as never, cache as never, sku as never, readiness as never, reviewAudit as never, categoryTree as never), prisma, cache, readiness, reviewAudit, categoryTree };
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
    const { service, prisma, categoryTree } = serviceWith();
    await service.findAll({ q: 'hp', category: 'laptops', brandId: 'brand-1' });
    expect(categoryTree.resolveScope).toHaveBeenCalledWith('laptops', { publicOnly: true });
    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ AND: expect.arrayContaining([
        { status: ProductStatus.ACTIVE },
        { categoryId: { in: ['category-1'] } },
      ]) }),
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
    const active = { id: 'p1', slug: 'active', status: 'ACTIVE', images: [], media: [], category: {}, sourceRelations: [], catalogReviewedAt: new Date(), catalogReviewedByUserId: 'admin-1' };
    const activeSetup = serviceWith({ findUnique: jest.fn().mockResolvedValue(active) });
    const publicProduct = await activeSetup.service.findOneBySlug('active');
    expect(publicProduct).toMatchObject({ id: 'p1' });
    expect(publicProduct).not.toHaveProperty('catalogReviewedAt');
    expect(publicProduct).not.toHaveProperty('catalogReviewedByUserId');
    expect(activeSetup.prisma.product.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { slug: 'active', status: ProductStatus.ACTIVE } }));

    const inactiveSetup = serviceWith({ findUnique: jest.fn().mockResolvedValue(null) });
    await expect(inactiveSetup.service.findOneBySlug('inactive')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns source snapshots and readiness only from the ADMIN detail contract', async () => {
    const imported = {
      id: 'p1', slug: 'imported', status: 'INACTIVE', name: 'Store name', price: 120,
      images: [], media: [], category: { id: 'c1', name: 'Laptops' }, brandRef: null,
      sourceRelations: [], sourceIdentities: [{ sourceSystem: 'RAKIZA', externalId: '5500029', sourceBarcode: '*5500029*', lastImportedName: 'Source name', lastImportedPrice: 100 }],
    };
    const setup = serviceWith({ findUnique: jest.fn().mockResolvedValue(imported) });
    setup.readiness.evaluate.mockReturnValue({ readyToPublish: false, blockers: ['MISSING_IMAGE'], warnings: [] });

    const result = await setup.service.findOneAdmin('imported');
    expect(result).toMatchObject({
      origin: 'IMPORTED',
      source: { sourceSystem: 'RAKIZA', externalId: '5500029', sourceBarcode: '*5500029*' },
      readiness: { readyToPublish: false, blockers: ['MISSING_IMAGE'] },
    });
    expect(result).not.toHaveProperty('sourceIdentities');
    expect(setup.prisma.product.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({ sourceIdentities: expect.any(Object) }),
    }));
  });

  it('returns only safe human-review metadata from the ADMIN detail contract', async () => {
    const reviewedAt = new Date('2026-08-13T12:00:00Z');
    const reviewed = {
      id: 'p1', slug: 'reviewed', status: 'ACTIVE', name: 'Reviewed', price: 120,
      images: [], media: [], category: { id: 'c1', name: 'Laptops' }, brandRef: null,
      sourceRelations: [], sourceIdentities: [], catalogReviewedAt: reviewedAt,
      catalogReviewedByUserId: 'admin-1',
      catalogReviewedBy: { id: 'admin-1', name: 'Admin', email: 'private@example.com', passwordHash: 'secret' },
    };
    const setup = serviceWith({ findUnique: jest.fn().mockResolvedValue(reviewed) });
    setup.readiness.evaluate.mockReturnValue({ readyToPublish: true, blockers: [], warnings: [] });

    const result = await setup.service.findOneAdmin('reviewed');

    expect(result).toMatchObject({ reviewed: true, catalogReviewedAt: reviewedAt, reviewedBy: { id: 'admin-1', name: 'Admin' } });
    expect(result).not.toHaveProperty('catalogReviewedByUserId');
    expect(result.reviewedBy).not.toHaveProperty('email');
    expect(result.reviewedBy).not.toHaveProperty('passwordHash');
  });

  it('filters public by-ids and category counts to ACTIVE', async () => {
    const { service, prisma, categoryTree } = serviceWith();
    await service.findByIds(['p1']);
    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['p1'] }, status: ProductStatus.ACTIVE } }));
    await service.countsByCategory();
    expect(categoryTree.getPublicCounts).toHaveBeenCalled();
  });

  it('does not record views for inactive products', async () => {
    const { service, prisma } = serviceWith({ findUnique: jest.fn().mockResolvedValue({ id: 'p1', status: 'INACTIVE' }) });
    await service.recordView('p1', {});
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('invalidates public list and detail caches after a publication transition', async () => {
    const { service, cache } = serviceWith();
    cache.get.mockResolvedValueOnce(['products:list:{}']);
    await service.invalidatePublicationCaches('p1', 'item');
    expect(cache.del).toHaveBeenCalledWith('products:detail:public:p1');
    expect(cache.del).toHaveBeenCalledWith('products:detail:public:item');
    expect(cache.del).toHaveBeenCalledWith('products:list:{}');
  });

  it('clears the human review audit when a meaningful product field changes', async () => {
    const existing = { id: 'p1', slug: 'item', name: 'Old name', price: 100, images: [] };
    const updated = { ...existing, name: 'New name', media: [], category: {}, sourceRelations: [] };
    const { service, prisma, reviewAudit } = serviceWith({
      findUnique: jest.fn().mockResolvedValue(existing),
      update: jest.fn().mockResolvedValue(updated),
    });
    reviewAudit.productUpdateInvalidates.mockReturnValue(true);
    reviewAudit.invalidationData.mockReturnValue({ catalogReviewedAt: null, catalogReviewedByUserId: null });

    await service.update('p1', { name: 'New name' });

    expect(prisma.product.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ catalogReviewedAt: null, catalogReviewedByUserId: null }),
    }));
  });

  it('preserves the human review audit for an unchanged or harmless product update', async () => {
    const existing = { id: 'p1', slug: 'item', name: 'Same name', stockQty: 2, price: 100, images: [] };
    const updated = { ...existing, stockQty: 3, media: [], category: {}, sourceRelations: [] };
    const { service, prisma, reviewAudit } = serviceWith({
      findUnique: jest.fn().mockResolvedValue(existing),
      update: jest.fn().mockResolvedValue(updated),
    });

    await service.update('p1', { name: 'Same name', stockQty: 3 });

    expect(reviewAudit.productUpdateInvalidates).toHaveBeenCalledWith(existing, { name: 'Same name', stockQty: 3 });
    expect(prisma.product.update.mock.calls[0][0].data).not.toHaveProperty('catalogReviewedAt');
    expect(prisma.product.update.mock.calls[0][0].data).not.toHaveProperty('catalogReviewedByUserId');
  });
});
