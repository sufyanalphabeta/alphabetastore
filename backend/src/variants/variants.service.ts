import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVariantDto } from './dto/create-variant.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';

@Injectable()
export class VariantsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Public ──────────────────────────────────────────────────────────────────

  async findProductVariants(productId: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, status: 'ACTIVE' }, select: { id: true } });
    if (!product) throw new NotFoundException('Product not found.');
    return this.prisma.productVariant.findMany({
      where: { productId },
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
    });
  }

  // ── Admin ────────────────────────────────────────────────────────────────────

  async create(productId: string, dto: CreateVariantDto) {
    await this.ensureProductExists(productId);

    if (dto.sku) {
      await this.ensureSkuUnique(dto.sku);
    }

    // If this is the first variant or explicitly default, clear others first.
    if (dto.isDefault) {
      await this.clearDefaultFlag(productId);
    }

    const [variant] = await this.prisma.$transaction([
      this.prisma.productVariant.create({
        data: {
          productId,
          name: dto.name,
          sku: dto.sku || null,
          attributes: dto.attributes as any,
          price: dto.price,
          comparePrice: dto.comparePrice ?? null,
          stockQty: dto.stockQty,
          imageUrl: dto.imageUrl ?? null,
          isDefault: dto.isDefault ?? false,
          sortOrder: dto.sortOrder ?? 0,
        },
      }),
      this.prisma.product.update({
        where: { id: productId },
        data: { hasVariants: true },
      }),
    ]);

    return variant;
  }

  async update(variantId: string, productId: string, dto: UpdateVariantDto) {
    const variant = await this.ensureVariantExists(variantId, productId);

    if (dto.sku && dto.sku !== variant.sku) {
      await this.ensureSkuUnique(dto.sku);
    }

    if (dto.isDefault) {
      await this.clearDefaultFlag(productId);
    }

    return this.prisma.productVariant.update({
      where: { id: variantId },
      data: {
        name: dto.name,
        sku: dto.sku !== undefined ? dto.sku || null : undefined,
        attributes: dto.attributes as any,
        price: dto.price,
        comparePrice: dto.comparePrice ?? null,
        stockQty: dto.stockQty,
        imageUrl: dto.imageUrl !== undefined ? dto.imageUrl || null : undefined,
        isDefault: dto.isDefault,
        sortOrder: dto.sortOrder,
      },
    });
  }

  async remove(variantId: string, productId: string) {
    await this.ensureVariantExists(variantId, productId);
    await this.prisma.productVariant.delete({ where: { id: variantId } });

    // If no variants remain, clear the flag on the parent product
    const remaining = await this.prisma.productVariant.count({ where: { productId } });
    if (remaining === 0) {
      await this.prisma.product.update({
        where: { id: productId },
        data: { hasVariants: false },
      });
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async ensureProductExists(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found.');
    return product;
  }

  private async ensureVariantExists(variantId: string, productId: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });
    if (!variant) throw new NotFoundException('Variant not found.');
    return variant;
  }

  private async ensureSkuUnique(sku: string) {
    const existing = await this.prisma.productVariant.findUnique({ where: { sku } });
    if (existing) throw new ConflictException('Variant SKU already exists.');
  }

  private async clearDefaultFlag(productId: string) {
    await this.prisma.productVariant.updateMany({
      where: { productId, isDefault: true },
      data: { isDefault: false },
    });
  }
}
