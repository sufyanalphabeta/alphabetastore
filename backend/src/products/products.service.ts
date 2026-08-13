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
import { normalizeProductGallery } from '../media/product-gallery.mapper';
import { CreateProductDto } from './dto/create-product.dto';
import { FindProductsQueryDto } from './dto/find-products-query.dto';
import { AdminFindProductsQueryDto } from './dto/admin-find-products-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductSkuService } from './product-sku.service';
import { ProductReadinessService } from './product-readiness.service';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const productInclude = {
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      isVisible: true,
    },
  },
  brandRef: {
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
    },
  },
  images: {
    orderBy: {
      sortOrder: 'asc',
    },
  },
  media: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      mediaAsset: { select: { altText: true, variants: true } },
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
  variants: {
    orderBy: [{ isDefault: 'desc' as const }, { sortOrder: 'asc' as const }],
  },
  sourceRelations: {
    where: { target: { status: ProductStatus.ACTIVE } },
    include: {
      target: {
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          comparePrice: true,
          stockQty: true,
          ratingAvg: true,
          ratingCount: true,
          images: {
            select: { imageUrl: true },
            orderBy: { sortOrder: 'asc' as const },
            take: 1,
          },
        },
      },
    },
    orderBy: { sortOrder: 'asc' as const },
  },
} satisfies Prisma.ProductInclude;

const adminProductInclude = {
  ...productInclude,
  media: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      mediaAsset: { select: { altText: true, variants: true, processingStatus: true, originalWidth: true, originalHeight: true } },
    },
  },
  sourceIdentities: {
    orderBy: { lastImportedAt: 'desc' as const },
    select: {
      sourceSystem: true,
      externalId: true,
      sourceBarcode: true,
      lastImportedName: true,
      lastImportedPrice: true,
      lastImportedSourceCategory: true,
      lastImportedCategoryId: true,
      lastImportedAt: true,
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
  exchangeRateOverride: true,
  comparePrice: true,
  discountType: true,
  discountValue: true,
  discountStartAt: true,
  discountEndAt: true,
  stockQty: true,
  status: true,
  brand: true,
  brandId: true,
  sku: true,
  isFeatured: true,
  hasVariants: true,
  ratingAvg: true,
  ratingCount: true,
  createdAt: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
    },
  },
  brandRef: {
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
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
  media: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      id: true,
      mediaAssetId: true,
      role: true,
      sortOrder: true,
      mediaAsset: { select: { altText: true, variants: true } },
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
    private readonly productSkuService: ProductSkuService,
    private readonly productReadinessService: ProductReadinessService,
  ) {}

  async findAll(query: FindProductsQueryDto = {}) {
    // The public namespace prevents pre-P1A mixed-status cache entries from
    // being reused after deployment.
    const cacheKey = `${PRODUCT_LIST_CACHE_PREFIX}public:${JSON.stringify(query)}`;
    const cached = await this.cacheManager.get(cacheKey);

    if (cached) {
      return cached;
    }

    const result = await this.queryProducts(query);
    await this.cacheManager.set(cacheKey, result, PRODUCT_LIST_CACHE_TTL_MS);
    await this.registerListCacheKey(cacheKey);

    return result;
  }

  async findAllAdmin(query: AdminFindProductsQueryDto = {}) {
    return this.queryProducts(query, false);
  }

  private async queryProducts(query: FindProductsQueryDto | AdminFindProductsQueryDto, publicOnly = true) {
    const searchTerm = query.q?.trim() || query.search?.trim();
    const categoryFilter = query.category?.trim();
    const brandFilter = query.brand?.trim();
    const whereClauses: Prisma.ProductWhereInput[] = publicOnly ? [{ status: ProductStatus.ACTIVE }] : [];

    if (!publicOnly && 'status' in query && query.status) {
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

    if (query.brandId) {
      whereClauses.push({ brandId: query.brandId });
    }

    if (query.brandSlug) {
      whereClauses.push({ brandRef: { slug: query.brandSlug } });
    }

    if (query.featured) {
      whereClauses.push({ isFeatured: true });
    }

    if (query.inStock) {
      whereClauses.push({ stockQty: { gt: 0 } });
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
            sku: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
          {
            brand: {
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

    const hasStorefrontPriceFilter = query.minPrice !== undefined || query.maxPrice !== undefined;
    if (hasStorefrontPriceFilter) {
      const candidates = await this.prisma.product.findMany({
        where,
        select: productListSelect,
        orderBy: this.buildOrderBy(query.sort),
      });

      const pricingSettings = await this.pricingService.getPricingSettings();
      const filtered = candidates.filter(product => {
        const computed = this.pricingService.computePrice(product, pricingSettings);
        const finalPrice = computed.finalPrice.toNumber();
        return (query.minPrice === undefined || finalPrice >= query.minPrice)
          && (query.maxPrice === undefined || finalPrice <= query.maxPrice);
      });

      if (query.sort === 'asc' || query.sort === 'desc') {
        filtered.sort((left, right) => {
          const leftPrice = this.pricingService.computePrice(left, pricingSettings).finalPrice.toNumber();
          const rightPrice = this.pricingService.computePrice(right, pricingSettings).finalPrice.toNumber();
          return query.sort === 'asc' ? leftPrice - rightPrice : rightPrice - leftPrice;
        });
      }

      if (!hasPagination) return filtered.map((product) => normalizeProductGallery(product));

      const page = Math.max(Number(query.page) || 1, 1);
      const limit = Math.min(Math.max(Number(query.limit) || 12, 1), 100);
      const start = (page - 1) * limit;
      return {
        items: filtered.slice(start, start + limit).map((product) => normalizeProductGallery(product)),
        pagination: {
          page,
          limit,
          total: filtered.length,
          totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
        },
      };
    }

    if (!hasPagination) {
      const products = await this.prisma.product.findMany({
        where,
        select: productListSelect,
        orderBy: this.buildOrderBy(query.sort),
      });
      return products.map((product) => normalizeProductGallery(product));
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
      items: items.map((product) => normalizeProductGallery(product)),
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
    const cacheKey = `${PRODUCT_DETAIL_CACHE_PREFIX}public:${slugOrId}`;
    const cached = await this.cacheManager.get(cacheKey);

    if (cached) {
      return cached;
    }

    const product = UUID_PATTERN.test(slugOrId)
      ? await this.prisma.product.findFirst({
          where: {
            status: ProductStatus.ACTIVE,
            OR: [{ id: slugOrId }, { slug: slugOrId }],
          },
          include: productInclude,
        })
      : await this.prisma.product.findUnique({
          where: { slug: slugOrId, status: ProductStatus.ACTIVE },
          include: productInclude,
        });

    if (!product) {
      throw new NotFoundException('Product not found.');
    }

    const normalized = normalizeProductGallery(product);
    await this.cacheManager.set(cacheKey, normalized, PRODUCT_DETAIL_CACHE_TTL_MS);

    return normalized;
  }

  async findOneAdmin(slugOrId: string) {
    const product = UUID_PATTERN.test(slugOrId)
      ? await this.prisma.product.findFirst({
          where: { OR: [{ id: slugOrId }, { slug: slugOrId }] },
          include: adminProductInclude,
        })
      : await this.prisma.product.findUnique({ where: { slug: slugOrId }, include: adminProductInclude });

    if (!product) throw new NotFoundException('Product not found.');
    const readiness = this.productReadinessService.evaluate(product);
    const { sourceIdentities: _sourceIdentities, ...normalized } = normalizeProductGallery(product);
    const sources = product.sourceIdentities.map((source) => ({ ...source }));
    return {
      ...normalized,
      readiness,
      origin: sources.length ? 'IMPORTED' : 'MANUAL',
      sourceSystems: [...new Set(sources.map((source) => source.sourceSystem))],
      source: sources[0] ?? null,
      sources,
    };
  }

  async create(createProductDto: CreateProductDto) {
    await this.ensureCategoryExists(createProductDto.categoryId);

    const slug = this.createSlug(createProductDto.slug ?? createProductDto.name);
    const sku = await this.productSkuService.resolve(createProductDto.sku);

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
          exchangeRateOverride: createProductDto.exchangeRateOverride,
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
          brandId: createProductDto.brandId,
          sku,
          warrantyText: createProductDto.warrantyText,
          datasheetUrl: createProductDto.datasheetUrl,
          specs: createProductDto.specs as any,
          highlights: createProductDto.highlights as any,
          isFeatured: createProductDto.isFeatured ?? false,
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

      return normalizeProductGallery(product);
    } catch (error) {
      this.handleProductUniqueConstraint(error);
      throw error;
    }
  }

  async update(id: string, updateProductDto: UpdateProductDto, changedByUserId?: string) {
    const existing = await this.ensureProductExists(id);

    if (updateProductDto.imageUrls) {
      const migratedMediaCount = await this.prisma.productMedia.count({ where: { productId: id } });
      if (migratedMediaCount > 0) {
        throw new ConflictException('This product uses the Media Library gallery. Update images through ProductMedia.');
      }
    }

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
          exchangeRateOverride: updateProductDto.exchangeRateOverride,
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
          brandId: updateProductDto.brandId,
          sku: updateProductDto.sku?.trim() || undefined,
          warrantyText: updateProductDto.warrantyText,
          datasheetUrl: updateProductDto.datasheetUrl,
          specs: updateProductDto.specs as any,
          highlights: updateProductDto.highlights as any,
          isFeatured: updateProductDto.isFeatured,
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
        this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}public:${id}`),
        this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}public:${existing.slug}`),
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

      return normalizeProductGallery(product);
    } catch (error) {
      this.handleProductUniqueConstraint(error);
      throw error;
    }
  }

  async addImages(id: string, imageUrls: string[]) {
    const existing = await this.ensureProductExists(id);

    const migratedMediaCount = await this.prisma.productMedia.count({ where: { productId: id } });
    if (migratedMediaCount > 0) {
      throw new ConflictException('This product uses the Media Library gallery. Attach images through ProductMedia.');
    }

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
      this.invalidateProductListCache(),
      this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}${id}`),
      this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}${existing.slug}`),
      this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}public:${id}`),
      this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}public:${existing.slug}`),
    ]);

    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id },
      include: productInclude,
    });
    return normalizeProductGallery(product);
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
      this.invalidateProductListCache(),
      this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}${id}`),
      this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}${existing.slug}`),
      this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}public:${id}`),
      this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}public:${existing.slug}`),
    ]);

    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id },
      include: productInclude,
    });
    return normalizeProductGallery(product);
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
      this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}public:${id}`),
      this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}public:${existingProduct.slug}`),
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
        exchangeRateOverride: true,
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

  private handleProductUniqueConstraint(error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      const target = 'meta' in error && error.meta && typeof error.meta === 'object' && 'target' in error.meta
        ? String(error.meta.target)
        : '';
      throw new ConflictException(target.includes('sku') ? 'Product SKU already exists.' : 'Product slug already exists.');
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

    if (sort === 'date' || sort === 'newest') {
      return { createdAt: 'desc' };
    }

    // 'relevance' or default: newest first
    return { createdAt: 'desc' };
  }

  /** Same-category and same-brand products, excluding the source product. */
  async findRelated(productId: string, limit = 8) {
    const source = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, categoryId: true, brandId: true, status: true },
    });
    if (!source || source.status !== ProductStatus.ACTIVE) {
      throw new NotFoundException('Product not found.');
    }

    const same = await this.prisma.product.findMany({
      where: {
        id: { not: source.id },
        status: ProductStatus.ACTIVE,
        OR: [
          { categoryId: source.categoryId },
          source.brandId ? { brandId: source.brandId } : undefined,
        ].filter(Boolean) as Prisma.ProductWhereInput[],
      },
      select: productListSelect,
      orderBy: [{ salesCount: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    return same.map((product) => normalizeProductGallery(product));
  }

  async findFeatured(limit = 12) {
    const products = await this.prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE, isFeatured: true },
      select: productListSelect,
      orderBy: [{ salesCount: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
    return products.map((product) => normalizeProductGallery(product));
  }

  async findBestSellers(limit = 12) {
    const products = await this.prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE },
      select: productListSelect,
      orderBy: [{ salesCount: 'desc' }, { viewCount: 'desc' }],
      take: limit,
    });
    return products.map((product) => normalizeProductGallery(product));
  }

  async findNewArrivals(limit = 12) {
    const products = await this.prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE },
      select: productListSelect,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return products.map((product) => normalizeProductGallery(product));
  }

  /**
   * Idempotently bumps the product's viewCount and (when identifiable)
   * records a "recently viewed" entry per user/session.
   */
  async recordView(
    productId: string,
    actor: { userId?: string | null; sessionId?: string | null },
  ): Promise<void> {
    const exists = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, status: true },
    });
    if (!exists || exists.status !== ProductStatus.ACTIVE) return;

    await this.prisma.product.update({
      where: { id: productId },
      data: { viewCount: { increment: 1 } },
    });

    if (actor.userId) {
      await this.prisma.recentlyViewedItem.upsert({
        where: { userId_productId: { userId: actor.userId, productId } },
        create: { userId: actor.userId, productId },
        update: { viewedAt: new Date() },
      });
    } else if (actor.sessionId) {
      await this.prisma.recentlyViewedItem.upsert({
        where: { sessionId_productId: { sessionId: actor.sessionId, productId } },
        create: { sessionId: actor.sessionId, productId },
        update: { viewedAt: new Date() },
      });
    }
  }

  async getRecentlyViewed(
    actor: { userId?: string | null; sessionId?: string | null },
    limit = 12,
  ) {
    const where = actor.userId
      ? { userId: actor.userId }
      : actor.sessionId
      ? { sessionId: actor.sessionId, userId: null }
      : null;
    if (!where) return [];

    const rows = await this.prisma.recentlyViewedItem.findMany({
      where: { ...where, product: { status: ProductStatus.ACTIVE } },
      orderBy: { viewedAt: 'desc' },
      take: limit,
      include: { product: { select: productListSelect } },
    });
    return rows
      .map((r: { product: any }) => normalizeProductGallery(r.product))
      .filter((p) => Boolean(p));
  }

  async findByIds(ids: string[]) {
    if (!ids.length) return [];
    const rows = await this.prisma.product.findMany({
      where: { id: { in: ids }, status: ProductStatus.ACTIVE },
      select: productListSelect,
    });
    // Preserve caller's order
    const normalizedRows = rows.map((row) => normalizeProductGallery(row));
    const byId = new Map(normalizedRows.map((r: { id: string }) => [r.id, r]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
  }

  /** Single-query product counts per category (no N+1). */
  async countsByCategory(): Promise<Array<{ categoryId: string; count: number }>> {
    const rows = await this.prisma.product.groupBy({
      by: ['categoryId'],
      _count: { _all: true },
      where: { status: ProductStatus.ACTIVE },
    });
    return rows.map((r) => ({ categoryId: r.categoryId, count: r._count._all }));
  }

  /** Autocomplete: returns products, brands, categories matching a term. */
  async autocomplete(term: string, limit = 5) {
    const [products, brands, categories] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { sku: { contains: term, mode: 'insensitive' } },
            { brand: { contains: term, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          slug: true,
          sku: true,
          brand: true,
          images: { select: { id: true, imageUrl: true, sortOrder: true }, orderBy: { sortOrder: 'asc' }, take: 1 },
          media: {
            select: {
              id: true, mediaAssetId: true, role: true, sortOrder: true,
              mediaAsset: { select: { altText: true, variants: true } },
            },
            orderBy: { sortOrder: 'asc' },
          },
          price: true,
        baseCurrency: true,
        exchangeRateOverride: true,
        },
        take: limit,
        orderBy: { viewCount: 'desc' },
      }),
      this.prisma.brand.findMany({
        where: {
          isVisible: true,
          name: { contains: term, mode: 'insensitive' },
        },
        select: { id: true, name: true, slug: true, logoUrl: true },
        take: Math.ceil(limit / 2),
      }),
      this.prisma.category.findMany({
        where: {
          isVisible: true,
          isActive: true,
          name: { contains: term, mode: 'insensitive' },
        },
        select: { id: true, name: true, slug: true, icon: true },
        take: Math.ceil(limit / 2),
        orderBy: { sortOrder: 'asc' },
      }),
    ]);

    return { products: products.map((product) => normalizeProductGallery(product)), brands, categories };
  }

  /** Top searched terms by time-decayed popularity score. */
  async popularSearches(limit = 8): Promise<Array<{ term: string; hitCount: number }>> {
    const cappedLimit = Math.max(1, Math.min(limit, 20));
    const now = new Date();
    const staleBefore = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Remove stale terms that have not been searched recently.
    await this.prisma.searchTerm.deleteMany({
      where: {
        term: { not: '' },
        lastSearchedAt: { lt: staleBefore },
      },
    });

    const rows = await this.prisma.searchTerm.findMany({
      where: {
        term: { not: '' },
      },
      select: { term: true, hitCount: true, lastSearchedAt: true },
      take: 200,
    });

    return rows
      .map((row) => {
        const ageDays = Math.max(
          0,
          (now.getTime() - new Date(row.lastSearchedAt).getTime()) / (24 * 60 * 60 * 1000),
        );
        const score = row.hitCount * Math.exp(-ageDays / 30);
        return { term: row.term, hitCount: row.hitCount, score };
      })
      .filter((row) => row.score >= 0.2)
      .sort((a, b) => b.score - a.score)
      .slice(0, cappedLimit)
      .map(({ term, hitCount }) => ({ term, hitCount }));
  }

  /** Upsert a search term to increment hit count and refresh last searched timestamp. */
  async trackSearch(term: string): Promise<void> {
    const normalized = term.trim();
    if (!normalized) return;

    const now = new Date();
    await this.prisma.searchTerm.upsert({
      where: { term: normalized },
      update: { hitCount: { increment: 1 }, lastSearchedAt: now },
      create: { term: normalized, hitCount: 1, lastSearchedAt: now },
    });
  }
}
