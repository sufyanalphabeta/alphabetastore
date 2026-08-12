import { GUARDS_METADATA } from '@nestjs/common/constants';

import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../prisma/prisma-client';
import { ProductMediaController } from './product-media.controller';

describe('ProductMediaController authorization', () => {
  it('restricts all gallery mutations to ADMIN and therefore rejects CUSTOMER access', () => {
    expect(Reflect.getMetadata(ROLES_KEY, ProductMediaController)).toEqual([Role.ADMIN]);
  });

  it('uses both authentication and role guards', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ProductMediaController)).toEqual([JwtAuthGuard, RolesGuard]);
  });
});
