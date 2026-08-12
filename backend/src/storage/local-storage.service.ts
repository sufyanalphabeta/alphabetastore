import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createReadStream, existsSync, mkdirSync, statSync } from 'fs';
import { writeFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import { dirname, extname, join, normalize, relative, sep } from 'path';
import type { Readable } from 'stream';

export type UploadFileOptions = {
  /** Subdirectory within the uploads root, e.g. 'products' or 'payment-receipts' */
  subdirectory: string;
  /** Original filename – used only for extension extraction */
  originalname: string;
  /** Optional logical key, e.g. media/{assetId}/product.webp. */
  storageKey?: string;
};

export type ReadFileResult = {
  stream: Readable;
  contentType: string;
  contentLength?: number;
  filename: string;
};

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

/**
 * Abstract storage service.
 *
 * Concrete implementations (Local / S3) are swapped at runtime via
 * the `STORAGE_DRIVER` environment variable.  Consumers only depend
 * on this class so the driver can change without touching business logic.
 */
export abstract class StorageService {
  /**
   * Save a file and return the publicly accessible URL.
   */
  abstract saveFile(buffer: Buffer, options: UploadFileOptions): Promise<string>;

  /**
   * Delete a previously saved file by its URL.
   * Implementations must be idempotent – deleting a non-existent file
   * should not throw.
   */
  abstract deleteFile(fileUrl: string): Promise<void>;

  /** Resolve a trusted logical storage key to a public URL. */
  abstract getPublicUrl(storageKey: string): string;

  /**
   * Open a stream to a previously saved file. Used for serving private
   * (non-statically-served) assets via authenticated controllers.
   */
  abstract readFile(fileUrl: string): Promise<ReadFileResult>;
}

// ─── Local implementation ────────────────────────────────────────────────────

@Injectable()
export class LocalStorageService extends StorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly uploadsRoot = join(process.cwd(), 'uploads');

  async saveFile(buffer: Buffer, options: UploadFileOptions): Promise<string> {
    const extension = extname(options.originalname).toLowerCase();
    const relativeKey = options.storageKey ?? `${options.subdirectory}/${randomUUID()}${extension}`;
    const filePath = this.resolveStorageKey(relativeKey);
    if (!filePath) throw new Error('Invalid storage key.');
    const dir = dirname(filePath);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    await writeFile(filePath, buffer);

    return `/uploads/${relativeKey.replace(/\\/g, '/')}`;
  }

  async deleteFile(fileUrl: string): Promise<void> {
    if (!fileUrl.startsWith('/uploads/')) {
      return;
    }

    const filePath = this.resolvePath(fileUrl);
    if (!filePath) return;

    try {
      await unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Failed to delete local file: ${filePath}`);
        throw error;
      }
    }
  }

  async readFile(fileUrl: string): Promise<ReadFileResult> {
    const filePath = this.resolvePath(fileUrl);
    if (!filePath || !existsSync(filePath)) {
      throw new NotFoundException('File not found.');
    }

    const ext = extname(filePath).toLowerCase();
    const stats = statSync(filePath);
    return {
      stream: createReadStream(filePath),
      contentType: MIME_BY_EXT[ext] ?? 'application/octet-stream',
      contentLength: stats.size,
      filename: filePath.split(sep).pop() ?? 'file',
    };
  }

  private resolvePath(fileUrl: string): string | null {
    if (!fileUrl.startsWith('/uploads/')) return null;
    const relPath = fileUrl.replace(/^\/uploads\//, '');
    const target = normalize(join(this.uploadsRoot, relPath));
    // Defense in depth against path traversal.
    const rel = relative(this.uploadsRoot, target);
    if (rel.startsWith('..') || rel.includes(`..${sep}`)) {
      return null;
    }
    return target;
  }

  getPublicUrl(storageKey: string): string {
    const filePath = this.resolveStorageKey(storageKey);
    if (!filePath) throw new Error('Invalid storage key.');
    return `/uploads/${storageKey.replace(/\\/g, '/')}`;
  }

  private resolveStorageKey(storageKey: string): string | null {
    const target = normalize(join(this.uploadsRoot, storageKey));
    const rel = relative(this.uploadsRoot, target);
    if (!rel || rel.startsWith('..') || rel.includes(`..${sep}`)) return null;
    return target;
  }
}
