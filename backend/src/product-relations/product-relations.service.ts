import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRelationDto, ProductRelationType } from './dto/create-relation.dto';

const targetProductSelect = {
  id: true,
  name: true,
  slug: true,
  price: true,
  comparePrice: true,
  stockQty: true,
  ratingAvg: true,
  ratingCount: true,
  images: {
    select: { imageUrl: true },
    orderBy: { sortOrder: 'asc' as const },
    take: 1,
  },
};

@Injectable()
export class ProductRelationsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Public ──────────────────────────────────────────────────────────────────

  async findRelatedGrouped(sourceId: string) {
    const source = await this.prisma.product.findFirst({ where: { id: sourceId, status: 'ACTIVE' }, select: { id: true } });
    if (!source) throw new NotFoundException('Product not found.');
    const rows = await this.prisma.productRelation.findMany({
      where: { sourceId, target: { status: 'ACTIVE' } },
      include: { target: { select: targetProductSelect } },
      orderBy: { sortOrder: 'asc' },
    });

    const grouped: Record<string, (typeof rows)[0]['target'][]> = {};
    for (const row of rows) {
      if (!grouped[row.relationType]) grouped[row.relationType] = [];
      grouped[row.relationType].push(row.target);
    }
    return grouped;
  }

  async findByType(sourceId: string, relationType: ProductRelationType) {
    const rows = await this.prisma.productRelation.findMany({
      where: { sourceId, relationType, source: { status: 'ACTIVE' }, target: { status: 'ACTIVE' } },
      include: { target: { select: targetProductSelect } },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map(r => r.target);
  }

  // ── Admin ────────────────────────────────────────────────────────────────────

  async create(sourceId: string, dto: CreateRelationDto) {
    if (sourceId === dto.targetId) {
      throw new ConflictException('A product cannot be related to itself.');
    }
    try {
      return await this.prisma.productRelation.create({
        data: {
          sourceId,
          targetId: dto.targetId,
          relationType: dto.relationType as any,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002')
        throw new ConflictException('This relation already exists.');
      if (error?.code === 'P2003')
        throw new NotFoundException('Source or target product not found.');
      throw error;
    }
  }

  async remove(sourceId: string, targetId: string, relationType: ProductRelationType) {
    const existing = await this.prisma.productRelation.findFirst({
      where: { sourceId, targetId, relationType: relationType as any },
    });
    if (!existing) throw new NotFoundException('Relation not found.');
    return this.prisma.productRelation.delete({ where: { id: existing.id } });
  }
}
