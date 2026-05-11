import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Prisma } from '@prisma/client';
import type { Cache } from 'cache-manager';

import { PrismaService } from '../prisma/prisma.service';
import { ProductStatus } from '../prisma/prisma-client';
import { PricingService } from '../pricing/pricing.service';
import { StorageService } from '../storage/local-storage.service';
import { CreateProductDto } from './dto/create-product.dto';
import { FindProductsQueryDto } from './dto/find-products-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const productInclude = {
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
    },
  },
  images: {
    orderBy: {
      sortOrder: 'asc',
    },
  },
  priceHistory: {
    orderBy: { createdAt: 'desc' as const },
    take: 5,
    select: {
      id: true,
      oldBasePrice: true,
      newBasePrice: true,
      changeReason: true,
      createdAt: true,
    },
  },
} satisfies Prisma.ProductInclude;

/**
 * Minimal projection used for list responses.
 * Omits `description` and `shortDescription` – these are only needed on the
 * product detail page, fetched via findOneBySlug.
 */
const productListSelect = {
  id: true,
  name: true,
  slug: true,
  price: true,
  baseCurrency: true,
  comparePrice: true,
  discountType: true,
  discountValue: true,
  discountStartAt: true,
  discountEndAt: true,
  stockQty: true,
  status: true,
  brand: true,
  sku: true,
  createdAt: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
    },
  },
  images: {
    orderBy: {
      sortOrder: 'asc',
    },
    select: {
      id: true,
      imageUrl: true,
      sortOrder: true,
    },
  },
} satisfies Prisma.ProductSelect;

const PRODUCT_LIST_CACHE_PREFIX = 'products:list:';
const PRODUCT_DETAIL_CACHE_PREFIX = 'products:detail:';
const PRODUCT_LIST_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const PRODUCT_DETAIL_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly pricingService: PricingService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async findAll(query: FindProductsQueryDto = {}) {
    const cacheKey = `${PRODUCT_LIST_CACHE_PREFIX}${JSON.stringify(query)}`;
    const cached = await this.cacheManager.get(cacheKey);

    if (cached) {
      return cached;
    }

    const result = await this.queryProducts(query);
    await this.cacheManager.set(cacheKey, result, PRODUCT_LIST_CACHE_TTL_MS);
    await this.registerListCacheKey(cacheKey);

    return result;
  }

  private async queryProducts(query: FindProductsQueryDto) {
    const searchTerm = query.q?.trim() || query.search?.trim();
    const categoryFilter = query.category?.trim();
    const brandFilter = query.brand?.trim();
    const whereClauses: Prisma.ProductWhereInput[] = [];

    if (query.status) {
      whereClauses.push({
        status: query.status,
      });
    }

    if (brandFilter) {
      whereClauses.push({
        brand: {
          contains: brandFilter,
          mode: 'insensitive',
        },
      });
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      const priceClause: Prisma.DecimalFilter = {};
      if (query.minPrice !== undefined) priceClause.gte = query.minPrice;
      if (query.maxPrice !== undefined) priceClause.lte = query.maxPrice;
      whereClauses.push({ price: priceClause });
    }

    if (categoryFilter) {
      const categoryIds = await this.resolveCategoryIds(categoryFilter);
      const categoryConditions: Prisma.ProductWhereInput[] = [
        {
          category: {
            slug: categoryFilter,
          },
        },
      ];

      if (categoryIds.length) {
        categoryConditions.unshift({
          categoryId: {
            in: categoryIds,
          },
        });
      }

      if (UUID_PATTERN.test(categoryFilter)) {
        categoryConditions.unshift({
          categoryId: categoryFilter,
        });
      }

      whereClauses.push(
        categoryConditions.length === 1
          ? categoryConditions[0]
          : {
              OR: categoryConditions,
            },
      );
    }

    if (searchTerm) {
      whereClauses.push({
        OR: [
          {
            name: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
          {
            slug: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
          {
            description: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
          {
            shortDescription: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
          {
            category: {
              name: {
                contains: searchTerm,
                mode: 'insensitive',
              },
            },
          },
        ],
      });
    }

    const where = whereClauses.length ? { AND: whereClauses } : undefined;
    const hasPagination = Boolean(query.page || query.limit);

    if (!hasPagination) {
      return this.prisma.product.findMany({
        where,
        select: productListSelect,
        orderBy: this.buildOrderBy(query.sort),
      });
    }

    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 12, 1), 100);

    return this.findPaginated(where, page, limit, query.sort);
  }

  private async findPaginated(
    where: Prisma.ProductWhereInput | undefined,
    page: number,
    limit: number,
    sort: FindProductsQueryDto['sort'],
  ) {
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        select: productListSelect,
        orderBy: this.buildOrderBy(sort),
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  private async resolveCategoryIds(categoryFilter: string) {
    const rootCategory = await this.prisma.category.findFirst({
      where: UUID_PATTERN.test(categoryFilter)
        ? {
            OR: [{ id: categoryFilter }, { slug: categoryFilter }],
          }
        : {
            slug: categoryFilter,
          },
      select: {
        id: true,
      },
    });

    if (!rootCategory) {
      return [];
    }

    const categoryIds = new Set<string>([rootCategory.id]);
    let parentIds = [rootCategory.id];

    while (parentIds.length) {
      const children = await this.prisma.category.findMany({
        where: {
          parentId: {
            in: parentIds,
          },
        },
        select: {
          id: true,
        },
      });

      parentIds = children
        .map((category: { id: string }) => category.id)
        .filter((id: string) => !categoryIds.has(id));

      for (const id of parentIds) {
        categoryIds.add(id);
      }
    }

    return [...categoryIds];
  }

  async findOneBySlug(slugOrId: string) {
    const cacheKey = `${PRODUCT_DETAIL_CACHE_PREFIX}${slugOrId}`;
    const cached = await this.cacheManager.get(cacheKey);

    if (cached) {
      return cached;
    }

    const product = UUID_PATTERN.test(slugOrId)
      ? await this.prisma.product.findFirst({
          where: {
            OR: [{ id: slugOrId }, { slug: slugOrId }],
          },
          include: productInclude,
        })
      : await this.prisma.product.findUnique({
          where: { slug: slugOrId },
          include: productInclude,
        });

    if (!product) {
      throw new NotFoundException('Product not found.');
    }

    await this.cacheManager.set(cacheKey, product, PRODUCT_DETAIL_CACHE_TTL_MS);

    return product;
  }

  async create(createProductDto: CreateProductDto) {
    await this.ensureCategoryExists(createProductDto.categoryId);

    const slug = this.createSlug(createProductDto.slug ?? createProductDto.name);

    try {
      const product = await this.prisma.product.create({
        data: {
          categoryId: createProductDto.categoryId,
          name: createProductDto.name,
          slug,
          description: createProductDto.description,
          shortDescription: createProductDto.shortDescription,
          price: createProductDto.price,
          baseCurrency: createProductDto.baseCurrency,
          comparePrice: createProductDto.comparePrice,
          discountType: createProductDto.discountType,
          discountValue: createProductDto.discountValue,
          discountStartAt: createProductDto.discountStartAt
            ? new Date(createProductDto.discountStartAt)
            : undefined,
          discountEndAt: createProductDto.discountEndAt
            ? new Date(createProductDto.discountEndAt)
            : undefined,
          stockQty: createProductDto.stockQty,
          status: createProductDto.status ?? ProductStatus.ACTIVE,
          brand: createProductDto.brand,
          sku: createProductDto.sku,
          specs: createProductDto.specs as any,
          images: createProductDto.imageUrls?.length
            ? {
                create: createProductDto.imageUrls.map((imageUrl, index) => ({
                  imageUrl,
                  sortOrder: index,
                })),
              }
            : undefined,
        },
        include: productInclude,
      });

      await this.invalidateProductListCache();

      return product;
    } catch (error) {
      this.handleUniqueConstraint(error, 'Product slug already exists.');
      throw error;
    }
  }

  async update(id: string, updateProductDto: UpdateProductDto, changedByUserId?: string) {
    const existing = await this.ensureProductExists(id);

    if (updateProductDto.categoryId) {
      await this.ensureCategoryExists(updateProductDto.categoryId);
    }

    try {
      const product = await this.prisma.product.update({
        where: { id },
        data: {
          categoryId: updateProductDto.categoryId,
          name: updateProductDto.name,
          slug: updateProductDto.slug,
          description: updateProductDto.description,
          shortDescription: updateProductDto.shortDescription,
          price: updateProductDto.price,
          baseCurrency: updateProductDto.baseCurrency,
          comparePrice: updateProductDto.comparePrice,
          discountType: updateProductDto.discountType,
          discountValue: updateProductDto.discountValue,
          discountStartAt: updateProductDto.discountStartAt
            ? new Date(updateProductDto.discountStartAt)
            : undefined,
          discountEndAt: updateProductDto.discountEndAt
            ? new Date(updateProductDto.discountEndAt)
            : undefined,
          stockQty: updateProductDto.stockQty,
          status: updateProductDto.status,
          brand: updateProductDto.brand,
          sku: updateProductDto.sku,
          specs: updateProductDto.specs as any,
          images: updateProductDto.imageUrls
            ? {
                deleteMany: {},
                create: updateProductDto.imageUrls.map((imageUrl, index) => ({
                  imageUrl,
                  sortOrder: index,
                })),
              }
            : undefined,
        },
        include: productInclude,
      });

      await Promise.all([
        this.invalidateProductListCache(),
        this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}${id}`),
        this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}${existing.slug}`),
      ]);

      // Record price history if price changed
      if (
        updateProductDto.price !== undefined &&
        !existing.price.equals(product.price)
      ) {
        const settings = await this.pricingService.getPricingSettings();
        await this.pricingService.recordPriceHistory({
          productId: id,
          oldBasePrice: existing.price,
          newBasePrice: product.price,
          oldComparePrice: existing.comparePrice,
          newComparePrice: product.comparePrice,
          oldCurrency: existing.baseCurrency,
          newCurrency: product.baseCurrency,
          exchangeRateUsed: settings.exchangeRate,
          changeReason: 'manual_edit',
          changedByUserId: changedByUserId ?? null,
        });
      }

      return product;
    } catch (error) {
      this.handleUniqueConstraint(error, 'Product slug already exists.');
      throw error;
    }
  }

  async addImages(id: string, imageUrls: string[]) {
    const existing = await this.ensureProductExists(id);

    const imageCount = await this.prisma.productImage.count({
      where: {
        productId: id,
      },
    });

    await this.prisma.productImage.createMany({
      data: imageUrls.map((imageUrl, index) => ({
        productId: id,
        imageUrl,
        sortOrder: imageCount + index,
      })),
    });

    await Promise.all([
      this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}${id}`),
      this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}${existing.slug}`),
    ]);

    return this.prisma.product.findUniqueOrThrow({
      where: { id },
      include: productInclude,
    });
  }

  async removeImage(id: string, imageId: string) {
    const existing = await this.ensureProductExists(id);

    const productImage = await this.prisma.productImage.findFirst({
      where: {
        id: imageId,
        productId: id,
      },
      select: {
        id: true,
        imageUrl: true,
      },
    });

    if (!productImage) {
      throw new NotFoundException('Product image not found.');
    }

    await this.prisma.productImage.delete({
      where: {
        id: productImage.id,
      },
    });

    await this.storageService.deleteFile(productImage.imageUrl);
    await Promise.all([
      this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}${id}`),
      this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}${existing.slug}`),
    ]);

    return this.prisma.product.findUniqueOrThrow({
      where: { id },
      include: productInclude,
    });
  }

  async remove(id: string) {
    const existingProduct = await this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        images: {
          select: {
            imageUrl: true,
          },
        },
      },
    });

    if (!existingProduct) {
      throw new NotFoundException('Product not found.');
    }

    await this.prisma.product.delete({
      where: { id },
    });

    await Promise.all([
      ...existingProduct.images.map((image: { imageUrl: string }) =>
        this.storageService.deleteFile(image.imageUrl),
      ),
      this.invalidateProductListCache(),
      this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}${id}`),
      this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}${existingProduct.slug}`),
    ]);

    return {
      message: 'Product deleted successfully.',
    };
  }

  /**
   * Invalidates product list cache entries.
   *
   * cache-manager does not support prefix-based key deletion, so we maintain
   * a registry of active list-cache keys and delete them all on write.
   * The registry itself is stored under PRODUCT_LIST_CACHE_PREFIX + 'keys'.
   */
  private async invalidateProductListCache(): Promise<void> {
    const registryKey = `${PRODUCT_LIST_CACHE_PREFIX}keys`;
    const activeKeys = await this.cacheManager.get<string[]>(registryKey);

    if (activeKeys?.length) {
      await Promise.all(activeKeys.map((key) => this.cacheManager.del(key)));
    }

    await this.cacheManager.del(registryKey);
  }

  private async registerListCacheKey(cacheKey: string): Promise<void> {
    const registryKey = `${PRODUCT_LIST_CACHE_PREFIX}keys`;
    const existing = (await this.cacheManager.get<string[]>(registryKey)) ?? [];

    if (!existing.includes(cacheKey)) {
      await this.cacheManager.set(
        registryKey,
        [...existing, cacheKey],
        PRODUCT_LIST_CACHE_TTL_MS + 30_000, // slightly longer than the cached entries
      );
    }
  }

  private async ensureProductExists(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        price: true,
        baseCurrency: true,
        comparePrice: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found.');
    }

    return product;
  }

  private async ensureCategoryExists(categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: {
        id: true,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found.');
    }
  }

  private handleUniqueConstraint(error: unknown, message: string) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
  }

  private createSlug(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');
  }

  private buildOrderBy(sort?: FindProductsQueryDto['sort']): Prisma.ProductOrderByWithRelationInput {
    if (sort === 'asc') {
      return { price: 'asc' };
    }

    if (sort === 'desc') {
      return { price: 'desc' };
    }

    return { createdAt: 'desc' };
  }
}