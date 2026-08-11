import { Body, Controller, Get, Param, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../prisma/prisma-client';
import { CatalogImportService } from './catalog-import.service';

@Controller('admin/catalog-imports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class CatalogImportController {
  constructor(private readonly service: CatalogImportService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } }))
  create(@UploadedFile() file: Express.Multer.File, @Req() request: { user: { sub: string } }) { return this.service.createPreview(file, request.user.sub); }

  @Get()
  list() { return this.service.listSessions(); }

  @Get(':id')
  find(@Param('id') id: string) { return this.service.findSession(id); }

  @Get(':id/rows')
  rows(@Param('id') id: string, @Query() query: { page?: number; pageSize?: number; status?: any }) { return this.service.findRows(id, query); }

  @Get(':id/unmapped-categories')
  unmappedCategories(@Param('id') id: string) { return this.service.listUnmappedCategories(id); }

  @Post(':id/category-mappings')
  resolveCategory(@Param('id') id: string, @Body() body: unknown) { return this.service.resolveCategory(id, body); }

  @Post(':id/apply')
  apply(@Param('id') id: string, @Req() request: { user: { sub: string } }) { return this.service.apply(id, request.user.sub); }
}
