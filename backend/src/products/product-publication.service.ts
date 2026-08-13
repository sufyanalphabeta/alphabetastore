import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { ProductReadinessService } from './product-readiness.service';
import { ProductsService } from './products.service';

const publicationSelect = {
  id: true,
  slug: true,
  status: true,
  updatedAt: true,
  catalogReviewedAt: true,
  catalogReviewedByUserId: true,
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

@Injectable()
export class ProductPublicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly readinessService: ProductReadinessService,
    private readonly productsService: ProductsService,
  ) {}

  async publish(productId: string) {
    const published = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId }, select: publicationSelect });
      if (!product) throw new NotFoundException('Product not found.');

      const readiness = this.readinessService.evaluate(product);
      const reasons: string[] = [];
      if (!readiness.readyToPublish) reasons.push(...readiness.blockers);
      if (!product.catalogReviewedAt || !product.catalogReviewedByUserId) reasons.push('HUMAN_REVIEW_REQUIRED');
      if (reasons.length) {
        throw new ConflictException({
          message: 'Product must be ready and human-reviewed before publication.',
          reasons,
          blockers: readiness.blockers,
        });
      }

      if (product.status === ProductStatus.ACTIVE) return product;
      const result = await tx.product.updateMany({
        where: {
          id: product.id,
          status: ProductStatus.INACTIVE,
          updatedAt: product.updatedAt,
          catalogReviewedAt: product.catalogReviewedAt,
          catalogReviewedByUserId: product.catalogReviewedByUserId,
        },
        data: { status: ProductStatus.ACTIVE },
      });
      if (result.count !== 1) {
        throw new ConflictException('Product changed before publication. Refresh and review its current state.');
      }
      return product;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    await this.productsService.invalidatePublicationCaches(published.id, published.slug);
    return this.productsService.findOneAdmin(published.id);
  }

  async unpublish(productId: string) {
    const unpublished = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { id: true, slug: true, status: true, updatedAt: true },
      });
      if (!product) throw new NotFoundException('Product not found.');
      if (product.status === ProductStatus.INACTIVE) return product;

      const result = await tx.product.updateMany({
        where: { id: product.id, status: ProductStatus.ACTIVE, updatedAt: product.updatedAt },
        data: { status: ProductStatus.INACTIVE },
      });
      if (result.count !== 1) {
        throw new ConflictException('Product changed before unpublication. Refresh and try again.');
      }
      return product;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    await this.productsService.invalidatePublicationCaches(unpublished.id, unpublished.slug);
    return this.productsService.findOneAdmin(unpublished.id);
  }
}
