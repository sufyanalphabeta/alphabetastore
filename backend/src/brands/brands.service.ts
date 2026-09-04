import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

import { PrismaService } from '../prisma/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

const BRANDS_CACHE_KEY = 'brands:all';
const BRANDS_VISIBLE_CACHE_KEY = 'brands:visible';
const BRANDS_FEATURED_CACHE_KEY = 'brands:featured';
const BRANDS_CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class BrandsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async findAll(opts: { onlyVisible?: boolean; onlyFeatured?: boolean } = {}) {
    const cacheKey = opts.onlyFeatured
      ? BRANDS_FEATURED_CACHE_KEY
      : opts.onlyVisible
      ? BRANDS_VISIBLE_CACHE_KEY
      : BRANDS_CACHE_KEY;

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const brands = await this.prisma.brand.findMany({
      where: opts.onlyFeatured
        ? { isVisible: true, isFeatured: true }
        : opts.onlyVisible
        ? { isVisible: true }
        : undefined,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    // Annotate with product counts.
    const counts = await this.prisma.product.groupBy({
      by: ['brandId'],
      _count: { _all: true },
      where: { brandId: { in: brands.map((b) => b.id) }, status: 'ACTIVE' },
    });
    const countMap = new Map(counts.map((c) => [c.brandId, c._count._all]));

    const result = brands.map((b) => ({
      ...b,
      productCount: countMap.get(b.id) ?? 0,
    }));

    await this.cache.set(cacheKey, result, BRANDS_CACHE_TTL_MS);
    return result;
  }

  async findBySlug(slug: string) {
    const brand = await this.prisma.brand.findUnique({ where: { slug } });
    if (!brand) {
      throw new NotFoundException('Brand not found.');
    }
    return brand;
  }

  async create(dto: CreateBrandDto) {
    try {
      const brand = await this.prisma.brand.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          logoUrl: dto.logoUrl,
          bannerUrl: dto.bannerUrl,
          description: dto.description,
          metaTitle: dto.metaTitle,
          metaDesc: dto.metaDesc,
          isVisible: dto.isVisible ?? true,
          isFeatured: dto.isFeatured ?? false,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
      await this.invalidate();
      return brand;
    } catch (err) {
      this.translateUnique(err);
      throw err;
    }
  }

  async update(id: string, dto: UpdateBrandDto) {
    const existing = await this.prisma.brand.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Brand not found.');

    try {
      const brand = await this.prisma.brand.update({
        where: { id },
        data: {
          name: dto.name,
          slug: dto.slug,
          logoUrl: dto.logoUrl,
          bannerUrl: dto.bannerUrl,
          description: dto.description,
          metaTitle: dto.metaTitle,
          metaDesc: dto.metaDesc,
          isVisible: dto.isVisible,
          isFeatured: dto.isFeatured,
          sortOrder: dto.sortOrder,
        },
      });
      await this.invalidate();
      return brand;
    } catch (err) {
      this.translateUnique(err);
      throw err;
    }
  }

  async remove(id: string) {
    const existing = await this.prisma.brand.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Brand not found.');
    // Detach products (FK is SET NULL on delete) — Prisma handles this via the
    // relational onDelete; product.brandId becomes null automatically.
    await this.prisma.brand.delete({ where: { id } });
    await this.invalidate();
    return { message: 'Brand deleted successfully.' };
  }

  async reorder(items: Array<{ id: string; sortOrder: number }>) {
    await this.prisma.$transaction(
      items.map((i) =>
        this.prisma.brand.update({
          where: { id: i.id },
          data: { sortOrder: i.sortOrder },
        }),
      ),
    );
    await this.invalidate();
    return { message: 'Brands reordered.' };
  }

  private async invalidate() {
    await Promise.all([
      this.cache.del(BRANDS_CACHE_KEY),
      this.cache.del(BRANDS_VISIBLE_CACHE_KEY),
      this.cache.del(BRANDS_FEATURED_CACHE_KEY),
      // Featured-brand homepage blocks embed logoUrl and must not retain the
      // previous logo after an admin upload or media-library selection.
      this.cache.del('homepage:layout'),
    ]);
  }

  private translateUnique(err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      throw new ConflictException('Brand slug already exists.');
    }
  }
}
