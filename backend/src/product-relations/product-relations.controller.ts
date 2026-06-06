import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ProductRelationsService } from './product-relations.service';
import { CreateRelationDto, ProductRelationType } from './dto/create-relation.dto';

@Controller('products/:productId/relations')
export class ProductRelationsController {
  constructor(private readonly relationsService: ProductRelationsService) {}

  /** Public: all relations grouped by type */
  @Get()
  findAll(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.relationsService.findRelatedGrouped(productId);
  }

  /** Admin: add a relation */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  create(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: CreateRelationDto,
  ) {
    return this.relationsService.create(productId, dto);
  }

  /** Admin: remove a relation */
  @Delete(':targetId')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  remove(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('targetId', ParseUUIDPipe) targetId: string,
    @Query('type') relationType: ProductRelationType,
  ) {
    return this.relationsService.remove(productId, targetId, relationType);
  }
}
