import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';

import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../prisma/prisma-client';
import { BulkPriceUpdateDto } from './dto/bulk-price-update.dto';
import {
  GetPriceHistoryQueryDto,
  PreviewPriceDto,
} from './dto/get-price-history-query.dto';
import { PricingService } from './pricing.service';

@Controller()
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  /**
   * GET /pricing/preview
   * Public endpoint — preview what a price looks like in the store currency.
   */
  @Get('pricing/preview')
  previewPrice(@Query() dto: PreviewPriceDto) {
    return this.pricingService.previewPrice({
      basePrice: dto.basePrice,
      baseCurrency: dto.baseCurrency,
      discountType: dto.discountType,
      discountValue: dto.discountValue,
    });
  }

  /**
   * GET /admin/pricing/settings
   * Returns current pricing settings.
   */
  @Get('admin/pricing/settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  getSettings() {
    return this.pricingService.getPricingSettings();
  }

  /**
   * GET /admin/pricing/history
   * Admin: get price change history.
   */
  @Get('admin/pricing/history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  getPriceHistory(@Query() query: GetPriceHistoryQueryDto) {
    return this.pricingService.getPriceHistory(query);
  }

  /**
   * POST /admin/pricing/bulk
   * Admin: bulk price update across products.
   */
  @Post('admin/pricing/bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  bulkUpdate(
    @Body() dto: BulkPriceUpdateDto,
    @Request() req: { user: { userId: string } },
  ) {
    return this.pricingService.applyBulkPriceUpdate(dto, req.user.userId);
  }
}
