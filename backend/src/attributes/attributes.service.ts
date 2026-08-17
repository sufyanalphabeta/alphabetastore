import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { AttributeDataType, Prisma, ProductStatus } from '@prisma/client';
import type { Cache } from 'cache-manager';

import { PrismaService } from '../prisma/prisma.service';
import {
  AttributeProfileItemDto,
  CreateAttributeDefinitionDto,
  CreateAttributeProfileDto,
  UpdateAttributeDefinitionDto,
  UpdateAttributeProfileDto,
} from './dto/attribute.dto';

type AttributeValueInput = { code: string; value: unknown };
type StoredValue = {
  attributeDefinitionId: string;
  textValue?: string;
  numberValue?: Prisma.Decimal;
  booleanValue?: boolean;
  jsonValue?: Prisma.InputJsonValue;
};

const profileInclude = {
  items: {
    orderBy: [{ sortOrder: 'asc' as const }, { attributeDefinition: { code: 'asc' as const } }],
    include: { attributeDefinition: true },
  },
  categories: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.AttributeProfileInclude;

@Injectable()
export class AttributesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  listDefinitions(includeInactive = true) {
    return this.prisma.attributeDefinition.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ isActive: 'desc' }, { nameAr: 'asc' }],
    });
  }

  async createDefinition(dto: CreateAttributeDefinitionDto) {
    this.validateAllowedValues(dto.dataType, dto.allowedValues);
    try {
      return await this.prisma.attributeDefinition.create({
        data: { ...dto, code: dto.code.trim().toLowerCase(), allowedValues: dto.allowedValues ?? Prisma.JsonNull },
      });
    } catch (error) {
      this.rethrowUnique(error, 'Attribute code already exists.');
    }
  }

  async updateDefinition(id: string, dto: UpdateAttributeDefinitionDto) {
    const current = await this.prisma.attributeDefinition.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Attribute definition not found.');
    const nextType = dto.dataType ?? current.dataType;
    const nextAllowed = dto.allowedValues ?? this.jsonStringArray(current.allowedValues);
    this.validateAllowedValues(nextType, nextAllowed);
    if (dto.dataType && dto.dataType !== current.dataType) {
      const used = await this.prisma.productAttributeValue.count({ where: { attributeDefinitionId: id } });
      if (used) throw new ConflictException('Cannot change the type of an attribute that already has product values.');
    }
    try {
      const updated = await this.prisma.attributeDefinition.update({
        where: { id },
        data: {
          ...dto,
          code: dto.code?.trim().toLowerCase(),
          allowedValues: dto.allowedValues === undefined ? undefined : dto.allowedValues,
        },
      });
      await this.invalidateCatalogCaches();
      return updated;
    } catch (error) {
      this.rethrowUnique(error, 'Attribute code already exists.');
    }
  }

  async removeDefinition(id: string) {
    const [profileUse, valueUse] = await Promise.all([
      this.prisma.attributeProfileItem.count({ where: { attributeDefinitionId: id } }),
      this.prisma.productAttributeValue.count({ where: { attributeDefinitionId: id } }),
    ]);
    if (profileUse || valueUse) {
      throw new ConflictException('Deactivate this attribute instead; it is already used by profiles or products.');
    }
    await this.prisma.attributeDefinition.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Attribute definition not found.');
    });
    return { deleted: true };
  }

  listProfiles() {
    return this.prisma.attributeProfile.findMany({ include: profileInclude, orderBy: { name: 'asc' } });
  }

  async getProfile(id: string) {
    const profile = await this.prisma.attributeProfile.findUnique({ where: { id }, include: profileInclude });
    if (!profile) throw new NotFoundException('Attribute profile not found.');
    return profile;
  }

  async createProfile(dto: CreateAttributeProfileDto) {
    this.ensureUniqueItems(dto.items);
    await this.ensureDefinitionsExist(dto.items);
    return this.prisma.attributeProfile.create({
      data: {
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive ?? true,
        items: { create: dto.items.map((item, index) => this.profileItemData(item, index)) },
      },
      include: profileInclude,
    });
  }

  async updateProfile(id: string, dto: UpdateAttributeProfileDto) {
    await this.getProfile(id);
    if (dto.items) {
      this.ensureUniqueItems(dto.items);
      await this.ensureDefinitionsExist(dto.items);
    }
    const profile = await this.prisma.$transaction(async (tx) => {
      if (dto.items) await tx.attributeProfileItem.deleteMany({ where: { profileId: id } });
      return tx.attributeProfile.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          isActive: dto.isActive,
          items: dto.items
            ? { create: dto.items.map((item, index) => this.profileItemData(item, index)) }
            : undefined,
        },
        include: profileInclude,
      });
    });
    await this.invalidateCatalogCaches();
    return profile;
  }

  async removeProfile(id: string) {
    const categories = await this.prisma.category.count({ where: { attributeProfileId: id } });
    if (categories) throw new ConflictException('Remove this profile from its categories before deleting it.');
    await this.prisma.attributeProfile.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Attribute profile not found.');
    });
    await this.invalidateCatalogCaches();
    return { deleted: true };
  }

  async assignCategoryProfile(categoryId: string, attributeProfileId: string | null) {
    if (attributeProfileId) await this.getProfile(attributeProfileId);
    const category = await this.prisma.category.update({
      where: { id: categoryId },
      data: { attributeProfileId },
      select: { id: true, name: true, slug: true, attributeProfileId: true },
    }).catch(() => { throw new NotFoundException('Category not found.'); });
    await this.invalidateCatalogCaches();
    return category;
  }

  async resolveEffectiveProfile(categoryId: string) {
    const categories = await this.prisma.category.findMany({
      select: { id: true, name: true, slug: true, parentId: true, attributeProfileId: true },
    });
    const byId = new Map(categories.map((category) => [category.id, category]));
    const visited = new Set<string>();
    let current = byId.get(categoryId);
    let inheritedFrom: typeof current | null = null;
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      if (current.attributeProfileId) {
        inheritedFrom = current;
        const profile = await this.prisma.attributeProfile.findFirst({
          where: { id: current.attributeProfileId, isActive: true }, include: profileInclude,
        });
        if (profile) return { profile, inheritedFrom, isInherited: current.id !== categoryId };
      }
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return { profile: null, inheritedFrom: null, isInherited: false };
  }

  async getAdminProductAttributes(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true, categoryId: true,
        attributeValues: { include: { attributeDefinition: true } },
      },
    });
    if (!product) throw new NotFoundException('Product not found.');
    const effective = await this.resolveEffectiveProfile(product.categoryId);
    return {
      categoryId: product.categoryId,
      ...effective,
      values: product.attributeValues.map((item) => ({
        code: item.attributeDefinition.code,
        value: this.readStoredValue(item),
      })),
    };
  }

  async replaceProductValues(productId: string, categoryId: string, values: AttributeValueInput[]) {
    const stored = await this.prepareValues(categoryId, values);
    await this.prisma.$transaction(async (tx) => {
      await tx.productAttributeValue.deleteMany({ where: { productId } });
      if (stored.length) {
        await tx.productAttributeValue.createMany({ data: stored.map((value) => ({ productId, ...value })) });
      }
      await tx.product.update({
        where: { id: productId },
        data: { catalogReviewedAt: null, catalogReviewedByUserId: null },
      });
    });
    await this.invalidateCatalogCaches();
    return this.getAdminProductAttributes(productId);
  }

  async prepareValues(categoryId: string, values: AttributeValueInput[]) {
    const effective = await this.resolveEffectiveProfile(categoryId);
    if (!effective.profile && values.length) throw new BadRequestException('This category has no active attribute profile.');
    const allowed = new Map((effective.profile?.items ?? []).map((item) => [item.attributeDefinition.code, item.attributeDefinition]));
    const seen = new Set<string>();
    const stored: StoredValue[] = [];
    for (const input of values) {
      const code = input.code.trim().toLowerCase();
      if (seen.has(code)) throw new BadRequestException(`Duplicate attribute value: ${code}`);
      seen.add(code);
      const definition = allowed.get(code);
      if (!definition?.isActive) throw new BadRequestException(`Attribute "${code}" is not available for this category.`);
      if (!this.isBlank(input.value)) stored.push(this.normalizeValue(definition, input.value));
    }
    return stored;
  }

  async validateValuesForCategory(categoryId: string, values: AttributeValueInput[], requireRequired = false) {
    const effective = await this.resolveEffectiveProfile(categoryId);
    if (!effective.profile) {
      if (values.some((value) => !this.isBlank(value.value))) throw new BadRequestException('This category has no active attribute profile.');
      return [];
    }
    const allowed = new Map(effective.profile.items.map((item) => [item.attributeDefinition.code, item]));
    const present = new Set<string>();
    for (const input of values) {
      const code = input.code.trim().toLowerCase();
      const item = allowed.get(code);
      if (!item?.attributeDefinition.isActive) throw new BadRequestException(`Attribute "${code}" is not available for this category.`);
      if (!this.isBlank(input.value)) {
        this.normalizeValue(item.attributeDefinition, input.value);
        present.add(code);
      }
    }
    if (!requireRequired) return [];
    return effective.profile.items
      .filter((item) => item.required && item.attributeDefinition.isActive && !present.has(item.attributeDefinition.code))
      .map((item) => item.attributeDefinition.code);
  }

  async missingRequiredForProduct(productId: string) {
    const state = await this.getAdminProductAttributes(productId);
    if (!state.profile) return [];
    const present = new Set(state.values.filter((item) => !this.isBlank(item.value)).map((item) => item.code));
    return state.profile.items
      .filter((item) => item.required && item.attributeDefinition.isActive && !present.has(item.attributeDefinition.code))
      .map((item) => item.attributeDefinition.code);
  }

  async publicProductAttributes(productId: string, categoryId: string, legacySpecs: unknown) {
    const [effective, values] = await Promise.all([
      this.resolveEffectiveProfile(categoryId),
      this.prisma.productAttributeValue.findMany({
        where: { productId }, include: { attributeDefinition: true },
      }),
    ]);
    if (!effective.profile) return { attributes: [], specs: this.legacySpecs(legacySpecs), comparisonAttributes: [] };
    const valueMap = new Map(values.map((value) => [value.attributeDefinitionId, this.readStoredValue(value)]));
    const attributes = effective.profile.items
      .filter((item) => item.visibleOnProduct && item.attributeDefinition.isActive && valueMap.has(item.attributeDefinitionId))
      .map((item) => this.publicAttribute(item, valueMap.get(item.attributeDefinitionId)));
    const comparisonAttributes = effective.profile.items
      .filter((item) => item.comparable && item.attributeDefinition.isActive && valueMap.has(item.attributeDefinitionId))
      .map((item) => this.publicAttribute(item, valueMap.get(item.attributeDefinitionId)));
    const dynamicKeys = new Set(effective.profile.items.flatMap((item) => [
      item.attributeDefinition.code,
      item.attributeDefinition.nameAr,
      item.attributeDefinition.nameEn,
    ].filter(Boolean).map((key) => String(key).toLocaleLowerCase())));
    const legacy = this.legacySpecs(legacySpecs).filter((item) => !dynamicKeys.has(item.label.toLocaleLowerCase()));
    return { attributes, specs: [...attributes, ...legacy], comparisonAttributes };
  }

  async publicFilterProfile(categorySlug: string) {
    const category = await this.prisma.category.findFirst({
      where: { OR: [{ slug: categorySlug }, { id: categorySlug }] }, select: { id: true },
    });
    if (!category) throw new NotFoundException('Category not found.');
    const effective = await this.resolveEffectiveProfile(category.id);
    if (!effective.profile) return { profile: null, filters: [] };
    const scope = await this.descendantIds(category.id);
    const filters = await Promise.all(effective.profile.items
      .filter((item) => item.filterable && item.attributeDefinition.isActive)
      .map(async (item) => {
        const rows = await this.prisma.productAttributeValue.findMany({
          where: {
            attributeDefinitionId: item.attributeDefinitionId,
            product: { status: ProductStatus.ACTIVE, categoryId: { in: scope } },
          },
          select: { textValue: true, numberValue: true, booleanValue: true, jsonValue: true },
        });
        const values = rows.flatMap((row) => {
          const value = this.readStoredValue(row);
          return Array.isArray(value) ? value : [value];
        }).filter((value) => value !== null && value !== undefined);
        const numeric = item.attributeDefinition.dataType === AttributeDataType.NUMBER;
        return {
          code: item.attributeDefinition.code,
          nameAr: item.attributeDefinition.nameAr,
          nameEn: item.attributeDefinition.nameEn,
          dataType: item.attributeDefinition.dataType,
          unit: item.attributeDefinition.unit,
          allowedValues: item.attributeDefinition.allowedValues,
          ...(numeric
            ? { min: values.length ? Math.min(...values.map(Number)) : null, max: values.length ? Math.max(...values.map(Number)) : null }
            : { values: [...new Set(values.map(String))].sort() }),
        };
      }));
    return { profile: { id: effective.profile.id, name: effective.profile.name }, filters };
  }

  async buildProductWhere(categoryId: string, filters: Record<string, unknown>): Promise<Prisma.ProductWhereInput[]> {
    const effective = await this.resolveEffectiveProfile(categoryId);
    const items = new Map((effective.profile?.items ?? []).map((item) => [item.attributeDefinition.code, item]));
    const clauses: Prisma.ProductWhereInput[] = [];
    for (const [code, raw] of Object.entries(filters)) {
      const item = items.get(code);
      if (!item?.filterable || !item.attributeDefinition.isActive) throw new BadRequestException(`Attribute filter "${code}" is not available.`);
      const filter = raw && typeof raw === 'object' ? raw as Record<string, unknown> : { values: [raw] };
      if (item.attributeDefinition.dataType === AttributeDataType.NUMBER) {
        const min = filter.min === undefined ? undefined : Number(filter.min);
        const max = filter.max === undefined ? undefined : Number(filter.max);
        if ((min !== undefined && !Number.isFinite(min)) || (max !== undefined && !Number.isFinite(max))) {
          throw new BadRequestException(`Invalid numeric filter for "${code}".`);
        }
        clauses.push({ attributeValues: { some: { attributeDefinitionId: item.attributeDefinitionId, numberValue: { gte: min, lte: max } } } });
      } else {
        const values = Array.isArray(filter.values) ? filter.values.map(String) : [String(filter.values ?? '')].filter(Boolean);
        if (!values.length) continue;
        if (item.attributeDefinition.dataType === AttributeDataType.MULTI_SELECT) {
          clauses.push({ attributeValues: { some: { attributeDefinitionId: item.attributeDefinitionId, jsonValue: { array_contains: values } } } });
        } else if (item.attributeDefinition.dataType === AttributeDataType.BOOLEAN) {
          clauses.push({ attributeValues: { some: { attributeDefinitionId: item.attributeDefinitionId, booleanValue: values[0] === 'true' } } });
        } else {
          clauses.push({ attributeValues: { some: { attributeDefinitionId: item.attributeDefinitionId, textValue: { in: values } } } });
        }
      }
    }
    return clauses;
  }

  private normalizeValue(definition: { id: string; code: string; dataType: AttributeDataType; allowedValues: Prisma.JsonValue }, raw: unknown): StoredValue {
    const base = { attributeDefinitionId: definition.id };
    if (definition.dataType === AttributeDataType.NUMBER) {
      const number = Number(raw);
      if (!Number.isFinite(number)) throw new BadRequestException(`Attribute "${definition.code}" must be a number.`);
      return { ...base, numberValue: new Prisma.Decimal(number) };
    }
    if (definition.dataType === AttributeDataType.BOOLEAN) {
      if (![true, false, 'true', 'false'].includes(raw as never)) throw new BadRequestException(`Attribute "${definition.code}" must be boolean.`);
      return { ...base, booleanValue: raw === true || raw === 'true' };
    }
    const allowed = this.jsonStringArray(definition.allowedValues);
    if (definition.dataType === AttributeDataType.MULTI_SELECT) {
      const values = Array.isArray(raw) ? [...new Set(raw.map(String).map((value) => value.trim()).filter(Boolean))] : [];
      if (!values.length) throw new BadRequestException(`Attribute "${definition.code}" must contain at least one value.`);
      if (values.some((value) => !allowed.includes(value))) throw new BadRequestException(`Attribute "${definition.code}" contains an unsupported option.`);
      return { ...base, jsonValue: values };
    }
    const value = String(raw).trim();
    if (!value) throw new BadRequestException(`Attribute "${definition.code}" cannot be blank.`);
    if (definition.dataType === AttributeDataType.SELECT && !allowed.includes(value)) {
      throw new BadRequestException(`Attribute "${definition.code}" contains an unsupported option.`);
    }
    return { ...base, textValue: value };
  }

  private readStoredValue(value: { textValue?: string | null; numberValue?: Prisma.Decimal | null; booleanValue?: boolean | null; jsonValue?: Prisma.JsonValue | null }) {
    if (value.textValue !== null && value.textValue !== undefined) return value.textValue;
    if (value.numberValue !== null && value.numberValue !== undefined) return Number(value.numberValue);
    if (value.booleanValue !== null && value.booleanValue !== undefined) return value.booleanValue;
    return value.jsonValue ?? null;
  }

  private publicAttribute(item: Prisma.AttributeProfileItemGetPayload<{ include: { attributeDefinition: true } }>, value: unknown) {
    return {
      code: item.attributeDefinition.code,
      label: item.attributeDefinition.nameAr,
      nameEn: item.attributeDefinition.nameEn,
      dataType: item.attributeDefinition.dataType,
      unit: item.attributeDefinition.unit,
      value,
      displayValue: Array.isArray(value) ? value.join('، ') : `${value}${item.attributeDefinition.unit ? ` ${item.attributeDefinition.unit}` : ''}`,
      sortOrder: item.sortOrder,
    };
  }

  private legacySpecs(specs: unknown) {
    if (!specs || typeof specs !== 'object' || Array.isArray(specs)) return [];
    return Object.entries(specs as Record<string, unknown>)
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([label, value], index) => ({ code: null, label, value, displayValue: String(value), legacy: true, sortOrder: 10_000 + index }));
  }

  private validateAllowedValues(dataType: AttributeDataType, allowedValues?: string[]) {
    const usesOptions = dataType === AttributeDataType.SELECT || dataType === AttributeDataType.MULTI_SELECT;
    if (usesOptions && (!allowedValues?.length || allowedValues.some((value) => !value.trim()))) {
      throw new BadRequestException('Select attributes require non-empty allowed values.');
    }
    if (!usesOptions && allowedValues?.length) throw new BadRequestException('Allowed values are only valid for SELECT attributes.');
  }

  private jsonStringArray(value: Prisma.JsonValue | null | undefined) {
    return Array.isArray(value) ? value.map(String) : [];
  }

  private ensureUniqueItems(items: AttributeProfileItemDto[]) {
    const ids = items.map((item) => item.attributeDefinitionId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('A profile cannot contain the same attribute twice.');
  }

  private async ensureDefinitionsExist(items: AttributeProfileItemDto[]) {
    const ids = [...new Set(items.map((item) => item.attributeDefinitionId))];
    const count = await this.prisma.attributeDefinition.count({ where: { id: { in: ids } } });
    if (count !== ids.length) throw new BadRequestException('One or more attribute definitions do not exist.');
  }

  private profileItemData(item: AttributeProfileItemDto, index: number) {
    return {
      attributeDefinitionId: item.attributeDefinitionId,
      required: item.required ?? false,
      filterable: item.filterable ?? false,
      comparable: item.comparable ?? false,
      visibleOnProduct: item.visibleOnProduct ?? true,
      visibleInSummary: item.visibleInSummary ?? false,
      sortOrder: item.sortOrder ?? index,
    };
  }

  private isBlank(value: unknown) {
    return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
  }

  private async descendantIds(rootId: string) {
    const rows = await this.prisma.category.findMany({ select: { id: true, parentId: true } });
    const ids = new Set([rootId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const row of rows) if (row.parentId && ids.has(row.parentId) && !ids.has(row.id)) { ids.add(row.id); changed = true; }
    }
    return [...ids];
  }

  private rethrowUnique(error: unknown, message: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException(message);
    throw error;
  }

  private async invalidateCatalogCaches() {
    await this.cacheManager.clear();
  }
}
