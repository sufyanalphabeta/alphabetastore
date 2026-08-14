import { Module } from '@nestjs/common';

import { RolesGuard } from '../common/guards/roles.guard';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { CategoryTreeService } from './category-tree.service';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService, CategoryTreeService, RolesGuard],
  exports: [CategoriesService, CategoryTreeService],
})
export class CategoriesModule {}
