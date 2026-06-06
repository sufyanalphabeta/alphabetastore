import { Module } from '@nestjs/common';
import { ProductRelationsService } from './product-relations.service';
import { ProductRelationsController } from './product-relations.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [PrismaModule],
  controllers: [ProductRelationsController],
  providers: [ProductRelationsService, RolesGuard],
  exports: [ProductRelationsService],
})
export class ProductRelationsModule {}
