import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Prisma } from "@prisma/client";
import type { Cache } from "cache-manager";

import { PrismaService } from "../prisma/prisma.service";
import { ProductMediaRole, ProductStatus } from "../prisma/prisma-client";
import { PricingService, type PricingSettings } from "../pricing/pricing.service";
import { StorageService } from "../storage/local-storage.service";
import { normalizeProductGallery } from "../media/product-gallery.mapper";
import { CreateProductDto } from "./dto/create-product.dto";
import { FindProductsQueryDto } from "./dto/find-products-query.dto";
import { AdminFindProductsQueryDto } from "./dto/admin-find-products-query.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductSkuService } from "./product-sku.service";
import { ProductReadinessService } from "./product-readiness.service";
import { ProductReviewAuditService } from "./product-review-audit.service";
import { calculatePurchaseAvailability } from "../inventory/purchase-quantity.policy";
import { CategoryTreeService } from "../categories/category-tree.service";
import { AttributesService } from "../attributes/attributes.service";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INTERNAL_SKU_PATTERN = /^AB-\d{6,}$/i;
const SOURCE_CODE_PATTERN = /^\*?\d{4,}\*?$/;
const MACHINE_SEARCH_PATTERN = /_|^no[-\s]?match/i;
const MAX_POPULAR_SEARCHES = 10;

function normalizeSearchTerm(term: string) {
  return term.normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, 160);
}

function isMachineSearchTerm(term: string) {
  return INTERNAL_SKU_PATTERN.test(term) || SOURCE_CODE_PATTERN.test(term) || MACHINE_SEARCH_PATTERN.test(term);
}

const productInclude = {
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      isActive: true,
      isVisible: true
    }
  },
  brandRef: {
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true
    }
  },
  images: {
    orderBy: {
      sortOrder: "asc"
    }
  },
  media: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      mediaAsset: { select: { altText: true, variants: true } }
    }
  },
  variants: {
    orderBy: [{ isDefault: "desc" as const }, { sortOrder: "asc" as const }]
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
            orderBy: { sortOrder: "asc" as const },
            take: 1
          }
        }
      }
    },
    orderBy: { sortOrder: "asc" as const }
  }
} satisfies Prisma.ProductInclude;

const adminProductInclude = {
  ...productInclude,
  attributeValues: {
    include: { attributeDefinition: true },
    orderBy: { attributeDefinition: { code: "asc" as const } }
  },
  priceHistory: {
    orderBy: { createdAt: "desc" as const },
    take: 5,
    select: {
      id: true,
      oldBasePrice: true,
      newBasePrice: true,
      changeReason: true,
      createdAt: true
    }
  },
  media: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      mediaAsset: {
        select: {
          altText: true,
          variants: true,
          processingStatus: true,
          originalWidth: true,
          originalHeight: true
        }
      }
    }
  },
  sourceIdentities: {
    orderBy: { lastImportedAt: "desc" as const },
    select: {
      sourceSystem: true,
      externalId: true,
      sourceBarcode: true,
      lastImportedName: true,
      lastImportedPrice: true,
      lastImportedSourceCategory: true,
      lastImportedCategoryId: true,
      lastImportedAt: true
    }
  },
  catalogReviewedBy: { select: { id: true, name: true } }
} satisfies Prisma.ProductInclude;

function normalizePublicProduct<T extends { images?: any[]; media?: any[] }>(product: T) {
  const {
    catalogReviewedAt: _catalogReviewedAt,
    catalogReviewedByUserId: _catalogReviewedByUserId,
    catalogReviewedBy: _catalogReviewedBy,
    ...publicProduct
  } = normalizeProductGallery(product) as ReturnType<typeof normalizeProductGallery> &
    Record<string, unknown>;
  const maxPurchaseQty = (publicProduct as any).maxPurchaseQty ?? null;
  const stockQty = Number((publicProduct as any).stockQty ?? 0);
  const variants = Array.isArray((publicProduct as any).variants)
    ? (publicProduct as any).variants.map((variant: any) => ({
        ...variant,
        ...calculatePurchaseAvailability({ stockQty: variant.stockQty, maxPurchaseQty })
      }))
    : (publicProduct as any).variants;
  return {
    ...publicProduct,
    ...calculatePurchaseAvailability({ stockQty, maxPurchaseQty }),
    ...(variants ? { variants } : {})
  };
}

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
  maxPurchaseQty: true,
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
      isActive: true
    }
  },
  brandRef: {
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true
    }
  },
  images: {
    orderBy: {
      sortOrder: "asc"
    },
    select: {
      id: true,
      imageUrl: true,
      sortOrder: true
    }
  },
  media: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      mediaAssetId: true,
      role: true,
      sortOrder: true,
      mediaAsset: { select: { altText: true, variants: true } }
    }
  }
} satisfies Prisma.ProductSelect;

const publicProductListSelect = {
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
  brand: true,
  brandId: true,
  sku: true,
  isFeatured: true,
  hasVariants: true,
  ratingAvg: true,
  ratingCount: true,
  createdAt: true,
  category: {
    select: { id: true, name: true, slug: true }
  },
  brandRef: {
    select: { id: true, name: true, slug: true, logoUrl: true }
  },
  images: {
    orderBy: { sortOrder: "asc" as const },
    take: 1,
    select: { imageUrl: true }
  },
  media: {
    where: { role: { in: [ProductMediaRole.PRIMARY, ProductMediaRole.GALLERY] } },
    orderBy: { sortOrder: "asc" as const },
    take: 1,
    select: {
      mediaAsset: {
        select: { processingStatus: true, variants: true }
      }
    }
  },
  _count: { select: { media: true } }
} satisfies Prisma.ProductSelect;

type PublicProductListRow = Prisma.ProductGetPayload<{
  select: typeof publicProductListSelect;
}>;

type PricedProductIdRow = {
  id: string | null;
  display_price: string | null;
  total: number | bigint;
  position: number | bigint | null;
  is_meta: boolean;
};

const PRODUCT_LIST_CACHE_PREFIX = "products:list:v2:";
const PRODUCT_DETAIL_CACHE_PREFIX = "products:detail:v2:";
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
    private readonly productReviewAuditService: ProductReviewAuditService,
    private readonly categoryTreeService: CategoryTreeService,
    private readonly attributesService: AttributesService
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

  private async queryProducts(
    query: FindProductsQueryDto | AdminFindProductsQueryDto,
    publicOnly = true
  ) {
    const searchTerm = query.q?.trim() || query.search?.trim();
    const categoryFilter = query.category?.trim();
    const brandFilter = query.brand?.trim();
    const categoryScope = categoryFilter
      ? await this.categoryTreeService.resolveScope(categoryFilter, { publicOnly })
      : null;
    const whereClauses: Prisma.ProductWhereInput[] = publicOnly
      ? [{ status: ProductStatus.ACTIVE }]
      : [];

    if (!publicOnly && "status" in query && query.status) {
      whereClauses.push({
        status: query.status
      });
    }

    if (brandFilter) {
      whereClauses.push({
        OR: [
          { brand: { contains: brandFilter, mode: "insensitive" } },
          { brandRef: { name: { contains: brandFilter, mode: "insensitive" } } },
          { brandRef: { slug: { equals: brandFilter, mode: "insensitive" } } }
        ]
      });
    }

    if (query.brandId) {
      whereClauses.push({ brandId: query.brandId });
    }

    if (query.brandSlug) {
      whereClauses.push({
        OR: [
          { brandRef: { slug: query.brandSlug } },
          { brand: { equals: query.brandSlug, mode: "insensitive" } }
        ]
      });
    }

    if (query.featured) {
      whereClauses.push({ isFeatured: true });
    }

    if (query.inStock || ("availability" in query && query.availability === "in-stock")) {
      whereClauses.push({ stockQty: { gt: 0 } });
    }

    if ("availability" in query && query.availability === "out-of-stock") {
      whereClauses.push({ stockQty: { lte: 0 } });
    }

    if (categoryFilter) {
      whereClauses.push({ categoryId: { in: categoryScope?.categoryIds ?? [] } });
    }

    if ("attributeFilters" in query && query.attributeFilters && Object.keys(query.attributeFilters).length) {
      if (!categoryScope) throw new ConflictException("Dynamic attribute filters require a valid category.");
      whereClauses.push(...await this.attributesService.buildProductWhere(
        categoryScope.selectedCategory.id,
        query.attributeFilters
      ));
    }

    if (searchTerm) {
      whereClauses.push({
        OR: [
          {
            name: {
              contains: searchTerm,
              mode: "insensitive"
            }
          },
          {
            slug: {
              contains: searchTerm,
              mode: "insensitive"
            }
          },
          {
            description: {
              contains: searchTerm,
              mode: "insensitive"
            }
          },
          {
            shortDescription: {
              contains: searchTerm,
              mode: "insensitive"
            }
          },
          {
            sku: {
              contains: searchTerm,
              mode: "insensitive"
            }
          },
          {
            brand: {
              contains: searchTerm,
              mode: "insensitive"
            }
          },
          {
            brandRef: {
              name: {
                contains: searchTerm,
                mode: "insensitive"
              }
            }
          },
          {
            category: {
              name: {
                contains: searchTerm,
                mode: "insensitive"
              }
            }
          }
        ]
      });
    }

    const where = whereClauses.length ? { AND: whereClauses } : undefined;
    const hasPagination = Boolean(query.page || query.limit);
    const hasStorefrontPriceFilter = query.minPrice !== undefined || query.maxPrice !== undefined;
    const hasStorefrontPriceSort = ["asc", "desc", "price-asc", "price-desc"].includes(
      query.sort ?? ""
    );

    const hasAttributeFilters = "attributeFilters" in query && Boolean(query.attributeFilters && Object.keys(query.attributeFilters).length);
    if (publicOnly && (hasStorefrontPriceFilter || hasStorefrontPriceSort) && !hasAttributeFilters) {
      return this.findPublicProductsByDisplayPrice(
        query as FindProductsQueryDto,
        categoryScope?.categoryIds ?? null
      );
    }

    if (publicOnly && hasAttributeFilters && (hasStorefrontPriceFilter || hasStorefrontPriceSort)) {
      const [candidates, pricingSettings] = await Promise.all([
        this.prisma.product.findMany({ where, select: publicProductListSelect, orderBy: this.buildOrderBy(query.sort) }),
        this.pricingService.getPricingSettings()
      ]);
      const priced = candidates.map((product) => ({
        product,
        displayPrice: this.pricingService.computePrice(product, pricingSettings).finalPrice.toNumber()
      })).filter(({ displayPrice }) =>
        (query.minPrice === undefined || displayPrice >= query.minPrice) &&
        (query.maxPrice === undefined || displayPrice <= query.maxPrice)
      );
      if (["asc", "price-asc"].includes(query.sort ?? "")) priced.sort((a, b) => a.displayPrice - b.displayPrice);
      if (["desc", "price-desc"].includes(query.sort ?? "")) priced.sort((a, b) => b.displayPrice - a.displayPrice);
      const page = Math.max(Number(query.page) || 1, 1);
      const limit = Math.min(Math.max(Number(query.limit) || 12, 1), 100);
      const selected = hasPagination ? priced.slice((page - 1) * limit, page * limit) : priced;
      const items = await this.toPublicProductListItems(selected.map(({ product }) => product), pricingSettings);
      if (!hasPagination) return items;
      return {
        items,
        pagination: { page, limit, total: priced.length, totalPages: Math.max(1, Math.ceil(priced.length / limit)) }
      };
    }

    if (!publicOnly && hasStorefrontPriceFilter) {
      const candidates = await this.prisma.product.findMany({
        where,
        select: productListSelect,
        orderBy: this.buildOrderBy(query.sort)
      });

      const pricingSettings = await this.pricingService.getPricingSettings();
      const filtered = candidates.filter((product) => {
        const computed = this.pricingService.computePrice(product, pricingSettings);
        const finalPrice = computed.finalPrice.toNumber();
        return (
          (query.minPrice === undefined || finalPrice >= query.minPrice) &&
          (query.maxPrice === undefined || finalPrice <= query.maxPrice)
        );
      });

      if (query.sort === "asc" || query.sort === "desc") {
        filtered.sort((left, right) => {
          const leftPrice = this.pricingService
            .computePrice(left, pricingSettings)
            .finalPrice.toNumber();
          const rightPrice = this.pricingService
            .computePrice(right, pricingSettings)
            .finalPrice.toNumber();
          return query.sort === "asc" ? leftPrice - rightPrice : rightPrice - leftPrice;
        });
      }

      if (!hasPagination) return filtered.map((product) => normalizeProductGallery(product));

      const page = Math.max(Number(query.page) || 1, 1);
      const limit = Math.min(Math.max(Number(query.limit) || 12, 1), 100);
      const start = (page - 1) * limit;
      return {
        items: filtered
          .slice(start, start + limit)
          .map((product) => normalizeProductGallery(product)),
        pagination: {
          page,
          limit,
          total: filtered.length,
          totalPages: Math.max(1, Math.ceil(filtered.length / limit))
        }
      };
    }

    if (!hasPagination) {
      if (!publicOnly) {
        const products = await this.prisma.product.findMany({
          where,
          select: productListSelect,
          orderBy: this.buildOrderBy(query.sort)
        });
        return products.map((product) => normalizeProductGallery(product));
      }

      const [products, pricingSettings] = await Promise.all([
        this.prisma.product.findMany({
          where,
          select: publicProductListSelect,
          orderBy: this.buildOrderBy(query.sort)
        }),
        this.pricingService.getPricingSettings()
      ]);
      return this.toPublicProductListItems(products, pricingSettings);
    }

    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 12, 1), 100);

    return this.findPaginated(where, page, limit, query.sort, publicOnly);
  }

  private async findPaginated(
    where: Prisma.ProductWhereInput | undefined,
    page: number,
    limit: number,
    sort: FindProductsQueryDto["sort"],
    publicOnly: boolean
  ) {
    if (!publicOnly) {
      const [items, total] = await Promise.all([
        this.prisma.product.findMany({
          where,
          select: productListSelect,
          orderBy: this.buildOrderBy(sort),
          skip: (page - 1) * limit,
          take: limit
        }),
        this.prisma.product.count({ where })
      ]);

      return {
        items: items.map((product) => normalizeProductGallery(product)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit))
        }
      };
    }

    const [items, total, pricingSettings] = await Promise.all([
      this.prisma.product.findMany({
        where,
        select: publicProductListSelect,
        orderBy: this.buildOrderBy(sort),
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prisma.product.count({ where }),
      this.pricingService.getPricingSettings()
    ]);

    return {
      items: await this.toPublicProductListItems(items, pricingSettings),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    };
  }

  private toPublicProductListItem(
    product: PublicProductListRow,
    pricingSettings: PricingSettings,
    summaryAttributes: Array<{ code: string; label: string; displayValue: string; sortOrder: number }> = [],
  ) {
    const computed = this.pricingService.computePrice(product, pricingSettings);
    const mediaCount = product._count.media;
    const media = product.media[0];
    const variants = (media?.mediaAsset?.variants ?? {}) as {
      card?: { url?: string };
    };
    const cardImageUrl = mediaCount > 0
      ? media?.mediaAsset?.processingStatus === "READY"
        ? variants.card?.url ?? null
        : null
      : product.images[0]?.imageUrl ?? null;

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      price: computed.finalPrice.toFixed(2),
      comparePrice: computed.hasActiveDiscount
        ? computed.displayBasePrice.toFixed(2)
        : computed.comparePrice?.toFixed(2) ?? null,
      currency: "LYD",
      storefrontPrice: {
        finalPrice: computed.finalPrice.toFixed(2),
        comparePrice: computed.hasActiveDiscount
          ? computed.displayBasePrice.toFixed(2)
          : computed.comparePrice?.toFixed(2) ?? null,
        hasActiveDiscount: computed.hasActiveDiscount,
        discountPercent: computed.discountPercent,
        currency: "LYD"
      },
      brand: product.brandRef?.name ?? product.brand ?? null,
      brandRef: product.brandRef,
      category: product.category,
      isFeatured: product.isFeatured,
      hasVariants: product.hasVariants,
      ratingAvg: product.ratingAvg,
      ratingCount: product.ratingCount,
      createdAt: product.createdAt,
      inStock: product.stockQty > 0,
      availability: product.stockQty > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
      cardImageUrl,
      summaryAttributes,
    };
  }

  private async toPublicProductListItems(
    products: PublicProductListRow[],
    pricingSettings: PricingSettings,
  ) {
    const summaries = await this.attributesService.publicSummaryAttributesForProducts(products);
    return products.map((product) => this.toPublicProductListItem(
      product,
      pricingSettings,
      summaries.get(product.id) ?? [],
    ));
  }

  private buildPublicProductSqlConditions(
    query: FindProductsQueryDto,
    categoryIds: string[] | null
  ) {
    const conditions: Prisma.Sql[] = [Prisma.sql`p.status = 'ACTIVE'::"ProductStatus"`];
    const searchTerm = query.q?.trim() || query.search?.trim();
    const brandFilter = query.brand?.trim();

    if (categoryIds !== null) {
      if (!categoryIds.length) return Prisma.sql`FALSE`;
      conditions.push(
        Prisma.sql`p.category_id::text IN (${Prisma.join(categoryIds)})`
      );
    }

    if (searchTerm) {
      const pattern = `%${searchTerm}%`;
      conditions.push(Prisma.sql`(
        p.name ILIKE ${pattern}
        OR p.slug ILIKE ${pattern}
        OR p.description ILIKE ${pattern}
        OR p.short_description ILIKE ${pattern}
        OR p.sku ILIKE ${pattern}
        OR p.brand ILIKE ${pattern}
        OR b.name ILIKE ${pattern}
        OR c.name ILIKE ${pattern}
      )`);
    }

    if (brandFilter) {
      const pattern = `%${brandFilter}%`;
      conditions.push(Prisma.sql`(
        p.brand ILIKE ${pattern}
        OR b.name ILIKE ${pattern}
        OR b.slug ILIKE ${pattern}
      )`);
    }

    if (query.brandId) {
      conditions.push(Prisma.sql`p.brand_id::text = ${query.brandId}`);
    }

    if (query.brandSlug) {
      conditions.push(
        Prisma.sql`(b.slug = ${query.brandSlug} OR LOWER(BTRIM(p.brand)) = LOWER(${query.brandSlug}))`
      );
    }

    if (query.featured) conditions.push(Prisma.sql`p.is_featured = TRUE`);
    if (query.inStock || query.availability === "in-stock") {
      conditions.push(Prisma.sql`p.stock_qty > 0`);
    }
    if (query.availability === "out-of-stock") {
      conditions.push(Prisma.sql`p.stock_qty <= 0`);
    }

    return Prisma.sql`${Prisma.join(conditions, " AND ")}`;
  }

  private buildDisplayPriceSql(settings: PricingSettings) {
    const exchangeRate = settings.exchangeRate.toNumber();
    const convertedBase = Prisma.sql`(
      CASE
        WHEN p.base_currency::text = 'USD'
          THEN p.price * COALESCE(NULLIF(p.exchange_rate_override, 0), ${exchangeRate}::numeric)
        ELSE p.price
      END
    )`;
    const convertedFixedDiscount = Prisma.sql`(
      CASE
        WHEN p.base_currency::text = 'USD'
          THEN p.discount_value * COALESCE(NULLIF(p.exchange_rate_override, 0), ${exchangeRate}::numeric)
        ELSE p.discount_value
      END
    )`;
    const discounted = Prisma.sql`(
      CASE
        WHEN p.discount_type IS NOT NULL
          AND p.discount_value IS NOT NULL
          AND p.discount_value > 0
          AND (p.discount_start_at IS NULL OR p.discount_start_at <= NOW())
          AND (p.discount_end_at IS NULL OR p.discount_end_at > NOW())
        THEN CASE
          WHEN p.discount_type::text = 'PERCENTAGE'
            THEN ${convertedBase} * (1 - LEAST(GREATEST(p.discount_value, 0), 100) / 100)
          WHEN p.discount_type::text = 'FIXED'
            THEN GREATEST(${convertedBase} - ${convertedFixedDiscount}, 0)
          ELSE ${convertedBase}
        END
        ELSE ${convertedBase}
      END
    )`;

    return settings.autoRound
      ? Prisma.sql`ROUND(${discounted}, 0)`
      : Prisma.sql`ROUND(${discounted}, 2)`;
  }

  private async findPublicProductsByDisplayPrice(
    query: FindProductsQueryDto,
    categoryIds: string[] | null
  ) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 12, 1), 100);
    const offset = (page - 1) * limit;
    const pricingSettings = await this.pricingService.getPricingSettings();
    const displayPriceSql = this.buildDisplayPriceSql(pricingSettings);
    const conditions = this.buildPublicProductSqlConditions(query, categoryIds);
    const priceConditions: Prisma.Sql[] = [];

    if (query.minPrice !== undefined) {
      priceConditions.push(Prisma.sql`display_price >= ${query.minPrice}`);
    }
    if (query.maxPrice !== undefined) {
      priceConditions.push(Prisma.sql`display_price <= ${query.maxPrice}`);
    }

    const priceWhere = priceConditions.length
      ? Prisma.sql`WHERE ${Prisma.join(priceConditions, " AND ")}`
      : Prisma.empty;
    const direction = query.sort === "desc" || query.sort === "price-desc"
      ? Prisma.sql`DESC`
      : Prisma.sql`ASC`;

    const rankedRows = await this.prisma.$queryRaw<PricedProductIdRow[]>(Prisma.sql`
      WITH priced AS (
        SELECT p.id, ${displayPriceSql} AS display_price
        FROM products p
        LEFT JOIN brands b ON b.id = p.brand_id
        INNER JOIN categories c ON c.id = p.category_id
        WHERE ${conditions}
      ),
      filtered AS (
        SELECT id, display_price
        FROM priced
        ${priceWhere}
      ),
      ranked AS (
        SELECT
          id,
          display_price,
          ROW_NUMBER() OVER (ORDER BY display_price ${direction}, id ASC) AS position
        FROM filtered
      ),
      paged AS (
        SELECT id, display_price, position
        FROM ranked
        WHERE position > ${offset} AND position <= ${offset + limit}
      ),
      meta AS (
        SELECT COUNT(*)::int AS total FROM filtered
      )
      SELECT id::text, display_price::text, meta.total, position, FALSE AS is_meta
      FROM paged CROSS JOIN meta
      UNION ALL
      SELECT NULL, NULL, total, NULL, TRUE
      FROM meta
      ORDER BY is_meta ASC, position ASC NULLS LAST
    `);

    const total = Number(rankedRows.find((row) => row.is_meta)?.total ?? 0);
    const itemRows = rankedRows.filter((row) => !row.is_meta && row.id);
    const ids = itemRows.map((row) => row.id as string);
    const products = ids.length
      ? await this.prisma.product.findMany({
          where: { id: { in: ids }, status: ProductStatus.ACTIVE },
          select: publicProductListSelect
        })
      : [];
    const byId = new Map(products.map((product) => [product.id, product]));
    const orderedProducts = ids
      .map((id) => byId.get(id))
      .filter((product): product is PublicProductListRow => Boolean(product));
    const items = await this.toPublicProductListItems(orderedProducts, pricingSettings);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    };
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
            OR: [{ id: slugOrId }, { slug: slugOrId }]
          },
          include: productInclude
        })
      : await this.prisma.product.findUnique({
          where: { slug: slugOrId, status: ProductStatus.ACTIVE },
          include: productInclude
        });

    if (!product) {
      throw new NotFoundException("Product not found.");
    }

    const [pricingSettings, categoryScope, publicAttributes] = await Promise.all([
      this.pricingService.getPricingSettings(),
      this.categoryTreeService.resolveScope(product.category.slug, { publicOnly: true }),
      this.attributesService.publicProductAttributes(product.id, product.categoryId, product.specs)
    ]);
    const normalized = normalizePublicProduct(product);
    const computed = this.pricingService.computePrice(product, pricingSettings);
    const publicComparePrice = computed.hasActiveDiscount
      ? computed.displayBasePrice
      : computed.comparePrice;
    const publicVariants = normalized.variants?.map((variant: (typeof product.variants)[number]) => {
      const variantComputed = this.pricingService.computePrice(
        { ...product, price: variant.price, comparePrice: variant.comparePrice },
        pricingSettings
      );
      const variantComparePrice = variantComputed.hasActiveDiscount
        ? variantComputed.displayBasePrice
        : variantComputed.comparePrice;

      return {
        ...variant,
        price: variantComputed.finalPrice.toFixed(2),
        comparePrice: variantComparePrice?.toFixed(2) ?? null,
        currency: "LYD",
        storefrontPrice: {
          finalPrice: variantComputed.finalPrice.toFixed(2),
          comparePrice: variantComparePrice?.toFixed(2) ?? null,
          hasActiveDiscount: variantComputed.hasActiveDiscount,
          discountPercent: variantComputed.discountPercent,
          savings: variantComputed.savings.toFixed(2),
          currency: "LYD"
        }
      };
    });
    const {
      baseCurrency: _baseCurrency,
      exchangeRateOverride: _exchangeRateOverride,
      discountType: _discountType,
      discountValue: _discountValue,
      discountStartAt: _discountStartAt,
      discountEndAt: _discountEndAt,
      ...publicDetail
    } = normalized as typeof normalized & Record<string, unknown>;
    const result = {
      ...publicDetail,
      price: computed.finalPrice.toFixed(2),
      comparePrice: publicComparePrice?.toFixed(2) ?? null,
      currency: "LYD",
      storefrontPrice: {
        finalPrice: computed.finalPrice.toFixed(2),
        comparePrice: publicComparePrice?.toFixed(2) ?? null,
        hasActiveDiscount: computed.hasActiveDiscount,
        discountPercent: computed.discountPercent,
        savings: computed.savings.toFixed(2),
        currency: "LYD"
      },
      variants: publicVariants,
      breadcrumbs: categoryScope?.breadcrumbs ?? [],
      dynamicAttributes: publicAttributes.attributes,
      comparisonAttributes: publicAttributes.comparisonAttributes,
      specs: Object.fromEntries(publicAttributes.specs.map((item) => [item.label, item.displayValue]))
    };
    await this.cacheManager.set(cacheKey, result, PRODUCT_DETAIL_CACHE_TTL_MS);

    return result;
  }

  async findOneAdmin(slugOrId: string) {
    const product = UUID_PATTERN.test(slugOrId)
      ? await this.prisma.product.findFirst({
          where: { OR: [{ id: slugOrId }, { slug: slugOrId }] },
          include: adminProductInclude
        })
      : await this.prisma.product.findUnique({
          where: { slug: slugOrId },
          include: adminProductInclude
        });

    if (!product) throw new NotFoundException("Product not found.");
    const missingRequiredAttributes = await this.attributesService.missingRequiredForProduct(product.id);
    const readiness = this.productReadinessService.evaluate({ ...product, missingRequiredAttributes });
    const {
      sourceIdentities: _sourceIdentities,
      catalogReviewedAt,
      catalogReviewedByUserId: _catalogReviewedByUserId,
      catalogReviewedBy,
      ...normalized
    } = normalizeProductGallery(product);
    const sources = product.sourceIdentities.map((source) => ({ ...source }));
    return {
      ...normalized,
      readiness,
      missingRequiredAttributes,
      origin: sources.length ? "IMPORTED" : "MANUAL",
      sourceSystems: [...new Set(sources.map((source) => source.sourceSystem))],
      source: sources[0] ?? null,
      sources,
      reviewed: Boolean(catalogReviewedAt),
      catalogReviewedAt,
      reviewedBy: catalogReviewedBy
        ? { id: catalogReviewedBy.id, name: catalogReviewedBy.name }
        : null
    };
  }

  async create(createProductDto: CreateProductDto) {
    await this.ensureCategoryExists(createProductDto.categoryId);
    const preparedAttributes = await this.attributesService.prepareValues(
      createProductDto.categoryId,
      createProductDto.attributeValues ?? []
    );

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
          maxPurchaseQty: createProductDto.maxPurchaseQty ?? null,
          status: ProductStatus.INACTIVE,
          brand: createProductDto.brand,
          brandId: createProductDto.brandId,
          sku,
          warrantyText: createProductDto.warrantyText,
          datasheetUrl: createProductDto.datasheetUrl,
          specs: createProductDto.specs as any,
          highlights: createProductDto.highlights as any,
          isFeatured: createProductDto.isFeatured ?? false,
          attributeValues: preparedAttributes.length
            ? { create: preparedAttributes }
            : undefined,
          images: createProductDto.imageUrls?.length
            ? {
                create: createProductDto.imageUrls.map((imageUrl, index) => ({
                  imageUrl,
                  sortOrder: index
                }))
              }
            : undefined
        },
        include: productInclude
      });

      await this.invalidateProductListCache();

      return normalizeProductGallery(product);
    } catch (error) {
      this.handleProductUniqueConstraint(error);
      throw error;
    }
  }

  async update(id: string, updateProductDto: UpdateProductDto, changedByUserId?: string) {
    if ("status" in updateProductDto) {
      throw new ConflictException(
        "Publication status cannot be changed through Product update. Use publish/unpublish actions."
      );
    }
    const existing = await this.ensureProductExists(id);
    const invalidateReview = this.productReviewAuditService.productUpdateInvalidates(
      existing,
      updateProductDto
    );

    if (updateProductDto.imageUrls) {
      const migratedMediaCount = await this.prisma.productMedia.count({ where: { productId: id } });
      if (migratedMediaCount > 0) {
        throw new ConflictException(
          "This product uses the Media Library gallery. Update images through ProductMedia."
        );
      }
    }

    if (updateProductDto.categoryId) {
      await this.ensureCategoryExists(updateProductDto.categoryId);
    }

    const nextCategoryId = updateProductDto.categoryId ?? existing.categoryId;
    let nextAttributes;
    if (updateProductDto.attributeValues) {
      nextAttributes = await this.attributesService.prepareValues(nextCategoryId, updateProductDto.attributeValues);
    } else if (updateProductDto.categoryId && updateProductDto.categoryId !== existing.categoryId) {
      const currentAttributes = await this.attributesService.getAdminProductAttributes(id);
      nextAttributes = await this.attributesService.prepareValues(nextCategoryId, currentAttributes.values);
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
          maxPurchaseQty: updateProductDto.maxPurchaseQty,
          brand: updateProductDto.brand,
          brandId: updateProductDto.brandId,
          sku: updateProductDto.sku?.trim() || undefined,
          warrantyText: updateProductDto.warrantyText,
          datasheetUrl: updateProductDto.datasheetUrl,
          specs: updateProductDto.specs as any,
          highlights: updateProductDto.highlights as any,
          isFeatured: updateProductDto.isFeatured,
          attributeValues: nextAttributes
            ? {
                deleteMany: {},
                create: nextAttributes
              }
            : undefined,
          ...this.productReviewAuditService.invalidationData(invalidateReview),
          images: updateProductDto.imageUrls
            ? {
                deleteMany: {},
                create: updateProductDto.imageUrls.map((imageUrl, index) => ({
                  imageUrl,
                  sortOrder: index
                }))
              }
            : undefined
        },
        include: productInclude
      });

      await Promise.all([
        this.invalidateProductListCache(),
        this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}${id}`),
        this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}${existing.slug}`),
        this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}public:${id}`),
        this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}public:${existing.slug}`)
      ]);

      // Record price history if price changed
      if (updateProductDto.price !== undefined && !existing.price.equals(product.price)) {
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
          changeReason: "manual_edit",
          changedByUserId: changedByUserId ?? null
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
      throw new ConflictException(
        "This product uses the Media Library gallery. Attach images through ProductMedia."
      );
    }

    const imageCount = await this.prisma.productImage.count({
      where: {
        productId: id
      }
    });

    await this.prisma.productImage.createMany({
      data: imageUrls.map((imageUrl, index) => ({
        productId: id,
        imageUrl,
        sortOrder: imageCount + index
      }))
    });

    await Promise.all([
      this.invalidateProductListCache(),
      this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}${id}`),
      this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}${existing.slug}`),
      this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}public:${id}`),
      this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}public:${existing.slug}`)
    ]);

    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id },
      include: productInclude
    });
    await this.productReviewAuditService.invalidate(this.prisma, id);
    return normalizeProductGallery(product);
  }

  async removeImage(id: string, imageId: string) {
    const existing = await this.ensureProductExists(id);

    const productImage = await this.prisma.productImage.findFirst({
      where: {
        id: imageId,
        productId: id
      },
      select: {
        id: true,
        imageUrl: true
      }
    });

    if (!productImage) {
      throw new NotFoundException("Product image not found.");
    }

    await this.prisma.productImage.delete({
      where: {
        id: productImage.id
      }
    });

    await this.storageService.deleteFile(productImage.imageUrl);
    await Promise.all([
      this.invalidateProductListCache(),
      this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}${id}`),
      this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}${existing.slug}`),
      this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}public:${id}`),
      this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}public:${existing.slug}`)
    ]);

    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id },
      include: productInclude
    });
    await this.productReviewAuditService.invalidate(this.prisma, id);
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
            imageUrl: true
          }
        }
      }
    });

    if (!existingProduct) {
      throw new NotFoundException("Product not found.");
    }

    await this.prisma.product.delete({
      where: { id }
    });

    await Promise.all([
      ...existingProduct.images.map((image: { imageUrl: string }) =>
        this.storageService.deleteFile(image.imageUrl)
      ),
      this.invalidateProductListCache(),
      this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}${id}`),
      this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}${existingProduct.slug}`),
      this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}public:${id}`),
      this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}public:${existingProduct.slug}`)
    ]);

    return {
      message: "Product deleted successfully."
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
        PRODUCT_LIST_CACHE_TTL_MS + 30_000 // slightly longer than the cached entries
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
        name: true,
        categoryId: true,
        description: true,
        shortDescription: true,
        discountType: true,
        discountValue: true,
        discountStartAt: true,
        discountEndAt: true,
        stockQty: true,
        maxPurchaseQty: true,
        status: true,
        brand: true,
        brandId: true,
        sku: true,
        warrantyText: true,
        datasheetUrl: true,
        specs: true,
        highlights: true,
        isFeatured: true,
        catalogReviewedAt: true
      }
    });

    if (!product) {
      throw new NotFoundException("Product not found.");
    }

    return product;
  }

  private async ensureCategoryExists(categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: {
        id: true
      }
    });

    if (!category) {
      throw new NotFoundException("Category not found.");
    }
  }

  private handleUniqueConstraint(error: unknown, message: string) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      throw new ConflictException(message);
    }
  }

  async invalidatePublicationCaches(id: string, slug: string) {
    await Promise.all([
      this.invalidateProductListCache(),
      this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}${id}`),
      this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}${slug}`),
      this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}public:${id}`),
      this.cacheManager.del(`${PRODUCT_DETAIL_CACHE_PREFIX}public:${slug}`)
    ]);
  }

  private handleProductUniqueConstraint(error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      const target =
        "meta" in error && error.meta && typeof error.meta === "object" && "target" in error.meta
          ? String(error.meta.target)
          : "";
      throw new ConflictException(
        target.includes("sku") ? "Product SKU already exists." : "Product slug already exists."
      );
    }
  }

  private createSlug(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-");
  }

  private buildOrderBy(
    sort?: FindProductsQueryDto["sort"]
  ): Prisma.ProductOrderByWithRelationInput {
    if (sort === "asc") {
      return { price: "asc" };
    }

    if (sort === "desc") {
      return { price: "desc" };
    }

    if (sort === "date" || sort === "newest") {
      return { createdAt: "desc" };
    }

    if (sort === "name-asc") {
      return { name: "asc" };
    }

    // 'relevance' or default: newest first
    return { createdAt: "desc" };
  }

  /** Same-category and same-brand products, excluding the source product. */
  async findRelated(productId: string, limit = 8) {
    const source = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, categoryId: true, brandId: true, status: true }
    });
    if (!source || source.status !== ProductStatus.ACTIVE) {
      throw new NotFoundException("Product not found.");
    }

    const [same, pricingSettings] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          id: { not: source.id },
          status: ProductStatus.ACTIVE,
          OR: [
            { categoryId: source.categoryId },
            source.brandId ? { brandId: source.brandId } : undefined
          ].filter(Boolean) as Prisma.ProductWhereInput[]
        },
        select: publicProductListSelect,
        orderBy: [{ createdAt: "desc" }],
        take: limit
      }),
      this.pricingService.getPricingSettings()
    ]);

    return this.toPublicProductListItems(same, pricingSettings);
  }

  async findFeatured(limit = 12) {
    const [products, pricingSettings] = await Promise.all([
      this.prisma.product.findMany({
        where: { status: ProductStatus.ACTIVE, isFeatured: true },
        select: publicProductListSelect,
        orderBy: { createdAt: "desc" },
        take: limit
      }),
      this.pricingService.getPricingSettings()
    ]);
    return this.toPublicProductListItems(products, pricingSettings);
  }

  async findBestSellers(limit = 12) {
    const [products, pricingSettings] = await Promise.all([
      this.prisma.product.findMany({
        where: { status: ProductStatus.ACTIVE },
        select: publicProductListSelect,
        orderBy: [{ salesCount: "desc" }, { viewCount: "desc" }],
        take: limit
      }),
      this.pricingService.getPricingSettings()
    ]);
    return this.toPublicProductListItems(products, pricingSettings);
  }

  async findNewArrivals(limit = 12) {
    const [products, pricingSettings] = await Promise.all([
      this.prisma.product.findMany({
        where: { status: ProductStatus.ACTIVE },
        select: publicProductListSelect,
        orderBy: { createdAt: "desc" },
        take: limit
      }),
      this.pricingService.getPricingSettings()
    ]);
    return this.toPublicProductListItems(products, pricingSettings);
  }

  /**
   * Idempotently bumps the product's viewCount and (when identifiable)
   * records a "recently viewed" entry per user/session.
   */
  async recordView(
    productId: string,
    actor: { userId?: string | null; sessionId?: string | null }
  ): Promise<void> {
    const exists = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, status: true }
    });
    if (!exists || exists.status !== ProductStatus.ACTIVE) return;

    await this.prisma.product.update({
      where: { id: productId },
      data: { viewCount: { increment: 1 } }
    });

    if (actor.userId) {
      await this.prisma.recentlyViewedItem.upsert({
        where: { userId_productId: { userId: actor.userId, productId } },
        create: { userId: actor.userId, productId },
        update: { viewedAt: new Date() }
      });
    } else if (actor.sessionId) {
      await this.prisma.recentlyViewedItem.upsert({
        where: { sessionId_productId: { sessionId: actor.sessionId, productId } },
        create: { sessionId: actor.sessionId, productId },
        update: { viewedAt: new Date() }
      });
    }
  }

  async getRecentlyViewed(
    actor: { userId?: string | null; sessionId?: string | null },
    limit = 12
  ) {
    const where = actor.userId
      ? { userId: actor.userId }
      : actor.sessionId
        ? { sessionId: actor.sessionId, userId: null }
        : null;
    if (!where) return [];

    const [rows, pricingSettings] = await Promise.all([
      this.prisma.recentlyViewedItem.findMany({
        where: { ...where, product: { status: ProductStatus.ACTIVE } },
        orderBy: { viewedAt: "desc" },
        take: limit,
        include: { product: { select: publicProductListSelect } }
      }),
      this.pricingService.getPricingSettings()
    ]);
    return this.toPublicProductListItems(
      rows.map((row: { product: PublicProductListRow }) => row.product),
      pricingSettings,
    );
  }

  async findByIds(ids: string[]) {
    if (!ids.length) return [];
    const [rows, pricingSettings] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: ids }, status: ProductStatus.ACTIVE },
        select: publicProductListSelect
      }),
      this.pricingService.getPricingSettings()
    ]);
    // Preserve caller's order
    const normalizedRows = await this.toPublicProductListItems(rows, pricingSettings);
    const byId = new Map(normalizedRows.map((r: { id: string }) => [r.id, r]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
  }

  /** Single-query product counts per category (no N+1). */
  async countsByCategory(): Promise<Array<{ categoryId: string; count: number }>> {
    return this.categoryTreeService.getPublicCounts();
  }

  /** Autocomplete: returns products, brands, categories matching a term. */
  async autocomplete(term: string, limit = 5) {
    const [products, brands, categories, pricingSettings] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          status: "ACTIVE",
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { sku: { contains: term, mode: "insensitive" } },
            { brand: { contains: term, mode: "insensitive" } },
            { brandRef: { name: { contains: term, mode: "insensitive" } } },
            { category: { name: { contains: term, mode: "insensitive" } } }
          ]
        },
        select: publicProductListSelect,
        take: limit,
        orderBy: { viewCount: "desc" }
      }),
      this.prisma.brand.findMany({
        where: {
          isVisible: true,
          name: { contains: term, mode: "insensitive" }
        },
        select: { id: true, name: true, slug: true, logoUrl: true },
        take: Math.ceil(limit / 2)
      }),
      this.prisma.category.findMany({
        where: {
          isVisible: true,
          isActive: true,
          name: { contains: term, mode: "insensitive" }
        },
        select: { id: true, name: true, slug: true, icon: true },
        take: Math.ceil(limit / 2),
        orderBy: { sortOrder: "asc" }
      }),
      this.pricingService.getPricingSettings()
    ]);

    return {
      products: await this.toPublicProductListItems(products, pricingSettings),
      brands,
      categories
    };
  }

  /** Top searched terms by time-decayed popularity score. */
  async popularSearches(limit = 8): Promise<Array<{ term: string; hitCount: number }>> {
    const cappedLimit = Math.max(1, Math.min(limit, MAX_POPULAR_SEARCHES));
    const now = new Date();
    const staleBefore = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Remove stale terms that have not been searched recently.
    await this.prisma.searchTerm.deleteMany({
      where: {
        term: { not: "" },
        lastSearchedAt: { lt: staleBefore }
      }
    });

    const rows = await this.prisma.searchTerm.findMany({
      where: {
        term: { not: "" }
      },
      select: { term: true, hitCount: true, lastSearchedAt: true },
      take: 200
    });

    const ranked = rows
      .filter((row) => !isMachineSearchTerm(row.term))
      .map((row) => {
        const ageDays = Math.max(
          0,
          (now.getTime() - new Date(row.lastSearchedAt).getTime()) / (24 * 60 * 60 * 1000)
        );
        const score = row.hitCount * Math.exp(-ageDays / 30);
        return { term: row.term, hitCount: row.hitCount, score };
      })
      .filter((row) => row.score >= 0.2);

    const deduplicated = new Map<string, (typeof ranked)[number]>();
    for (const row of ranked) {
      const key = row.term.toLocaleLowerCase();
      const existing = deduplicated.get(key);
      if (!existing) {
        deduplicated.set(key, row);
        continue;
      }
      existing.hitCount += row.hitCount;
      existing.score += row.score;
      if (row.term.length > existing.term.length) existing.term = row.term;
    }

    return [...deduplicated.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, cappedLimit)
      .map(({ term, hitCount }) => ({ term, hitCount }));
  }

  private async resolveTrackedSearchTerm(term: string): Promise<string | null> {
    const normalized = normalizeSearchTerm(term);
    if (normalized.length < 2) return null;

    const [exactProduct, exactBrand, exactCategory] = await Promise.all([
      this.prisma.product.findFirst({
        where: {
          status: ProductStatus.ACTIVE,
          OR: [
            { name: { equals: normalized, mode: "insensitive" } },
            { sku: { equals: normalized, mode: "insensitive" } },
            { slug: { equals: normalized, mode: "insensitive" } },
            {
              sourceIdentities: {
                some: {
                  OR: [
                    { externalId: { equals: normalized, mode: "insensitive" } },
                    { sourceBarcode: { equals: normalized, mode: "insensitive" } }
                  ]
                }
              }
            }
          ]
        },
        select: { name: true }
      }),
      this.prisma.brand.findFirst({
        where: { isVisible: true, name: { equals: normalized, mode: "insensitive" } },
        select: { name: true }
      }),
      this.prisma.category.findFirst({
        where: { isVisible: true, isActive: true, name: { equals: normalized, mode: "insensitive" } },
        select: { name: true }
      })
    ]);

    if (exactProduct) return exactProduct.name.trim();
    if (exactBrand) return exactBrand.name.trim();
    if (exactCategory) return exactCategory.name.trim();
    if (normalized.length < 3 || isMachineSearchTerm(normalized)) return null;

    const matchingProduct = await this.prisma.product.findFirst({
      where: {
        status: ProductStatus.ACTIVE,
        OR: [
          { name: { contains: normalized, mode: "insensitive" } },
          { description: { contains: normalized, mode: "insensitive" } },
          { shortDescription: { contains: normalized, mode: "insensitive" } },
          { brand: { contains: normalized, mode: "insensitive" } },
          { brandRef: { name: { contains: normalized, mode: "insensitive" } } },
          { category: { name: { contains: normalized, mode: "insensitive" } } }
        ]
      },
      select: { id: true }
    });

    return matchingProduct ? normalized.toLocaleLowerCase() : null;
  }

  /** Store only useful public catalog searches and canonicalize identifiers to product names. */
  async trackSearch(term: string): Promise<string | null> {
    const normalized = await this.resolveTrackedSearchTerm(term);
    if (!normalized) return null;

    const now = new Date();
    await this.prisma.searchTerm.upsert({
      where: { term: normalized },
      update: { hitCount: { increment: 1 }, lastSearchedAt: now },
      create: { term: normalized, hitCount: 1, lastSearchedAt: now }
    });
    return normalized;
  }
}
