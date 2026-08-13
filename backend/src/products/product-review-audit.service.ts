import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { ProductReadinessService } from './product-readiness.service';

const PRODUCT_REVIEW_FIELDS = [
  'name', 'slug', 'price', 'baseCurrency', 'exchangeRateOverride', 'comparePrice',
  'discountType', 'discountValue', 'discountStartAt', 'discountEndAt',
  'categoryId', 'status', 'shortDescription', 'description', 'brand', 'brandId',
  'specs', 'highlights', 'warrantyText', 'datasheetUrl', 'sku', 'imageUrls',
] as const;

const readinessSelect = {
  id: true,
  updatedAt: true,
  name: true,
  price: true,
  shortDescription: true,
  description: true,
  brand: true,
  brandId: true,
  specs: true,
  warrantyText: true,
  sku: true,
  category: { select: { isActive: true, isVisible: true } },
  images: { select: { id: true } },
  media: {
    select: {
      role: true,
      mediaAsset: { select: { processingStatus: true, originalWidth: true, originalHeight: true } },
    },
  },
  sourceIdentities: { select: { sourceBarcode: true, lastImportedName: true } },
  _count: { select: { media: true, images: true } },
} satisfies Prisma.ProductSelect;

type ProductUpdateInput = Record<string, unknown>;
@Injectable()
export class ProductReviewAuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly readinessService: ProductReadinessService,
  ) {}

  productUpdateInvalidates(existing: object, update: object) {
    const previous = existing as ProductUpdateInput;
    const next = update as ProductUpdateInput;
    return PRODUCT_REVIEW_FIELDS.some((field) =>
      Object.prototype.hasOwnProperty.call(next, field) && !this.equal(previous[field], next[field]),
    );
  }

  invalidationData(shouldInvalidate: boolean) {
    return shouldInvalidate
      ? { catalogReviewedAt: null, catalogReviewedByUserId: null }
      : {};
  }

  async invalidate(client: Prisma.TransactionClient | PrismaService, productId: string) {
    await client.product.update({
      where: { id: productId },
      data: { catalogReviewedAt: null, catalogReviewedByUserId: null },
    });
  }

  async markReviewed(productId: string, reviewerUserId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: readinessSelect });
    if (!product) throw new NotFoundException('Product not found.');

    const readiness = this.readinessService.evaluate(product);
    if (!readiness.readyToPublish) {
      throw new ConflictException({
        message: 'Complete publication blockers before approving the human review.',
        blockers: readiness.blockers,
      });
    }

    const reviewedAt = new Date();
    const result = await this.prisma.product.updateMany({
      where: { id: productId, updatedAt: product.updatedAt },
      data: { catalogReviewedAt: reviewedAt, catalogReviewedByUserId: reviewerUserId },
    });
    if (result.count !== 1) {
      throw new ConflictException('Product changed while it was being reviewed. Refresh and review the latest data.');
    }

    return this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
      select: { id: true, catalogReviewedAt: true, catalogReviewedByUserId: true },
    });
  }

  private equal(left: unknown, right: unknown) {
    if (left === right) return true;
    if (left === null || left === undefined || right === null || right === undefined) {
      return (left ?? null) === (right ?? null);
    }
    if (left instanceof Date || right instanceof Date) {
      const leftTime = left instanceof Date ? left.getTime() : new Date(String(left)).getTime();
      const rightTime = right instanceof Date ? right.getTime() : new Date(String(right)).getTime();
      return leftTime === rightTime;
    }
    if (typeof left === 'object' || typeof right === 'object') {
      if (this.isDecimalLike(left) || this.isDecimalLike(right)) return String(left) === String(right);
      return this.stableJson(left) === this.stableJson(right);
    }
    return String(left) === String(right);
  }

  private isDecimalLike(value: unknown): value is { toFixed(): string } {
    return Boolean(value && typeof value === 'object' && 'toFixed' in value && typeof value.toFixed === 'function');
  }

  private stableJson(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map((item) => this.stableJson(item)).join(',')}]`;
    if (value && typeof value === 'object') {
      return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${this.stableJson(item)}`).join(',')}}`;
    }
    return JSON.stringify(value);
  }
}
