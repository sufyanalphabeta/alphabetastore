import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { MEDIA_MAX_PRODUCT_IMAGES } from './media.constants';

@Injectable()
export class ProductMediaService {
  constructor(private readonly prisma: PrismaService) {}

  async attachImage(productId: string, mediaAssetId: string, role: 'PRIMARY' | 'GALLERY' = 'GALLERY') {
    const [product, asset] = await Promise.all([
      this.prisma.product.findUnique({ where: { id: productId }, select: { id: true } }),
      this.prisma.mediaAsset.findUnique({ where: { id: mediaAssetId }, select: { id: true, mediaType: true, processingStatus: true } }),
    ]);
    if (!product) throw new NotFoundException('Product not found.');
    if (!asset) throw new NotFoundException('Media asset not found.');
    if (asset.mediaType !== 'IMAGE' || asset.processingStatus !== 'READY') throw new BadRequestException('Only ready images can be attached.');

    const count = await this.prisma.productMedia.count({ where: { productId, mediaAsset: { mediaType: 'IMAGE' } } });
    if (count >= MEDIA_MAX_PRODUCT_IMAGES) throw new BadRequestException('A product can have up to 4 images.');
    if (role === 'PRIMARY') {
      await this.prisma.productMedia.updateMany({ where: { productId, role: 'PRIMARY' }, data: { role: 'GALLERY' } });
    }
    return this.prisma.productMedia.create({ data: { productId, mediaAssetId, role, sortOrder: count } });
  }
}
