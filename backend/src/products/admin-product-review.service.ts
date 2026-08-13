import { Injectable } from '@nestjs/common';
import { MediaProcessingStatus, Prisma, ProductMediaRole } from '@prisma/client';

import type { MediaVariants } from '../media/media.types';
import { PrismaService } from '../prisma/prisma.service';
import { AdminProductReviewQueryDto } from './dto/admin-product-review-query.dto';
import { ProductReadinessService } from './product-readiness.service';

const PLACEHOLDER_URL = '/assets/images/products/alphabeta-product-placeholder.svg';

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
    const products = await this.prisma.product.findMany({ where, select: reviewSelect, orderBy });
    const matchingItems = products
      .map((product) => this.toListItem(product))
      .filter((product) => this.matchesReadinessFilters(product.readiness, query));
    const total = matchingItems.length;
    const items = matchingItems.slice((page - 1) * limit, page * limit);

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async summary() {
    const products = (await this.prisma.product.findMany({ select: reviewSelect })).map((product) => this.toListItem(product));
    const hasIssue = (product: (typeof products)[number], issue: string) =>
      product.readiness.blockers.includes(issue as never) || product.readiness.warnings.includes(issue as never);
    const total = products.length;
    const active = products.filter((product) => product.status === 'ACTIVE').length;
    const inactive = total - active;
    const imported = products.filter((product) => product.origin === 'IMPORTED').length;
    const manual = total - imported;
    const ready = products.filter((product) => product.readiness.readyToPublish).length;
    const blocked = total - ready;
    const missingImage = products.filter((product) => hasIssue(product, 'MISSING_IMAGE')).length;
    const missingBrandCount = products.filter((product) => hasIssue(product, 'MISSING_BRAND')).length;
    const missingSpecsCount = products.filter((product) => hasIssue(product, 'MISSING_SPECS')).length;
    const invalidPrice = products.filter((product) => hasIssue(product, 'INVALID_PRICE')).length;
    const invalidCategory = products.filter((product) => hasIssue(product, 'INVALID_CATEGORY')).length;

    return {
      total, active, inactive, imported, manual, blocked, ready,
      missingImage, missingBrand: missingBrandCount, missingSpecs: missingSpecsCount,
      invalidPrice, invalidCategory,
    };
  }

  async next(currentProductId: string, query: AdminProductReviewQueryDto) {
    const products = await this.prisma.product.findMany({
      where: this.buildWhere(query),
      select: reviewSelect,
      orderBy: [this.buildOrderBy(query.sort), { id: 'asc' }],
    });
    const item = products
      .map((product) => this.toListItem(product))
      .filter((product) => this.matchesReadinessFilters(product.readiness, query))
      .find((product) => product.id !== currentProductId);
    return { item: item ? { id: item.id, slug: item.slug } : null };
  }

  private buildWhere(query: AdminProductReviewQueryDto): Prisma.ProductWhereInput {
    const and: Prisma.ProductWhereInput[] = [];
    if (query.status) and.push({ status: query.status });
    if (query.origin === 'IMPORTED') and.push({ sourceIdentities: { some: {} } });
    if (query.origin === 'MANUAL') and.push({ sourceIdentities: { none: {} } });
    if (query.sourceSystem) and.push({ sourceIdentities: { some: { sourceSystem: query.sourceSystem } } });
    if (query.categoryId) and.push({ categoryId: query.categoryId });
    if (query.brandId) and.push({ brandId: query.brandId });
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

  private matchesReadinessFilters(readiness: ReturnType<ProductReadinessService['evaluate']>, query: AdminProductReviewQueryDto) {
    if (query.readiness === 'READY' && !readiness.readyToPublish) return false;
    if (query.readiness === 'BLOCKED' && readiness.readyToPublish) return false;
    if (query.issue && !readiness.blockers.includes(query.issue as never) && !readiness.warnings.includes(query.issue as never)) return false;
    return true;
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
