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
  Request,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';

import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../prisma/prisma-client';
import { StorageService } from '../storage/local-storage.service';
import { CreateProductDto } from './dto/create-product.dto';
import { FindProductsQueryDto } from './dto/find-products-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

const MAX_PRODUCT_IMAGE_FILES = 10;
const MAX_PRODUCT_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);

function productImageFileFilter(
  _request: unknown,
  file: { mimetype: string; originalname: string },
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  const extension = extname(file.originalname).toLowerCase();

  if (!file.mimetype.startsWith('image/') || !ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
    callback(
      new BadRequestException(
        'Only PNG, JPG, JPEG, GIF, and WEBP image files are allowed.',
      ) as unknown as Error,
      false,
    );
    return;
  }

  callback(null, true);
}

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly storageService: StorageService,
  ) {}

  @Get()
  findAll(@Query() query: FindProductsQueryDto) {
    return this.productsService.findAll(query);
  }

  @Get('featured')
  findFeatured(@Query('limit') limit?: string) {
    return this.productsService.findFeatured(limit ? Number(limit) : undefined);
  }

  @Get('best-sellers')
  findBestSellers(@Query('limit') limit?: string) {
    return this.productsService.findBestSellers(limit ? Number(limit) : undefined);
  }

  @Get('new-arrivals')
  findNewArrivals(@Query('limit') limit?: string) {
    return this.productsService.findNewArrivals(limit ? Number(limit) : undefined);
  }

  @Get('recently-viewed')
  findRecentlyViewed(
    @Request() req: { user?: { userId?: string }; headers: Record<string, string | undefined> },
    @Query('sessionId') sessionId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.productsService.getRecentlyViewed(
      {
        userId: req.user?.userId ?? null,
        sessionId: sessionId ?? req.headers['x-session-id'] ?? null,
      },
      limit ? Number(limit) : undefined,
    );
  }

  @Get('by-ids')
  findByIds(@Query('ids') ids?: string) {
    const list = (ids ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    return this.productsService.findByIds(list);
  }

  @Get('counts-by-category')
  countsByCategory() {
    return this.productsService.countsByCategory();
  }

  @Get('autocomplete')
  autocomplete(@Query('q') q?: string, @Query('limit') limit?: string) {
    const term = (q ?? '').trim();
    if (!term) return { products: [], brands: [], categories: [] };
    return this.productsService.autocomplete(term, limit ? Math.min(Number(limit) || 5, 10) : 5);
  }

  @Get('popular-searches')
  popularSearches(@Query('limit') limit?: string) {
    return this.productsService.popularSearches(limit ? Math.min(Number(limit) || 8, 10) : 8);
  }

  @Post('track-search')
  async trackSearch(@Body() body: { term?: string }) {
    const term = (body?.term ?? '').trim().slice(0, 160);
    if (term.length < 2) return { ok: false };
    const trackedTerm = await this.productsService.trackSearch(term);
    return { ok: Boolean(trackedTerm), term: trackedTerm };
  }

  @Get(':slugOrId/related')
  async findRelated(
    @Param('slugOrId') slugOrId: string,
    @Query('limit') limit?: string,
  ) {
    const product = (await this.productsService.findOneBySlug(slugOrId)) as { id: string };
    return this.productsService.findRelated(product.id, limit ? Number(limit) : undefined);
  }

  @Post(':id/view')
  recordView(
    @Param('id') id: string,
    @Request() req: { user?: { userId?: string }; headers: Record<string, string | undefined> },
    @Body() body: { sessionId?: string } = {},
  ) {
    return this.productsService
      .recordView(id, {
        userId: req.user?.userId ?? null,
        sessionId: body.sessionId ?? req.headers['x-session-id'] ?? null,
      })
      .then(() => ({ ok: true }));
  }

  @Get(':slugOrId')
  findOne(@Param('slugOrId') slugOrId: string) {
    return this.productsService.findOneBySlug(slugOrId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post(':id/images')
  @UseInterceptors(
    FilesInterceptor('files', MAX_PRODUCT_IMAGE_FILES, {
      storage: memoryStorage(),
      fileFilter: productImageFileFilter,
      limits: {
        fileSize: MAX_PRODUCT_IMAGE_SIZE,
      },
    }),
  )
  async uploadImages(
    @Param('id') id: string,
    @UploadedFiles() files: Array<Express.Multer.File> | undefined,
  ) {
    if (!files?.length) {
      throw new BadRequestException('At least one image file is required.');
    }

    const imageUrls = await Promise.all(
      files.map((file) =>
        this.storageService.saveFile(file.buffer, {
          subdirectory: 'products',
          originalname: file.originalname,
        }),
      ),
    );

    return this.productsService.addImages(id, imageUrls);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @Request() req: { user?: { userId?: string } },
  ) {
    return this.productsService.update(id, updateProductDto, req.user?.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id/images/:imageId')
  removeImage(@Param('id') id: string, @Param('imageId') imageId: string) {
    return this.productsService.removeImage(id, imageId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
