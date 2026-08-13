import { GUARDS_METADATA } from '@nestjs/common/constants';

import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../prisma/prisma-client';
import { AdminProductsController } from './admin-products.controller';

describe('AdminProductsController', () => {
  it('protects all admin product operations from anonymous and CUSTOMER access', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminProductsController)).toEqual([Role.ADMIN]);
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminProductsController)).toEqual([JwtAuthGuard, RolesGuard]);
  });

  it('delegates admin list, detail, review list, summary, and next item', async () => {
    const products = { findAllAdmin: jest.fn().mockResolvedValue({ items: [] }), findOneAdmin: jest.fn().mockResolvedValue({ id: 'p1' }) };
    const review = {
      list: jest.fn().mockResolvedValue({ items: [] }),
      summary: jest.fn().mockResolvedValue({ total: 1 }),
      next: jest.fn().mockResolvedValue({ item: { id: 'p2', slug: 'next-product' } }),
    };
    const reviewAudit = { markReviewed: jest.fn().mockResolvedValue({ id: 'p1' }) };
    const controller = new AdminProductsController(products as never, review as never, reviewAudit as never);
    await expect(controller.findAll({ page: 1 })).resolves.toEqual({ items: [] });
    await expect(controller.findOne('p1')).resolves.toEqual({ id: 'p1' });
    await expect(controller.reviewList({ origin: 'IMPORTED' })).resolves.toEqual({ items: [] });
    await expect(controller.reviewSummary()).resolves.toEqual({ total: 1 });
    await expect(controller.nextReviewItem('p1', { origin: 'IMPORTED' })).resolves.toEqual({ item: { id: 'p2', slug: 'next-product' } });
    expect(review.next).toHaveBeenCalledWith('p1', { origin: 'IMPORTED' });
    await expect(controller.markReviewed('p1', { user: { sub: 'admin-1' } })).resolves.toEqual({ id: 'p1' });
    expect(reviewAudit.markReviewed).toHaveBeenCalledWith('p1', 'admin-1');
  });

  it('takes reviewer identity only from the authenticated request and ignores spoofed client data', async () => {
    const products = { findOneAdmin: jest.fn().mockResolvedValue({ id: 'p1' }) };
    const reviewAudit = { markReviewed: jest.fn().mockResolvedValue({ id: 'p1' }) };
    const controller = new AdminProductsController(products as never, {} as never, reviewAudit as never);

    await (controller.markReviewed as any)('p1', { user: { sub: 'real-admin' } }, { reviewerUserId: 'attacker' });

    expect(reviewAudit.markReviewed).toHaveBeenCalledWith('p1', 'real-admin');
    expect(reviewAudit.markReviewed).not.toHaveBeenCalledWith('p1', 'attacker');
  });
});
