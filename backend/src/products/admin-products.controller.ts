import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../prisma/prisma-client';
import { AdminProductReviewService } from './admin-product-review.service';
import { AdminFindProductsQueryDto } from './dto/admin-find-products-query.dto';
import { AdminProductReviewQueryDto } from './dto/admin-product-review-query.dto';
import { ProductsService } from './products.service';

@Controller('admin/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly reviewService: AdminProductReviewService,
  ) {}

  @Get('review/summary')
  reviewSummary() {
    return this.reviewService.summary();
  }

  @Get('review')
  reviewList(@Query() query: AdminProductReviewQueryDto) {
    return this.reviewService.list(query);
  }

  @Get()
  findAll(@Query() query: AdminFindProductsQueryDto) {
    return this.productsService.findAllAdmin(query);
  }

  @Get(':slugOrId')
  findOne(@Param('slugOrId') slugOrId: string) {
    return this.productsService.findOneAdmin(slugOrId);
  }
}
