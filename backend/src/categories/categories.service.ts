import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Prisma } from '@prisma/client';
import type { Cache } from 'cache-manager';
import { createHash } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

const CATEGORIES_CACHE_KEY = 'categories:all';
const CATEGORIES_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const categoryInclude = {
  parent: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
} satisfies Prisma.CategoryInclude;

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async findAll(onlyVisible = false) {
    const cacheKey = onlyVisible ? `${CATEGORIES_CACHE_KEY}:visible` : CATEGORIES_CACHE_KEY;
    const cached = await this.cacheManager.get(cacheKey);

    if (cached) {
      return cached;
    }

    const where = onlyVisible
      ? { isActive: true, isVisible: true }
      : undefined;

    const categories = await this.prisma.category.findMany({
      where,
      include: categoryInclude,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    await this.cacheManager.set(cacheKey, categories, CATEGORIES_CACHE_TTL_MS);

    return categories;
  }

  async create(createCategoryDto: CreateCategoryDto) {
    await this.ensureParentExists(createCategoryDto.parentId);

    try {
      const category = await this.prisma.category.create({
        data: {
          name: createCategoryDto.name,
          slug: createCategoryDto.slug,
          parentId: createCategoryDto.parentId,
          isActive: createCategoryDto.isActive ?? true,
          isVisible: createCategoryDto.isVisible ?? true,
          isFeatured: createCategoryDto.isFeatured ?? false,
          sortOrder: createCategoryDto.sortOrder ?? 0,
          icon: createCategoryDto.icon,
          imageUrl: createCategoryDto.imageUrl,
          description: createCategoryDto.description,
        },
        include: categoryInclude,
      });

      await this.invalidateCache();

      return category;
    } catch (error) {
      this.handleUniqueConstraint(error, 'Category slug already exists.');
      throw error;
    }
  }

  /** Minimal category creation entry point for import workflows. */
  async createFromImport(name: string, parentId?: string) {
    const cleanName = name.trim();
    if (cleanName.length < 2) {
      throw new ConflictException('Category name must contain at least 2 characters.');
    }

    const slugBase = this.slugify(cleanName);
    const slug = slugBase || `category-${createHash('sha1').update(cleanName).digest('hex').slice(0, 12)}`;
    return this.create({ name: cleanName, slug, parentId });
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const existingCategory = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      throw new NotFoundException('Category not found.');
    }

    if (updateCategoryDto.parentId === id) {
      throw new ConflictException('Category cannot be its own parent.');
    }

    await this.ensureParentExists(updateCategoryDto.parentId);

    try {
      const category = await this.prisma.category.update({
        where: { id },
        data: {
          name: updateCategoryDto.name,
          slug: updateCategoryDto.slug,
          parentId: updateCategoryDto.parentId,
          isActive: updateCategoryDto.isActive,
          isVisible: updateCategoryDto.isVisible,
          isFeatured: updateCategoryDto.isFeatured,
          sortOrder: updateCategoryDto.sortOrder,
          icon: updateCategoryDto.icon,
          imageUrl: updateCategoryDto.imageUrl,
          description: updateCategoryDto.description,
        },
        include: categoryInclude,
      });

      await this.invalidateCache();

      return category;
    } catch (error) {
      this.handleUniqueConstraint(error, 'Category slug already exists.');
      throw error;
    }
  }

  async remove(id: string) {
    const existingCategory = await this.prisma.category.findUnique({
      where: { id },
      include: {
        products: {
          select: {
            id: true,
          },
          take: 1,
        },
      },
    });

    if (!existingCategory) {
      throw new NotFoundException('Category not found.');
    }

    if (existingCategory.products.length > 0) {
      throw new ConflictException('Cannot delete category with assigned products.');
    }

    await this.prisma.category.delete({
      where: { id },
    });

    await this.invalidateCache();

    return {
      message: 'Category deleted successfully.',
    };
  }

  /**
   * Build a hierarchical tree from a flat list. The root nodes are those with
   * no parent. Children are nested under each parent's `children` field.
   */
  async findTree(opts: { onlyVisible?: boolean } = {}) {
    const cacheKey = opts.onlyVisible ? 'categories:tree:visible' : 'categories:tree:all';
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const categories = await this.prisma.category.findMany({
      where: opts.onlyVisible ? { isActive: true, isVisible: true } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        isActive: true,
        isVisible: true,
        isFeatured: true,
        sortOrder: true,
        icon: true,
        imageUrl: true,
        description: true,
      },
    });

    type Node = (typeof categories)[number] & { children: Node[] };
    const byId = new Map<string, Node>();
    const roots: Node[] = [];
    for (const c of categories) {
      byId.set(c.id, { ...c, children: [] });
    }
    for (const c of categories) {
      const node = byId.get(c.id)!;
      if (c.parentId && byId.has(c.parentId)) {
        byId.get(c.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    await this.cacheManager.set(cacheKey, roots, CATEGORIES_CACHE_TTL_MS);
    return roots;
  }

  async findFeatured(limit = 12) {
    return this.prisma.category.findMany({
      where: { isActive: true, isVisible: true, isFeatured: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      take: limit,
      select: {
        id: true,
        name: true,
        slug: true,
        icon: true,
        imageUrl: true,
        description: true,
      },
    });
  }

  /** Find a single category by its slug along with its parent and children. */
  async findBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        isActive: true,
        isVisible: true,
        isFeatured: true,
        icon: true,
        imageUrl: true,
        description: true,
        parent: {
          select: { id: true, name: true, slug: true },
        },
        children: {
          where: { isActive: true, isVisible: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: { id: true, name: true, slug: true, icon: true, imageUrl: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found.');
    }

    return category;
  }

  async reorder(items: Array<{ id: string; sortOrder: number }>) {
    await this.prisma.$transaction(
      items.map((i) =>
        this.prisma.category.update({
          where: { id: i.id },
          data: { sortOrder: i.sortOrder },
        }),
      ),
    );
    await this.invalidateCache();
    return { message: 'Categories reordered.' };
  }

  private async invalidateCache() {
    await Promise.all([
      this.cacheManager.del(CATEGORIES_CACHE_KEY),
      this.cacheManager.del(`${CATEGORIES_CACHE_KEY}:visible`),
      this.cacheManager.del('categories:tree:all'),
      this.cacheManager.del('categories:tree:visible'),
    ]);
  }

  private async ensureParentExists(parentId?: string) {
    if (!parentId) {
      return;
    }

    const parentCategory = await this.prisma.category.findUnique({
      where: { id: parentId },
      select: {
        id: true,
      },
    });

    if (!parentCategory) {
      throw new NotFoundException('Parent category not found.');
    }
  }

  private handleUniqueConstraint(error: unknown, message: string) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
  }

  private slugify(name: string): string {
    return name
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 150);
  }
}
