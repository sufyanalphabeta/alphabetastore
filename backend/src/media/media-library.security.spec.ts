import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';

import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Role } from '../prisma/prisma-client';
import { MediaLibraryController } from './media-library.controller';

describe('Media Library security contract', () => {
  it('uses the existing JWT and role guards and requires ADMIN', () => {
    const guards = Reflect.getMetadata('__guards__', MediaLibraryController) as unknown[];
    expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
    expect(Reflect.getMetadata(ROLES_KEY, MediaLibraryController)).toEqual([Role.ADMIN]);
  });

  it.each([Role.CUSTOMER, undefined])('rejects non-admin role: %s', (role) => {
    const reflector = new Reflector();
    const guard = new RolesGuard(reflector);
    const context = {
      getHandler: () => MediaLibraryController.prototype.list,
      getClass: () => MediaLibraryController,
      switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
    } as any;
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows an authenticated admin role through the existing role guard', () => {
    const guard = new RolesGuard(new Reflector());
    const context = {
      getHandler: () => MediaLibraryController.prototype.list,
      getClass: () => MediaLibraryController,
      switchToHttp: () => ({ getRequest: () => ({ user: { role: Role.ADMIN } }) }),
    } as any;
    expect(guard.canActivate(context)).toBe(true);
  });
});
