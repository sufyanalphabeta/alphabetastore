import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductMediaRole } from '@prisma/client';
import type { Cache } from 'cache-manager';

import { PrismaService } from '../prisma/prisma.service';
import { MEDIA_MAX_PRODUCT_IMAGES } from './media.constants';
import { normalizeProductGallery } from './product-gallery.mapper';

const galleryInclude = {
  mediaAsset: {
    select: { id: true, altText: true, variants: true },
  },
} satisfies Prisma.ProductMediaInclude;

@Injectable()
export class ProductMediaService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async list(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        media: { include: galleryInclude, orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!product) throw new NotFoundException('Product not found.');
    return normalizeProductGallery({ images: [], media: product.media }).gallery;
  }

  async attachImage(productId: string, mediaAssetId: string, requestedRole?: 'PRIMARY' | 'GALLERY') {
    try {
      const result = await this.serializable(async (tx) => {
        const [product, asset, existing, relations] = await Promise.all([
          tx.product.findUnique({ where: { id: productId }, select: { id: true } }),
          tx.mediaAsset.findUnique({ where: { id: mediaAssetId }, select: { id: true, mediaType: true, processingStatus: true } }),
          tx.productMedia.findUnique({ where: { productId_mediaAssetId: { productId, mediaAssetId } }, select: { id: true } }),
          tx.productMedia.findMany({ where: { productId }, select: { id: true, role: true, sortOrder: true }, orderBy: { sortOrder: 'asc' } }),
        ]);
        if (!product) throw new NotFoundException('Product not found.');
        if (!asset) throw new NotFoundException('Media asset not found.');
        if (asset.mediaType !== 'IMAGE' || asset.processingStatus !== 'READY') {
          throw new BadRequestException('Only READY image assets can be attached.');
        }
        if (existing) throw new ConflictException('This image is already attached to the product.');
        if (relations.length >= MEDIA_MAX_PRODUCT_IMAGES) {
          throw new ConflictException('A product can have up to 4 images.');
        }

        const role = relations.length === 0 || requestedRole === 'PRIMARY'
          ? ProductMediaRole.PRIMARY
          : ProductMediaRole.GALLERY;
        if (role === ProductMediaRole.PRIMARY && relations.length) {
          await tx.productMedia.updateMany({
            where: { productId, role: ProductMediaRole.PRIMARY },
            data: { role: ProductMediaRole.GALLERY },
          });
        }
        const relation = await tx.productMedia.create({
          data: { productId, mediaAssetId, role, sortOrder: relations.length },
          include: galleryInclude,
        });
        await this.normalizeOrder(tx, productId, role === ProductMediaRole.PRIMARY ? relation.id : undefined);
        return this.findRelation(tx, productId, relation.id);
      });
      await this.invalidateProductCaches(productId);
      return result;
    } catch (error) {
      this.translateWriteConflict(error);
      throw error;
    }
  }

  async updateRole(productId: string, productMediaId: string, role: 'PRIMARY' | 'GALLERY') {
    return this.runMutation(productId, async (tx) => {
      const relation = await this.requireRelation(tx, productId, productMediaId);
      if (role === 'PRIMARY') {
        await tx.productMedia.updateMany({ where: { productId, role: ProductMediaRole.PRIMARY }, data: { role: ProductMediaRole.GALLERY } });
        await tx.productMedia.update({ where: { id: relation.id }, data: { role: ProductMediaRole.PRIMARY } });
        await this.normalizeOrder(tx, productId, relation.id);
      } else {
        const count = await tx.productMedia.count({ where: { productId } });
        if (relation.role === ProductMediaRole.PRIMARY && count > 0) {
          throw new BadRequestException('Choose another primary image before demoting the current primary.');
        }
      }
      return this.findRelation(tx, productId, relation.id);
    });
  }

  async remove(productId: string, productMediaId: string) {
    return this.runMutation(productId, async (tx) => {
      const relation = await this.requireRelation(tx, productId, productMediaId);
      await tx.productMedia.delete({ where: { id: relation.id } });
      const remaining = await tx.productMedia.findMany({
        where: { productId }, select: { id: true, role: true, sortOrder: true }, orderBy: { sortOrder: 'asc' },
      });
      const primaryId = relation.role === ProductMediaRole.PRIMARY
        ? remaining[0]?.id
        : remaining.find((item) => item.role === ProductMediaRole.PRIMARY)?.id;
      await this.normalizeOrder(tx, productId, primaryId);
      return { removed: true, mediaAssetId: relation.mediaAssetId };
    });
  }

  async reorder(productId: string, productMediaIds: string[]) {
    return this.runMutation(productId, async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId }, select: { id: true } });
      if (!product) throw new NotFoundException('Product not found.');
      const current = await tx.productMedia.findMany({ where: { productId }, select: { id: true, role: true } });
      if (productMediaIds.length !== current.length || new Set(productMediaIds).size !== productMediaIds.length) {
        throw new BadRequestException('Reorder must include every product media relation exactly once.');
      }
      const currentIds = new Set(current.map((item) => item.id));
      if (productMediaIds.some((id) => !currentIds.has(id))) {
        throw new BadRequestException('All reordered media must belong to the same product.');
      }
      const primaryId = current.find((item) => item.role === ProductMediaRole.PRIMARY)?.id ?? productMediaIds[0];
      const ordered = [primaryId, ...productMediaIds.filter((id) => id !== primaryId)];
      await this.writeOrder(tx, productId, ordered);
      return this.listWithClient(tx, productId);
    });
  }

  private serializable<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(callback, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async runMutation<T>(productId: string, callback: (tx: Prisma.TransactionClient) => Promise<T>) {
    try {
      const result = await this.serializable(callback);
      await this.invalidateProductCaches(productId);
      return result;
    } catch (error) {
      this.translateWriteConflict(error);
      throw error;
    }
  }

  private async invalidateProductCaches(productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { slug: true } });
    const registryKey = 'products:list:keys';
    const listKeys = (await this.cacheManager.get<string[]>(registryKey)) ?? [];
    await Promise.all([
      ...listKeys.map((key) => this.cacheManager.del(key)),
      this.cacheManager.del(registryKey),
      this.cacheManager.del(`products:detail:${productId}`),
      ...(product?.slug ? [this.cacheManager.del(`products:detail:${product.slug}`)] : []),
    ]);
  }

  private async requireRelation(tx: Prisma.TransactionClient, productId: string, id: string) {
    const relation = await tx.productMedia.findFirst({ where: { id, productId } });
    if (!relation) throw new NotFoundException('Product media relation not found.');
    return relation;
  }

  private async normalizeOrder(tx: Prisma.TransactionClient, productId: string, preferredPrimaryId?: string) {
    const relations = await tx.productMedia.findMany({ where: { productId }, select: { id: true, role: true }, orderBy: { sortOrder: 'asc' } });
    if (!relations.length) return;
    const primaryId = preferredPrimaryId
      ?? relations.find((item) => item.role === ProductMediaRole.PRIMARY)?.id
      ?? relations[0].id;
    await tx.productMedia.updateMany({ where: { productId }, data: { role: ProductMediaRole.GALLERY } });
    await tx.productMedia.update({ where: { id: primaryId }, data: { role: ProductMediaRole.PRIMARY } });
    await this.writeOrder(tx, productId, [primaryId, ...relations.map((item) => item.id).filter((id) => id !== primaryId)]);
  }

  private async writeOrder(tx: Prisma.TransactionClient, productId: string, ids: string[]) {
    // Temporary negative values avoid collisions with @@unique(productId, sortOrder).
    for (let index = 0; index < ids.length; index += 1) {
      await tx.productMedia.update({ where: { id: ids[index] }, data: { sortOrder: -(index + 1) } });
    }
    for (let index = 0; index < ids.length; index += 1) {
      await tx.productMedia.update({ where: { id: ids[index] }, data: { sortOrder: index } });
    }
  }

  private async findRelation(tx: Prisma.TransactionClient, productId: string, id: string) {
    return tx.productMedia.findFirstOrThrow({ where: { id, productId }, include: galleryInclude });
  }

  private async listWithClient(tx: Prisma.TransactionClient, productId: string) {
    const media = await tx.productMedia.findMany({ where: { productId }, include: galleryInclude, orderBy: { sortOrder: 'asc' } });
    return normalizeProductGallery({ images: [], media }).gallery;
  }

  private translateWriteConflict(error: unknown): never | void {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
    if (code === 'P2002') throw new ConflictException('This image is already attached or the gallery was modified concurrently.');
    if (code === 'P2034') throw new ConflictException('The gallery was modified concurrently. Please retry.');
  }
}
