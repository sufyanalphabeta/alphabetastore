import { Module } from '@nestjs/common';

import { CategoriesModule } from '../categories/categories.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { PricingModule } from '../pricing/pricing.module';
import { StorageModule } from '../storage/storage.module';
import { ProductsController } from './products.controller';
import { AdminProductsController } from './admin-products.controller';
import { AdminProductReviewService } from './admin-product-review.service';
import { ProductReadinessService } from './product-readiness.service';
import { ProductSkuService } from './product-sku.service';
import { ProductsService } from './products.service';

@Module({
  imports: [CategoriesModule, PricingModule, StorageModule],
  controllers: [ProductsController, AdminProductsController],
  providers: [ProductsService, AdminProductReviewService, ProductReadinessService, ProductSkuService, RolesGuard],
  exports: [ProductSkuService],
})
export class ProductsModule {}
