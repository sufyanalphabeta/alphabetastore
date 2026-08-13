import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBundleDto, AddBundleItemDto } from './dto/bundle.dto';
import { UpdateBundleDto } from './dto/update-bundle.dto';

const bundleInclude = {
  items: {
    where: { product: { status: 'ACTIVE' as const } },
    orderBy: { sortOrder: 'asc' as const },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          comparePrice: true,
          stockQty: true,
          images: { select: { imageUrl: true }, orderBy: { sortOrder: 'asc' as const }, take: 1 },
        },
      },
    },
  },
};

@Injectable()
export class BundlesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Public ──────────────────────────────────────────────────────────────────

  async findActive() {
    return this.prisma.bundle.findMany({
      where: { isActive: true, items: { some: { product: { status: 'ACTIVE' } } } },
      include: bundleInclude,
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(id: string) {
    const bundle = await this.prisma.bundle.findFirst({
      where: { id, isActive: true, items: { some: { product: { status: 'ACTIVE' } } } },
      include: bundleInclude,
    });
    if (!bundle) throw new NotFoundException('Bundle not found.');
    return bundle;
  }

  async findBySlug(slug: string) {
    const bundle = await this.prisma.bundle.findFirst({
      where: { slug, isActive: true, items: { some: { product: { status: 'ACTIVE' } } } },
      include: bundleInclude,
    });
    if (!bundle) throw new NotFoundException('Bundle not found.');
    return bundle;
  }

  // ── Admin ────────────────────────────────────────────────────────────────────

  async findAll() {
    return this.prisma.bundle.findMany({
      include: bundleInclude,
      orderBy: { sortOrder: 'asc' },
    });
  }

  async create(dto: CreateBundleDto) {
    const slug = dto.slug ?? this.slugify(dto.name);
    try {
      return await this.prisma.bundle.create({
        data: {
          name: dto.name,
          slug,
          description: dto.description,
          bundlePrice: dto.bundlePrice ?? null,
          imageUrl: dto.imageUrl ?? null,
          isActive: dto.isActive ?? true,
          sortOrder: dto.sortOrder ?? 0,
        },
        include: bundleInclude,
      });
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('Bundle slug already exists.');
      throw error;
    }
  }

  async update(id: string, dto: UpdateBundleDto) {
    await this.ensureExists(id);
    const slug = dto.slug ?? (dto.name ? this.slugify(dto.name) : undefined);
    try {
      return await this.prisma.bundle.update({
        where: { id },
        data: {
          name: dto.name,
          slug,
          description: dto.description,
          bundlePrice: dto.bundlePrice,
          imageUrl: dto.imageUrl,
          isActive: dto.isActive,
          sortOrder: dto.sortOrder,
        },
        include: bundleInclude,
      });
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('Bundle slug already exists.');
      throw error;
    }
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.bundle.delete({ where: { id } });
  }

  async addItem(bundleId: string, dto: AddBundleItemDto) {
    await this.ensureExists(bundleId);
    try {
      return await this.prisma.bundleItem.create({
        data: {
          bundleId,
          productId: dto.productId,
          quantity: dto.quantity ?? 1,
          sortOrder: dto.sortOrder ?? 0,
        },
        include: {
          product: {
            select: { id: true, name: true, slug: true, price: true },
          },
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('Product is already in this bundle.');
      if (error?.code === 'P2003') throw new NotFoundException('Product not found.');
      throw error;
    }
  }

  async removeItem(bundleId: string, productId: string) {
    await this.ensureExists(bundleId);
    const item = await this.prisma.bundleItem.findFirst({
      where: { bundleId, productId },
    });
    if (!item) throw new NotFoundException('Bundle item not found.');
    return this.prisma.bundleItem.delete({ where: { id: item.id } });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async ensureExists(id: string) {
    const bundle = await this.prisma.bundle.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!bundle) throw new NotFoundException('Bundle not found.');
    return bundle;
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 180);
  }
}
