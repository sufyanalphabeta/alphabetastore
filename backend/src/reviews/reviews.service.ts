import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import type { ReviewStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/local-storage.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { FindReviewsQueryDto, ModerateReviewDto } from './dto/find-reviews-query.dto';

const REVIEW_SELECT = {
  id: true,
  productId: true,
  userId: true,
  rating: true,
  title: true,
  comment: true,
  status: true,
  isVerifiedPurchase: true,
  helpfulCount: true,
  createdAt: true,
  updatedAt: true,
  images: {
    select: { id: true, imageUrl: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' as const },
  },
  user: {
    select: { id: true, name: true },
  },
};

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly storageService: StorageService,
  ) {}

  /** Public: paginated APPROVED reviews for a product. */
  async findProductReviews(productId: string, query: FindReviewsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where = {
      productId,
      status: 'APPROVED' as ReviewStatus,
    };

    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        select: REVIEW_SELECT,
        orderBy: this.buildOrderBy(query.sort),
        skip,
        take: limit,
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Public: rating summary (avg, count, distribution) for a product. */
  async getRatingSummary(productId: string) {
    const rows = await this.prisma.review.groupBy({
      by: ['rating'],
      where: { productId, status: 'APPROVED' },
      _count: { _all: true },
    });

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let total = 0;
    let sum = 0;
    for (const r of rows) {
      distribution[r.rating] = r._count._all;
      total += r._count._all;
      sum += r.rating * r._count._all;
    }

    return {
      average: total > 0 ? Math.round((sum / total) * 100) / 100 : 0,
      total,
      distribution,
    };
  }

  /** Get current user's review for a product (if any). */
  async getMyReview(productId: string, userId: string) {
    return this.prisma.review.findUnique({
      where: { productId_userId: { productId, userId } },
      select: { ...REVIEW_SELECT, moderatorNote: true },
    });
  }

  /** Create a review. Checks one-per-user-per-product. Sets verifiedPurchase. */
  async create(
    productId: string,
    userId: string,
    dto: CreateReviewDto,
    imageBuffers: Array<{ buffer: Buffer; originalname: string }> = [],
  ) {
    // Validate product exists
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) throw new NotFoundException('Product not found.');

    // One review per user
    const existing = await this.prisma.review.findUnique({
      where: { productId_userId: { productId, userId } },
      select: { id: true },
    });
    if (existing) throw new ConflictException('You have already reviewed this product.');

    // Check verified purchase
    const purchased = await this.prisma.orderItem.findFirst({
      where: {
        productId,
        order: { userId, status: { not: 'CANCELLED' } },
      },
      select: { id: true, orderId: true },
    });

    // Upload images
    const imageUrls = await this.uploadImages(imageBuffers);

    const review = await this.prisma.review.create({
      data: {
        productId,
        userId,
        orderId: purchased?.orderId ?? null,
        rating: dto.rating,
        title: dto.title,
        comment: dto.comment,
        isVerifiedPurchase: !!purchased,
        status: 'PENDING',
        images: imageUrls.length
          ? { create: imageUrls.map((url, i) => ({ imageUrl: url, sortOrder: i })) }
          : undefined,
      },
      select: REVIEW_SELECT,
    });

    return review;
  }

  /** Customer: edit own review (pending or approved). */
  async update(
    reviewId: string,
    userId: string,
    dto: UpdateReviewDto,
    imageBuffers: Array<{ buffer: Buffer; originalname: string }> = [],
  ) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, userId: true, productId: true, images: { select: { id: true, imageUrl: true } } },
    });
    if (!review) throw new NotFoundException('Review not found.');
    if (review.userId !== userId) throw new ForbiddenException('You can only edit your own review.');

    // Delete old images
    for (const img of review.images) {
      await this.storageService.deleteFile(img.imageUrl).catch(() => null);
    }
    await this.prisma.reviewImage.deleteMany({ where: { reviewId } });

    // Upload new images
    const imageUrls = await this.uploadImages(imageBuffers);

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        rating: dto.rating,
        title: dto.title,
        comment: dto.comment,
        status: 'PENDING', // re-enters moderation queue
        images: imageUrls.length
          ? { create: imageUrls.map((url, i) => ({ imageUrl: url, sortOrder: i })) }
          : undefined,
      },
      select: REVIEW_SELECT,
    });

    // Recalculate rating (status changed to PENDING so this review no longer counts)
    await this.recalculateRating(review.productId);

    return updated;
  }

  /** Customer: delete own review. */
  async remove(reviewId: string, userId: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, userId: true, productId: true, images: { select: { imageUrl: true } } },
    });
    if (!review) throw new NotFoundException('Review not found.');
    if (review.userId !== userId) throw new ForbiddenException('You can only delete your own review.');

    for (const img of review.images) {
      await this.storageService.deleteFile(img.imageUrl).catch(() => null);
    }

    await this.prisma.review.delete({ where: { id: reviewId } });
    await this.recalculateRating(review.productId);

    return { message: 'Review deleted.' };
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  /** Admin: list reviews across all products, optionally filtered by status. */
  async adminFindAll(query: FindReviewsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = query.status ? { status: query.status } : {};

    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        select: {
          ...REVIEW_SELECT,
          moderatorNote: true,
          product: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Admin: approve / reject / hide a review. */
  async moderate(reviewId: string, dto: ModerateReviewDto) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, productId: true, status: true },
    });
    if (!review) throw new NotFoundException('Review not found.');

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: { status: dto.status, moderatorNote: dto.moderatorNote },
      select: { id: true, status: true, productId: true },
    });

    await this.recalculateRating(review.productId);
    return updated;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private buildOrderBy(sort?: FindReviewsQueryDto['sort']) {
    switch (sort) {
      case 'oldest':    return { createdAt: 'asc'  as const };
      case 'highest':   return { rating:    'desc' as const };
      case 'lowest':    return { rating:    'asc'  as const };
      case 'verified':  return { isVerifiedPurchase: 'desc' as const };
      default:          return { createdAt: 'desc' as const };
    }
  }

  /** Recalculate and persist average + count on the product row. */
  async recalculateRating(productId: string) {
    const rows = await this.prisma.review.groupBy({
      by: ['productId'],
      where: { productId, status: 'APPROVED' },
      _avg: { rating: true },
      _count: { _all: true },
    });

    const row = rows[0];
    const avg = row?._avg?.rating ?? 0;
    const count = row?._count?._all ?? 0;

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        ratingAvg: Math.round(avg * 100) / 100,
        ratingCount: count,
      },
    });

    // Invalidate product cache
    await this.cacheManager.del(`products:detail:${productId}`).catch(() => null);
  }

  private async uploadImages(
    images: Array<{ buffer: Buffer; originalname: string }>,
  ): Promise<string[]> {
    const urls: string[] = [];
    for (const img of images.slice(0, 5)) {
      const url = await this.storageService.saveFile(img.buffer, {
        subdirectory: 'reviews',
        originalname: img.originalname,
      });
      urls.push(url);
    }
    return urls;
  }
}
