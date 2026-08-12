import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';

import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../prisma/prisma-client';
import { AttachProductMediaDto } from './dto/attach-product-media.dto';
import { ReorderProductMediaDto } from './dto/reorder-product-media.dto';
import { UpdateProductMediaDto } from './dto/update-product-media.dto';
import { ProductMediaService } from './product-media.service';

@Controller('admin/products/:productId/media')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ProductMediaController {
  constructor(private readonly productMediaService: ProductMediaService) {}

  @Get()
  list(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.productMediaService.list(productId);
  }

  @Post()
  attach(@Param('productId', ParseUUIDPipe) productId: string, @Body() dto: AttachProductMediaDto) {
    return this.productMediaService.attachImage(productId, dto.mediaAssetId, dto.role);
  }

  @Patch(':productMediaId')
  update(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('productMediaId', ParseUUIDPipe) productMediaId: string,
    @Body() dto: UpdateProductMediaDto,
  ) {
    return this.productMediaService.updateRole(productId, productMediaId, dto.role);
  }

  @Delete(':productMediaId')
  remove(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('productMediaId', ParseUUIDPipe) productMediaId: string,
  ) {
    return this.productMediaService.remove(productId, productMediaId);
  }

  @Post('reorder')
  reorder(@Param('productId', ParseUUIDPipe) productId: string, @Body() dto: ReorderProductMediaDto) {
    return this.productMediaService.reorder(productId, dto.productMediaIds);
  }
}
