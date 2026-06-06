import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { BundlesService } from './bundles.service';
import { CreateBundleDto, AddBundleItemDto } from './dto/bundle.dto';
import { UpdateBundleDto } from './dto/update-bundle.dto';

/** Public bundle endpoints */
@Controller('bundles')
export class BundlesController {
  constructor(private readonly bundlesService: BundlesService) {}

  @Get()
  findActive() {
    return this.bundlesService.findActive();
  }

  @Get('by-slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.bundlesService.findBySlug(slug);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.bundlesService.findOne(id);
  }
}

/** Admin bundle endpoints */
@Controller('admin/bundles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminBundlesController {
  constructor(private readonly bundlesService: BundlesService) {}

  @Get()
  findAll() {
    return this.bundlesService.findAll();
  }

  @Post()
  create(@Body() dto: CreateBundleDto) {
    return this.bundlesService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBundleDto,
  ) {
    return this.bundlesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.bundlesService.remove(id);
  }

  @Post(':id/items')
  addItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddBundleItemDto,
  ) {
    return this.bundlesService.addItem(id, dto);
  }

  @Delete(':id/items/:productId')
  @HttpCode(204)
  removeItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.bundlesService.removeItem(id, productId);
  }
}
