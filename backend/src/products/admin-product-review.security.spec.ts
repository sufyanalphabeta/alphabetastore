import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../prisma/prisma-client';
import { AdminProductsController } from './admin-products.controller';

describe('Admin product review security contract', () => {
  it('requires JWT authentication before ADMIN authorization', () => {
    expect(Reflect.getMetadata('__guards__', AdminProductsController)).toEqual([JwtAuthGuard, RolesGuard]);
    expect(Reflect.getMetadata(ROLES_KEY, AdminProductsController)).toEqual([Role.ADMIN]);
  });

  it.each([Role.CUSTOMER, undefined])('rejects non-admin or missing identity: %s', (role) => {
    const guard = new RolesGuard(new Reflector());
    const context = {
      getHandler: () => AdminProductsController.prototype.markReviewed,
      getClass: () => AdminProductsController,
      switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
    } as any;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows an authenticated ADMIN role', () => {
    const guard = new RolesGuard(new Reflector());
    const context = {
      getHandler: () => AdminProductsController.prototype.markReviewed,
      getClass: () => AdminProductsController,
      switchToHttp: () => ({ getRequest: () => ({ user: { role: Role.ADMIN } }) }),
    } as any;

    expect(guard.canActivate(context)).toBe(true);
  });
});
