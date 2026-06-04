import { Module } from '@nestjs/common';

import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { PricingModule } from '../pricing/pricing.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({
  imports: [PricingModule],
  controllers: [CartController],
  providers: [CartService, OptionalJwtAuthGuard],
  exports: [CartService],
})
export class CartModule {}