import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { extname } from 'path';
import sharp, { type Metadata } from 'sharp';

import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/local-storage.service';
import {
  MEDIA_ALLOWED_MIME_TYPES,
  MEDIA_ALLOWED_SHARP_FORMATS,
  MEDIA_MAX_DECODED_PIXELS,
  MEDIA_MAX_INPUT_BYTES,
  MEDIA_MAX_WIDTH_OR_HEIGHT,
  MEDIA_VARIANTS,
  MEDIA_WEBP_QUALITY,
} from './media.constants';
import type { MediaVariants, ProcessedMediaAsset } from './media.types';

type ImageUpload = {
  buffer: Buffer;
  originalname: string;
  mimetype?: string;
};

@Injectable()
export class MediaProcessingService {
  private readonly logger = new Logger(MediaProcessingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async processImage(
    upload: ImageUpload,
    uploadedById?: string,
  ): Promise<ProcessedMediaAsset> {
    this.validateInputSize(upload.buffer);

    // Validate the decoded content and the user-facing filename before duplicate reuse.
    // This prevents a duplicate request with a fake extension/MIME from bypassing upload security.
    const metadata = await this.inspectImage(upload);
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    this.validateDimensions(width, height);

    const checksumSha256 = createHash('sha256').update(upload.buffer).digest('hex');
    const duplicate = await this.prisma.mediaAsset.findUnique({
      where: { checksumSha256 },
      include: { productMedia: true },
    });
    if (duplicate) {
      return {
        asset: duplicate,
        duplicate: true,
        lowResolution: this.isLowResolution(duplicate.originalWidth, duplicate.originalHeight),
        warning: this.isLowResolution(duplicate.originalWidth, duplicate.originalHeight)
          ? 'جودة الصورة منخفضة، يفضل رفع صورة بدقة أعلى.'
          : undefined,
        variants: (duplicate.variants ?? {}) as MediaVariants,
      };
    }

    const format = metadata.format ?? '';
    if (!MEDIA_ALLOWED_SHARP_FORMATS.has(format)) {
      throw new BadRequestException('نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WebP.');
    }

    const mediaId = randomUUID();
    const originalExtension = this.getOriginalExtension(format);
    const originalStorageKey = `media/${mediaId}/original${originalExtension}`;
    let asset;
    try {
      asset = await this.prisma.mediaAsset.create({
        data: {
          id: mediaId,
          originalFilename: upload.originalname.slice(0, 255),
          storageKey: originalStorageKey,
          originalMimeType: this.mimeForFormat(format),
          originalSizeBytes: upload.buffer.length,
          originalWidth: width,
          originalHeight: height,
          checksumSha256,
          aspectRatio: height ? width / height : null,
          processingStatus: 'PROCESSING',
          uploadedById,
        },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        const concurrentDuplicate = await this.prisma.mediaAsset.findUnique({
          where: { checksumSha256 },
          include: { productMedia: true },
        });
        if (concurrentDuplicate) {
          const lowResolution = this.isLowResolution(concurrentDuplicate.originalWidth, concurrentDuplicate.originalHeight);
          return {
            asset: concurrentDuplicate,
            duplicate: true,
            lowResolution,
            warning: lowResolution ? 'جودة الصورة منخفضة، يفضل رفع صورة بدقة أعلى.' : undefined,
            variants: (concurrentDuplicate.variants ?? {}) as MediaVariants,
          };
        }
      }
      throw error;
    }

    const savedUrls: string[] = [];
    try {
      const originalUrl = await this.storageService.saveFile(upload.buffer, {
        subdirectory: `media/${mediaId}`,
        originalname: `original${originalExtension}`,
        storageKey: originalStorageKey,
      });
      savedUrls.push(originalUrl);

      const variants = {} as MediaVariants;
      for (const [name, size] of Object.entries(MEDIA_VARIANTS) as Array<[
        keyof typeof MEDIA_VARIANTS,
        number,
      ]>) {
        const storageKey = `media/${mediaId}/${name}.webp`;
        const { data: contained } = await sharp(upload.buffer)
          .rotate()
          .flatten({ background: '#ffffff' })
          .resize(size, size, { fit: 'inside', withoutEnlargement: true })
          .toBuffer({ resolveWithObject: true });
        const { data: buffer, info } = await sharp({
          create: {
            width: size,
            height: size,
            channels: 3,
            background: '#ffffff',
          },
        })
          .composite([{ input: contained, gravity: 'center' }])
          .webp({ quality: MEDIA_WEBP_QUALITY })
          .toBuffer({ resolveWithObject: true });
        const url = await this.storageService.saveFile(buffer, {
          subdirectory: `media/${mediaId}`,
          originalname: `${name}.webp`,
          storageKey,
        });
        savedUrls.push(url);
        variants[name] = {
          width: info.width,
          height: info.height,
          format: 'webp',
          storageKey,
          url,
          sizeBytes: buffer.length,
        };
      }

      const lowResolution = this.isLowResolution(width, height);
      const readyAsset = await this.prisma.mediaAsset.update({
        where: { id: mediaId },
        data: {
          processingStatus: 'READY',
          variants,
        },
      });

      return {
        asset: readyAsset,
        duplicate: false,
        lowResolution,
        warning: lowResolution ? 'جودة الصورة منخفضة، يفضل رفع صورة بدقة أعلى.' : undefined,
        variants,
      };
    } catch (error) {
      await this.prisma.mediaAsset.update({
        where: { id: mediaId },
        data: { processingStatus: 'FAILED' },
      }).catch(() => null);
      await Promise.all(savedUrls.map(url => this.storageService.deleteFile(url).catch(() => null)));
      this.logger.error(`Media processing failed for ${upload.originalname}`, error);
      throw new BadRequestException('تعذر تحسين الصورة. يرجى رفع صورة أخرى.');
    }
  }

  private async inspectImage(upload: ImageUpload) {
    let metadata: Metadata;
    try {
      metadata = await sharp(upload.buffer, { failOn: 'error', limitInputPixels: MEDIA_MAX_DECODED_PIXELS }).metadata();
    } catch {
      throw new BadRequestException('ملف الصورة غير صالح أو تالف.');
    }

    const detectedMime = this.mimeForFormat(metadata.format ?? '');
    if (!MEDIA_ALLOWED_MIME_TYPES.has(detectedMime)) {
      throw new BadRequestException('نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WebP.');
    }
    const extension = extname(upload.originalname).toLowerCase();
    const expectedMimeByExtension: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };
    if (expectedMimeByExtension[extension] !== detectedMime || (upload.mimetype && upload.mimetype !== detectedMime)) {
      throw new BadRequestException('امتداد أو نوع ملف الصورة لا يطابق محتوى الصورة.');
    }
    return metadata;
  }

  private validateInputSize(buffer: Buffer) {
    if (buffer.length > MEDIA_MAX_INPUT_BYTES) {
      throw new BadRequestException('حجم الصورة أكبر من الحد المسموح وهو 15MB.');
    }
  }

  private validateDimensions(width: number, height: number) {
    if (!width || !height || width > MEDIA_MAX_WIDTH_OR_HEIGHT || height > MEDIA_MAX_WIDTH_OR_HEIGHT || width * height > MEDIA_MAX_DECODED_PIXELS) {
      throw new BadRequestException('أبعاد الصورة أكبر من الحد المسموح.');
    }
  }

  private isLowResolution(width?: number | null, height?: number | null) {
    return Boolean(width && height && Math.min(width, height) < 600);
  }

  private mimeForFormat(format: string) {
    return format === 'jpeg' ? 'image/jpeg' : format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : '';
  }

  private getOriginalExtension(format: string) {
    return format === 'jpeg' ? '.jpg' : `.${format}`;
  }
}
