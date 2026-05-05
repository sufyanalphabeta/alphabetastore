import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Prisma } from '@prisma/client';
import type { Cache } from 'cache-manager';

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
          sortOrder: createCategoryDto.sortOrder ?? 0,
          icon: createCategoryDto.icon,
        },
        include: categoryInclude,
      });

      await this.cacheManager.del(CATEGORIES_CACHE_KEY);

      return category;
    } catch (error) {
      this.handleUniqueConstraint(error, 'Category slug already exists.');
      throw error;
    }
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
          sortOrder: updateCategoryDto.sortOrder,
          icon: updateCategoryDto.icon,
        },
        include: categoryInclude,
      });

      await this.cacheManager.del(CATEGORIES_CACHE_KEY);

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

    await this.cacheManager.del(CATEGORIES_CACHE_KEY);

    return {
      message: 'Category deleted successfully.',
    };
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
}