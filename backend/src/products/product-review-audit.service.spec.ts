import { ConflictException, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

import { ProductReadinessService } from './product-readiness.service';
import { ProductReviewAuditService } from './product-review-audit.service';

function readyProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'product-1', name: 'Reviewed product', price: new Decimal(100),
    updatedAt: new Date('2026-08-13T12:00:00Z'),
    shortDescription: 'Short', description: 'Description', brandId: 'brand-1', brand: null,
    specs: { CPU: 'i7' }, warrantyText: '1 year', sku: 'AB-000001',
    category: { isActive: true, isVisible: true }, images: [{ id: 'legacy-1' }], media: [],
    sourceIdentities: [], _count: { media: 0, images: 1 },
    ...overrides,
  };
}

describe('ProductReviewAuditService', () => {
  const prisma: any = { product: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn(), findUniqueOrThrow: jest.fn() } };
  const service = new ProductReviewAuditService(prisma, new ProductReadinessService());

  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['name', 'Old', 'New'], ['price', new Decimal(100), new Decimal(101)],
    ['categoryId', 'c1', 'c2'], ['brandId', 'b1', 'b2'],
    ['specs', { CPU: 'i5' }, { CPU: 'i7' }], ['description', 'Old', 'New'],
    ['shortDescription', 'Old', 'New'], ['status', 'INACTIVE', 'ACTIVE'], ['slug', 'old', 'new'],
  ])('invalidates review when %s changes', (field, previous, next) => {
    expect(service.productUpdateInvalidates({ [field]: previous }, { [field]: next })).toBe(true);
  });

  it('does not invalidate for unchanged reviewed fields or a stock-only operational change', () => {
    const existing = { name: 'Same', price: new Decimal(100), specs: { RAM: '16GB' }, stockQty: 1, slug: 'old' };
    expect(service.productUpdateInvalidates(existing, { name: 'Same', price: 100, specs: { RAM: '16GB' } })).toBe(false);
    expect(service.productUpdateInvalidates(existing, { stockQty: 2 })).toBe(false);
  });

  it('marks a ready product reviewed even when warnings remain', async () => {
    prisma.product.findUnique.mockResolvedValue(readyProduct({ warrantyText: null }));
    prisma.product.updateMany.mockResolvedValue({ count: 1 });
    prisma.product.findUniqueOrThrow.mockResolvedValue({ id: 'product-1', catalogReviewedAt: new Date(), catalogReviewedByUserId: 'admin-1' });
    await expect(service.markReviewed('product-1', 'admin-1')).resolves.toMatchObject({ catalogReviewedByUserId: 'admin-1' });
    expect(prisma.product.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'product-1', updatedAt: new Date('2026-08-13T12:00:00Z') },
      data: { catalogReviewedAt: expect.any(Date), catalogReviewedByUserId: 'admin-1' },
    }));
  });

  it('rejects an outdated review when the product changed concurrently', async () => {
    prisma.product.findUnique.mockResolvedValue(readyProduct());
    prisma.product.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.markReviewed('product-1', 'admin-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.product.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('rejects blocked or missing products', async () => {
    prisma.product.findUnique.mockResolvedValueOnce(readyProduct({ images: [], _count: { media: 0, images: 0 } }));
    await expect(service.markReviewed('product-1', 'admin-1')).rejects.toBeInstanceOf(ConflictException);
    prisma.product.findUnique.mockResolvedValueOnce(null);
    await expect(service.markReviewed('missing', 'admin-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.product.updateMany).not.toHaveBeenCalled();
  });
});
