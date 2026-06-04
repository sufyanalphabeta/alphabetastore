import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';

import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../prisma/prisma-client';
import { StorageService } from '../storage/local-storage.service';
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

const ALLOWED_LOGO_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
const MAX_LOGO_SIZE = 2 * 1024 * 1024;

@Controller('brands')
export class BrandsController {
  constructor(
    private readonly brandsService: BrandsService,
    private readonly storageService: StorageService,
  ) {}

  @Get()
  findAll(
    @Query('visible') visible?: string,
    @Query('featured') featured?: string,
  ) {
    return this.brandsService.findAll({
      onlyVisible: visible === 'true' || visible === '1',
      onlyFeatured: featured === 'true' || featured === '1',
    });
  }

  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.brandsService.findBySlug(slug);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateBrandDto) {
    return this.brandsService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('reorder')
  reorder(@Body() body: { items: Array<{ id: string; sortOrder: number }> }) {
    return this.brandsService.reorder(body?.items ?? []);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBrandDto) {
    return this.brandsService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post(':id/logo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_LOGO_SIZE },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!ALLOWED_LOGO_EXT.has(ext)) {
          cb(new BadRequestException('Only PNG/JPG/JPEG/GIF/WEBP/SVG allowed.') as any, false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadLogo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('A logo file is required.');
    }
    const logoUrl = await this.storageService.saveFile(file.buffer, {
      subdirectory: 'brands',
      originalname: file.originalname,
    });
    return this.brandsService.update(id, { logoUrl });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.brandsService.remove(id);
  }
}
