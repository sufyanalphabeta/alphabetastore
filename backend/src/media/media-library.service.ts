import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/local-storage.service';
import { MEDIA_LOW_RESOLUTION_THRESHOLD } from './media.constants';
import { MediaProcessingService } from './media-processing.service';
import type { MediaVariant, MediaVariants } from './media.types';
import { MediaListQueryDto } from './dto/media-list-query.dto';
import { UpdateMediaMetadataDto } from './dto/update-media-metadata.dto';

const LOW_RESOLUTION_WARNING = 'جودة الصورة منخفضة، يفضل رفع صورة بدقة أعلى.';

type MediaRecord = {
  id: string;
  mediaType: string;
  originalFilename: string;
  originalMimeType: string;
  originalSizeBytes: number;
  originalWidth: number | null;
  originalHeight: number | null;
  aspectRatio: unknown;
  altText: string | null;
  title: string | null;
  caption: string | null;
  processingStatus: string;
  variants: unknown;
  storageKey: string;
  checksumSha256?: string | null;
  createdAt: Date;
  updatedAt?: Date;
  uploadedBy?: { id: string; name: string; email: string } | null;
  productMedia?: Array<{
    role: string;
    sortOrder: number;
    product: { id: string; name: string; slug: string };
  }>;
  _count?: { productMedia: number };
};

@Injectable()
export class MediaLibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly processingService: MediaProcessingService,
  ) {}

  async upload(file: Express.Multer.File, uploadedById: string) {
    const result = await this.processingService.processImage(file, uploadedById);
    return this.toUploadResponse(result.asset as MediaRecord, result.variants, result.duplicate, result.warning);
  }

  async list(query: MediaListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 24;
    const search = query.search?.trim();
    const usageFilter = query.used === undefined
      ? undefined
      : query.used
        ? { some: {} }
        : { none: {} };
    const where: Prisma.MediaAssetWhereInput = {
      mediaType: query.mediaType,
      processingStatus: query.processingStatus,
      productMedia: usageFilter,
      ...(search
        ? {
            OR: [
              { originalFilename: { contains: search, mode: 'insensitive' } },
              { title: { contains: search, mode: 'insensitive' } },
              { altText: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...((query.createdFrom || query.createdTo)
        ? {
            createdAt: {
              gte: query.createdFrom ? new Date(query.createdFrom) : undefined,
              lte: query.createdTo ? new Date(query.createdTo) : undefined,
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.mediaAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: this.listSelect,
      }),
      this.prisma.mediaAsset.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toListResponse(item as MediaRecord)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id },
      select: this.detailSelect,
    });
    if (!asset) throw new NotFoundException('Media asset not found.');
    return this.toDetailResponse(asset as MediaRecord);
  }

  async updateMetadata(id: string, dto: UpdateMediaMetadataDto) {
    await this.ensureExists(id);
    const asset = await this.prisma.mediaAsset.update({
      where: { id },
      data: {
        ...(dto.altText !== undefined ? { altText: dto.altText.trim() || null } : {}),
        ...(dto.title !== undefined ? { title: dto.title.trim() || null } : {}),
        ...(dto.caption !== undefined ? { caption: dto.caption.trim() || null } : {}),
      },
      select: this.detailSelect,
    });
    return this.toDetailResponse(asset as MediaRecord);
  }

  async remove(id: string) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id },
      select: {
        id: true,
        storageKey: true,
        processingStatus: true,
        variants: true,
        _count: { select: { productMedia: true } },
      },
    });
    if (!asset) throw new NotFoundException('Media asset not found.');

    const usageCount = asset._count.productMedia;
    if (usageCount > 0) {
      throw new ConflictException(`لا يمكن حذف الصورة لأنها مستخدمة في ${usageCount} منتجات.`);
    }

    // Compensating strategy: never leave a READY record if storage cleanup or DB deletion fails.
    await this.prisma.mediaAsset.update({
      where: { id },
      data: { processingStatus: 'FAILED' },
    });

    const urls = this.getStorageUrls(asset.storageKey, asset.variants);
    try {
      await Promise.all(urls.map((url) => this.storageService.deleteFile(url)));
      await this.prisma.mediaAsset.delete({ where: { id } });
    } catch (error) {
      await this.prisma.mediaAsset.update({
        where: { id },
        data: { processingStatus: 'FAILED' },
      }).catch(() => null);
      throw new InternalServerErrorException('تعذر حذف ملفات الصورة بأمان. حاول مرة أخرى.');
    }

    return { id, deleted: true };
  }

  private async ensureExists(id: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id }, select: { id: true } });
    if (!asset) throw new NotFoundException('Media asset not found.');
  }

  private getStorageUrls(storageKey: string, variants: unknown) {
    const keys = [storageKey];
    const variantMap = (variants ?? {}) as Partial<MediaVariants>;
    for (const variant of Object.values(variantMap)) {
      if (variant?.storageKey) keys.push(variant.storageKey);
    }
    return [...new Set(keys)].map((key) => this.storageService.getPublicUrl(key));
  }

  private resolveVariants(variants: unknown) {
    const source = (variants ?? {}) as Partial<MediaVariants>;
    const output: Record<string, { width: number; height: number; format: 'webp'; sizeBytes: number; url: string }> = {};
    for (const [name, variant] of Object.entries(source) as Array<[string, MediaVariant | undefined]>) {
      if (!variant?.storageKey) continue;
      output[name] = {
        width: variant.width,
        height: variant.height,
        format: 'webp',
        sizeBytes: variant.sizeBytes,
        url: this.storageService.getPublicUrl(variant.storageKey),
      };
    }
    return output;
  }

  private warningFor(asset: MediaRecord) {
    return asset.originalWidth && asset.originalHeight && Math.min(asset.originalWidth, asset.originalHeight) < MEDIA_LOW_RESOLUTION_THRESHOLD
      ? LOW_RESOLUTION_WARNING
      : undefined;
  }

  private toUploadResponse(asset: MediaRecord, variants: unknown, duplicate: boolean, warning?: string) {
    return {
      id: asset.id,
      duplicate,
      message: duplicate ? 'هذه الصورة موجودة مسبقًا في مكتبة الوسائط.' : 'تم تحسين الصورة تلقائيًا للمتجر.',
      mediaType: asset.mediaType,
      originalFilename: asset.originalFilename,
      originalMimeType: asset.originalMimeType,
      originalSizeBytes: asset.originalSizeBytes,
      originalWidth: asset.originalWidth,
      originalHeight: asset.originalHeight,
      processingStatus: asset.processingStatus,
      warning: warning ?? this.warningFor(asset),
      ...this.resolveVariantResponse(variants),
    };
  }

  private resolveVariantResponse(variants: unknown) {
    const resolved = this.resolveVariants(variants);
    return {
      thumbnailUrl: resolved.thumbnail?.url,
      cardUrl: resolved.card?.url,
      productUrl: resolved.product?.url,
      zoomUrl: resolved.zoom?.url,
    };
  }

  private toListResponse(asset: MediaRecord) {
    const resolved = this.resolveVariants(asset.variants);
    return {
      id: asset.id,
      mediaType: asset.mediaType,
      originalFilename: asset.originalFilename,
      title: asset.title,
      altText: asset.altText,
      originalWidth: asset.originalWidth,
      originalHeight: asset.originalHeight,
      originalSizeBytes: asset.originalSizeBytes,
      processingStatus: asset.processingStatus,
      warning: this.warningFor(asset),
      usageCount: asset._count?.productMedia ?? 0,
      thumbnailUrl: resolved.thumbnail?.url,
      cardUrl: resolved.card?.url,
      createdAt: asset.createdAt,
    };
  }

  private toDetailResponse(asset: MediaRecord) {
    return {
      id: asset.id,
      mediaType: asset.mediaType,
      originalFilename: asset.originalFilename,
      originalMimeType: asset.originalMimeType,
      originalSizeBytes: asset.originalSizeBytes,
      originalWidth: asset.originalWidth,
      originalHeight: asset.originalHeight,
      aspectRatio: asset.aspectRatio,
      processingStatus: asset.processingStatus,
      warning: this.warningFor(asset),
      altText: asset.altText,
      title: asset.title,
      caption: asset.caption,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
      uploader: asset.uploadedBy ? { id: asset.uploadedBy.id, name: asset.uploadedBy.name, email: asset.uploadedBy.email } : null,
      usageCount: asset.productMedia?.length ?? 0,
      products: asset.productMedia?.map((usage) => ({ ...usage.product, role: usage.role, sortOrder: usage.sortOrder })) ?? [],
      ...this.resolveVariantResponse(asset.variants),
    };
  }

  private readonly listSelect = {
    id: true,
    mediaType: true,
    originalFilename: true,
    originalSizeBytes: true,
    originalWidth: true,
    originalHeight: true,
    title: true,
    altText: true,
    processingStatus: true,
    variants: true,
    createdAt: true,
    _count: { select: { productMedia: true } },
  } satisfies Prisma.MediaAssetSelect;

  private readonly detailSelect = {
    id: true,
    mediaType: true,
    originalFilename: true,
    originalMimeType: true,
    originalSizeBytes: true,
    originalWidth: true,
    originalHeight: true,
    aspectRatio: true,
    storageKey: true,
    processingStatus: true,
    variants: true,
    altText: true,
    title: true,
    caption: true,
    createdAt: true,
    updatedAt: true,
    uploadedBy: { select: { id: true, name: true, email: true } },
    productMedia: {
      orderBy: { sortOrder: 'asc' as const },
      select: {
        role: true,
        sortOrder: true,
        product: { select: { id: true, name: true, slug: true } },
      },
    },
  } satisfies Prisma.MediaAssetSelect;
}
