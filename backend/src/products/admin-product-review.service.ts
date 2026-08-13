import { Injectable } from '@nestjs/common';
import { MediaProcessingStatus, Prisma, ProductMediaRole } from '@prisma/client';

import { MEDIA_LOW_RESOLUTION_THRESHOLD } from '../media/media.constants';
import type { MediaVariants } from '../media/media.types';
import { PrismaService } from '../prisma/prisma.service';
import { AdminProductReviewQueryDto } from './dto/admin-product-review-query.dto';
import { ProductReadinessService } from './product-readiness.service';

const PLACEHOLDER_URL = '/assets/images/products/alphabeta-product-placeholder.svg';

const missingImageWhere: Prisma.ProductWhereInput = {
  OR: [
    { media: { none: {} }, images: { none: {} } },
    {
      media: { some: {} },
      NOT: {
        media: {
          some: {
            role: ProductMediaRole.PRIMARY,
            mediaAsset: { processingStatus: MediaProcessingStatus.READY },
          },
        },
      },
    },
  ],
};

const invalidCategoryWhere: Prisma.ProductWhereInput = {
  OR: [{ category: { is: { isActive: false } } }, { category: { is: { isVisible: false } } }],
};

const invalidPriceWhere: Prisma.ProductWhereInput = { price: { lte: 0 } };
const invalidNameWhere: Prisma.ProductWhereInput = { name: '' };
const blockedWhere: Prisma.ProductWhereInput = {
  OR: [invalidNameWhere, invalidPriceWhere, invalidCategoryWhere, missingImageWhere],
};

const reviewSelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
  price: true,
  baseCurrency: true,
  shortDescription: true,
  description: true,
  brand: true,
  brandId: true,
  specs: true,
  warrantyText: true,
  sku: true,
  updatedAt: true,
  category: { select: { id: true, name: true, slug: true, isActive: true, isVisible: true } },
  brandRef: { select: { id: true, name: true, slug: true } },
  images: { select: { imageUrl: true }, orderBy: { sortOrder: 'asc' as const }, take: 1 },
  media: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      role: true,
      mediaAsset: {
        select: {
          processingStatus: true,
          originalWidth: true,
          originalHeight: true,
          variants: true,
        },
      },
    },
  },
  sourceIdentities: {
    select: {
      sourceSystem: true,
      externalId: true,
      sourceBarcode: true,
      lastImportedName: true,
      lastImportedAt: true,
    },
  },
  _count: { select: { media: true, images: true } },
} satisfies Prisma.ProductSelect;

@Injectable()
export class AdminProductReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly readinessService: ProductReadinessService,
  ) {}

  async list(query: AdminProductReviewQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildWhere(query);
    const orderBy = this.buildOrderBy(query.sort);

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        select: reviewSelect,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    const items = products.map((product) => this.toListItem(product));

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async summary() {
    const missingBrand: Prisma.ProductWhereInput = { brandId: null, OR: [{ brand: null }, { brand: '' }] };
    const missingSpecs: Prisma.ProductWhereInput = {
      OR: [{ specs: { equals: Prisma.DbNull } }, { specs: { equals: {} } }],
    };

    const [
      total, active, inactive, imported, manual, blocked, ready,
      missingImage, missingBrandCount, missingSpecsCount, invalidPrice, invalidCategory,
    ] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.product.count({ where: { status: 'ACTIVE' } }),
      this.prisma.product.count({ where: { status: 'INACTIVE' } }),
      this.prisma.product.count({ where: { sourceIdentities: { some: {} } } }),
      this.prisma.product.count({ where: { sourceIdentities: { none: {} } } }),
      this.prisma.product.count({ where: blockedWhere }),
      this.prisma.product.count({ where: { NOT: blockedWhere } }),
      this.prisma.product.count({ where: missingImageWhere }),
      this.prisma.product.count({ where: missingBrand }),
      this.prisma.product.count({ where: missingSpecs }),
      this.prisma.product.count({ where: invalidPriceWhere }),
      this.prisma.product.count({ where: invalidCategoryWhere }),
    ]);

    return {
      total, active, inactive, imported, manual, blocked, ready,
      missingImage, missingBrand: missingBrandCount, missingSpecs: missingSpecsCount,
      invalidPrice, invalidCategory,
    };
  }

  private buildWhere(query: AdminProductReviewQueryDto): Prisma.ProductWhereInput {
    const and: Prisma.ProductWhereInput[] = [];
    if (query.status) and.push({ status: query.status });
    if (query.origin === 'IMPORTED') and.push({ sourceIdentities: { some: {} } });
    if (query.origin === 'MANUAL') and.push({ sourceIdentities: { none: {} } });
    if (query.sourceSystem) and.push({ sourceIdentities: { some: { sourceSystem: query.sourceSystem } } });
    if (query.categoryId) and.push({ categoryId: query.categoryId });
    if (query.brandId) and.push({ brandId: query.brandId });
    if (query.readiness === 'BLOCKED') and.push(blockedWhere);
    if (query.readiness === 'READY') and.push({ NOT: blockedWhere });
    if (query.issue) and.push(this.issueWhere(query.issue));
    if (query.q?.trim()) {
      const term = query.q.trim();
      and.push({
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { slug: { contains: term, mode: 'insensitive' } },
          { sku: { contains: term, mode: 'insensitive' } },
          { brand: { contains: term, mode: 'insensitive' } },
          { sourceIdentities: { some: { externalId: { contains: term, mode: 'insensitive' } } } },
          { sourceIdentities: { some: { sourceBarcode: { contains: term, mode: 'insensitive' } } } },
        ],
      });
    }
    return and.length ? { AND: and } : {};
  }

  private issueWhere(issue: string): Prisma.ProductWhereInput {
    switch (issue) {
      case 'MISSING_IMAGE': return missingImageWhere;
      case 'INVALID_PRICE': return invalidPriceWhere;
      case 'INVALID_CATEGORY': return invalidCategoryWhere;
      case 'MISSING_BRAND': return { brandId: null, OR: [{ brand: null }, { brand: '' }] };
      case 'MISSING_SPECS': return { OR: [{ specs: { equals: Prisma.DbNull } }, { specs: { equals: {} } }] };
      case 'MISSING_SHORT_DESCRIPTION': return { shortDescription: '' };
      case 'MISSING_DESCRIPTION': return { description: '' };
      case 'LOW_RESOLUTION_IMAGE':
        return {
          media: {
            some: {
              role: ProductMediaRole.PRIMARY,
              OR: [
                { mediaAsset: { originalWidth: { lt: MEDIA_LOW_RESOLUTION_THRESHOLD } } },
                { mediaAsset: { originalHeight: { lt: MEDIA_LOW_RESOLUTION_THRESHOLD } } },
              ],
            },
          },
        };
      default: return {};
    }
  }

  private buildOrderBy(sort: AdminProductReviewQueryDto['sort']): Prisma.ProductOrderByWithRelationInput {
    if (sort === 'name') return { name: 'asc' };
    if (sort === 'price') return { price: 'asc' };
    if (sort === 'status') return { status: 'asc' };
    return { updatedAt: 'desc' };
  }

  private toListItem(product: Prisma.ProductGetPayload<{ select: typeof reviewSelect }>) {
    const readiness = this.readinessService.evaluate(product);
    const primary = product.media.find((item) => item.role === ProductMediaRole.PRIMARY);
    const variants = (primary?.mediaAsset.variants ?? {}) as Partial<MediaVariants>;
    const thumbnailUrl = primary?.mediaAsset.processingStatus === MediaProcessingStatus.READY
      ? variants.thumbnail?.url ?? variants.card?.url ?? PLACEHOLDER_URL
      : product.media.length === 0
        ? product.images[0]?.imageUrl ?? PLACEHOLDER_URL
        : PLACEHOLDER_URL;
    const sourceSystems = [...new Set(product.sourceIdentities.map((source) => source.sourceSystem))];
    const importedAt = product.sourceIdentities.reduce<Date | null>((latest, source) => {
      if (!source.lastImportedAt) return latest;
      return !latest || source.lastImportedAt > latest ? source.lastImportedAt : latest;
    }, null);

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      status: product.status,
      price: product.price,
      baseCurrency: product.baseCurrency,
      category: product.category,
      brand: product.brandRef ?? (product.brand ? { id: null, name: product.brand, slug: null } : null),
      thumbnailUrl,
      origin: product.sourceIdentities.length ? 'IMPORTED' : 'MANUAL',
      sourceSystems,
      source: product.sourceIdentities[0]
        ? {
            sourceSystem: product.sourceIdentities[0].sourceSystem,
            externalId: product.sourceIdentities[0].externalId,
            sourceBarcode: product.sourceIdentities[0].sourceBarcode,
          }
        : null,
      readiness,
      updatedAt: product.updatedAt,
      importedAt,
    };
  }
}
