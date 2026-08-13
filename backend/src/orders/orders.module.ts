import { Module } from "@nestjs/common";

import { OptionalJwtAuthGuard } from "../common/guards/optional-jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { PricingModule } from "../pricing/pricing.module";
import { QueueModule } from "../queue/queue.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { ProductsModule } from "../products/products.module";

@Module({
  imports: [PricingModule, QueueModule, ProductsModule],
  controllers: [OrdersController],
  providers: [OrdersService, RolesGuard, OptionalJwtAuthGuard]
})
export class OrdersModule {}
