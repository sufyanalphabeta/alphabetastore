import { ConflictException, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

import { ProductReadinessService } from './product-readiness.service';
import { ProductPublicationService } from './product-publication.service';

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: 'product-1', slug: 'ready-product', status: 'INACTIVE', updatedAt: new Date('2026-08-13T12:00:00Z'),
    catalogReviewedAt: new Date('2026-08-13T11:00:00Z'), catalogReviewedByUserId: 'admin-1',
    name: 'Ready product', price: new Decimal(100), shortDescription: 'Short', description: 'Description',
    brand: null, brandId: null, specs: {}, warrantyText: null, sku: 'AB-000001',
    category: { isActive: true, isVisible: true }, images: [{ id: 'legacy-1' }], media: [],
    sourceIdentities: [], _count: { media: 0, images: 1 },
    ...overrides,
  };
}

function setup(current: any = product()) {
  const tx: any = {
    product: {
      findUnique: jest.fn().mockResolvedValue(current),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma: any = { $transaction: jest.fn((callback: any) => callback(tx)) };
  const products: any = {
    invalidatePublicationCaches: jest.fn(),
    findOneAdmin: jest.fn().mockResolvedValue({ id: current?.id, status: 'ACTIVE' }),
  };
  return { service: new ProductPublicationService(prisma, new ProductReadinessService(), products), prisma, tx, products };
}

describe('ProductPublicationService', () => {
  it('publishes a READY + REVIEWED + INACTIVE product and allows warnings', async () => {
    const { service, prisma, tx, products } = setup();
    await expect(service.publish('product-1')).resolves.toMatchObject({ status: 'ACTIVE' });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(tx.product.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'ACTIVE' } }));
    expect(products.invalidatePublicationCaches).toHaveBeenCalledWith('product-1', 'ready-product');
  });

  it('rejects READY but UNREVIEWED products', async () => {
    const { service, tx } = setup(product({ catalogReviewedAt: null, catalogReviewedByUserId: null }));
    await expect(service.publish('product-1')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.product.updateMany).not.toHaveBeenCalled();
  });

  it('rejects BLOCKED products even if stale review metadata exists', async () => {
    const { service, tx } = setup(product({ images: [], _count: { media: 0, images: 0 } }));
    await expect(service.publish('product-1')).rejects.toMatchObject({ response: expect.objectContaining({ blockers: ['MISSING_IMAGE'] }) });
    expect(tx.product.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a stale concurrent publish', async () => {
    const { service, tx } = setup();
    tx.product.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.publish('product-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('unpublishes without clearing human review metadata', async () => {
    const current = product({ status: 'ACTIVE' });
    const { service, tx, products } = setup(current);
    tx.product.findUnique.mockResolvedValue({ id: current.id, slug: current.slug, status: 'ACTIVE', updatedAt: current.updatedAt });
    products.findOneAdmin.mockResolvedValue({ id: current.id, status: 'INACTIVE', reviewed: true });
    await expect(service.unpublish('product-1')).resolves.toMatchObject({ status: 'INACTIVE', reviewed: true });
    expect(tx.product.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'INACTIVE' } }));
  });

  it('returns not found for an unknown product', async () => {
    const { service } = setup(null);
    await expect(service.publish('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
