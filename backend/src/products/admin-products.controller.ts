import { Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';

import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../prisma/prisma-client';
import { AdminProductReviewService } from './admin-product-review.service';
import { AdminFindProductsQueryDto } from './dto/admin-find-products-query.dto';
import { AdminProductReviewQueryDto } from './dto/admin-product-review-query.dto';
import { ProductsService } from './products.service';
import { ProductReviewAuditService } from './product-review-audit.service';
import { ProductPublicationService } from './product-publication.service';

@Controller('admin/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly reviewService: AdminProductReviewService,
    private readonly reviewAuditService: ProductReviewAuditService,
    private readonly publicationService: ProductPublicationService,
  ) {}

  @Get('review/summary')
  reviewSummary() {
    return this.reviewService.summary();
  }

  @Post(':id/publish')
  publish(@Param('id', ParseUUIDPipe) id: string) {
    return this.publicationService.publish(id);
  }

  @Post(':id/unpublish')
  unpublish(@Param('id', ParseUUIDPipe) id: string) {
    return this.publicationService.unpublish(id);
  }

  @Get('review')
  reviewList(@Query() query: AdminProductReviewQueryDto) {
    return this.reviewService.list(query);
  }

  @Get('review/next/:currentProductId')
  nextReviewItem(@Param('currentProductId') currentProductId: string, @Query() query: AdminProductReviewQueryDto) {
    return this.reviewService.next(currentProductId, query);
  }

  @Post(':id/review')
  async markReviewed(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: { user: { sub: string } },
  ) {
    await this.reviewAuditService.markReviewed(id, request.user.sub);
    return this.productsService.findOneAdmin(id);
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
