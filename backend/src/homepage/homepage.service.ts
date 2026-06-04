import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

import { PrismaService } from '../prisma/prisma.service';
import { HomepageBlockType, ProductStatus } from '../prisma/prisma-client';
import {
  CreateHomepageBlockDto,
  UpdateHomepageBlockDto,
} from './dto/homepage-block.dto';

const HOMEPAGE_LAYOUT_CACHE_KEY = 'homepage:layout';
const HOMEPAGE_LAYOUT_TTL_MS = 5 * 60 * 1000;

const productListSelect = {
  id: true,
  name: true,
  slug: true,
  price: true,
  baseCurrency: true,
  comparePrice: true,
  stockQty: true,
  status: true,
  brand: true,
  brandId: true,
  isFeatured: true,
  category: { select: { id: true, name: true, slug: true } },
  brandRef: { select: { id: true, name: true, slug: true, logoUrl: true } },
  images: {
    orderBy: { sortOrder: 'asc' as const },
    take: 1,
    select: { id: true, imageUrl: true, sortOrder: true },
  },
};

@Injectable()
export class HomepageService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /** Admin: list all blocks (active + inactive). */
  findAllAdmin() {
    return this.prisma.homepageBlock.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Storefront: render every active block. For each block, hydrate the
   * actual data (products / categories / brands) the block needs so the
   * frontend can render in a single round-trip.
   */
  async getLayout() {
    const cached = await this.cache.get(HOMEPAGE_LAYOUT_CACHE_KEY);
    if (cached) return cached;

    const blocks = await this.prisma.homepageBlock.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const hydrated = await Promise.all(
      blocks.map(async (block) => ({
        id: block.id,
        type: block.type,
        title: block.title,
        subtitle: block.subtitle,
        config: block.config,
        items: await this.hydrate(block),
      })),
    );

    await this.cache.set(HOMEPAGE_LAYOUT_CACHE_KEY, hydrated, HOMEPAGE_LAYOUT_TTL_MS);
    return hydrated;
  }

  private async hydrate(block: {
    type: (typeof HomepageBlockType)[keyof typeof HomepageBlockType];
    config: unknown;
  }) {
    const config = (block.config ?? {}) as {
      limit?: number;
      productIds?: string[];
      categoryIds?: string[];
      brandIds?: string[];
    };
    const limit = Math.min(Math.max(Number(config.limit) || 12, 1), 48);

    switch (block.type) {
      case 'FEATURED_CATEGORIES':
        return this.prisma.category.findMany({
          where: {
            isActive: true,
            isVisible: true,
            ...(config.categoryIds?.length
              ? { id: { in: config.categoryIds } }
              : { isFeatured: true }),
          },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          take: limit,
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
            imageUrl: true,
            description: true,
          },
        });

      case 'FEATURED_BRANDS':
        return this.prisma.brand.findMany({
          where: {
            isVisible: true,
            ...(config.brandIds?.length
              ? { id: { in: config.brandIds } }
              : { isFeatured: true }),
          },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          take: limit,
          select: { id: true, name: true, slug: true, logoUrl: true },
        });

      case 'NEW_ARRIVALS':
      case 'RECENTLY_ADDED':
        return this.prisma.product.findMany({
          where: { status: ProductStatus.ACTIVE },
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: productListSelect,
        });

      case 'BEST_SELLERS':
        return this.prisma.product.findMany({
          where: { status: ProductStatus.ACTIVE },
          orderBy: [{ salesCount: 'desc' }, { viewCount: 'desc' }],
          take: limit,
          select: productListSelect,
        });

      case 'PROMOTIONS': {
        const now = new Date();
        return this.prisma.product.findMany({
          where: {
            status: ProductStatus.ACTIVE,
            comparePrice: { not: null },
            OR: [
              { discountStartAt: null, discountEndAt: null },
              {
                AND: [
                  { OR: [{ discountStartAt: null }, { discountStartAt: { lte: now } }] },
                  { OR: [{ discountEndAt: null }, { discountEndAt: { gte: now } }] },
                ],
              },
            ],
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: productListSelect,
        });
      }

      case 'CUSTOM_PRODUCTS':
        if (!config.productIds?.length) return [];
        return this.prisma.product.findMany({
          where: { id: { in: config.productIds }, status: ProductStatus.ACTIVE },
          take: limit,
          select: productListSelect,
        });

      case 'HERO_BANNER':
      default:
        return [];
    }
  }

  async create(dto: CreateHomepageBlockDto) {
    const block = await this.prisma.homepageBlock.create({
      data: {
        type: dto.type,
        title: dto.title,
        subtitle: dto.subtitle,
        config: (dto.config ?? {}) as object,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    await this.invalidate();
    return block;
  }

  async update(id: string, dto: UpdateHomepageBlockDto) {
    const existing = await this.prisma.homepageBlock.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Homepage block not found.');
    const block = await this.prisma.homepageBlock.update({
      where: { id },
      data: {
        type: dto.type,
        title: dto.title,
        subtitle: dto.subtitle,
        config: dto.config as object | undefined,
        isActive: dto.isActive,
        sortOrder: dto.sortOrder,
      },
    });
    await this.invalidate();
    return block;
  }

  async remove(id: string) {
    const existing = await this.prisma.homepageBlock.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Homepage block not found.');
    await this.prisma.homepageBlock.delete({ where: { id } });
    await this.invalidate();
    return { message: 'Homepage block deleted.' };
  }

  async reorder(items: Array<{ id: string; sortOrder: number }>) {
    await this.prisma.$transaction(
      items.map((i) =>
        this.prisma.homepageBlock.update({
          where: { id: i.id },
          data: { sortOrder: i.sortOrder },
        }),
      ),
    );
    await this.invalidate();
    return { message: 'Homepage blocks reordered.' };
  }

  private async invalidate() {
    await this.cache.del(HOMEPAGE_LAYOUT_CACHE_KEY);
  }
}
