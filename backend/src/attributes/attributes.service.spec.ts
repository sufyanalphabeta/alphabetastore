import { BadRequestException } from '@nestjs/common';
import { AttributeDataType } from '@prisma/client';

import { AttributesService } from './attributes.service';

const definition = (code: string, dataType: AttributeDataType, allowedValues: string[] | null = null) => ({
  id: `${code}-id`, code, nameAr: code, nameEn: code, description: null,
  dataType, unit: null as string | null, allowedValues, isActive: true,
});

function setup() {
  const profile = {
    id: 'profile-1', name: 'Generic profile', description: null, isActive: true,
    items: [
      { attributeDefinitionId: 'capacity-id', required: true, filterable: true, comparable: true, visibleOnProduct: true, visibleInSummary: true, sortOrder: 10, attributeDefinition: definition('capacity', AttributeDataType.SELECT, ['1 TB', '2 TB']) },
      { attributeDefinitionId: 'enabled-id', required: false, filterable: true, comparable: true, visibleOnProduct: true, visibleInSummary: false, sortOrder: 20, attributeDefinition: definition('enabled', AttributeDataType.BOOLEAN) },
      { attributeDefinitionId: 'tags-id', required: false, filterable: true, comparable: false, visibleOnProduct: true, visibleInSummary: false, sortOrder: 30, attributeDefinition: definition('tags', AttributeDataType.MULTI_SELECT, ['A', 'B', 'C']) },
    ], categories: [],
  };
  const prisma = {
    category: { findMany: jest.fn().mockResolvedValue([{ id: 'category-1', name: 'Root', slug: 'root', parentId: null, attributeProfileId: 'profile-1' }]) },
    attributeProfile: { findFirst: jest.fn().mockResolvedValue(profile), findMany: jest.fn().mockResolvedValue([profile]) },
    productAttributeValue: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const cache = { clear: jest.fn(), del: jest.fn() };
  return { service: new AttributesService(prisma as never, cache as never), prisma, profile };
}

describe('AttributesService dynamic attribute rules', () => {
  it('normalizes typed values and rejects unsupported options', async () => {
    const { service } = setup();
    await expect(service.prepareValues('category-1', [
      { code: 'capacity', value: '2 TB' },
      { code: 'enabled', value: 'true' },
      { code: 'tags', value: ['A', 'B'] },
    ])).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ attributeDefinitionId: 'capacity-id', textValue: '2 TB' }),
      expect.objectContaining({ attributeDefinitionId: 'enabled-id', booleanValue: true }),
      expect.objectContaining({ attributeDefinitionId: 'tags-id', jsonValue: ['A', 'B'] }),
    ]));
    await expect(service.prepareValues('category-1', [{ code: 'capacity', value: '8 TB' }]))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects attributes outside the effective profile and reports required values', async () => {
    const { service } = setup();
    await expect(service.prepareValues('category-1', [{ code: 'unknown', value: 'x' }]))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(service.validateValuesForCategory('category-1', [], true)).resolves.toEqual(['capacity']);
  });

  it('builds multi-select filters as OR matches for selected options', async () => {
    const { service } = setup();
    const clauses = await service.buildProductWhere('category-1', { tags: { values: ['A', 'B'] } });
    expect(clauses).toEqual([{
      OR: [
        { attributeValues: { some: { attributeDefinitionId: 'tags-id', jsonValue: { array_contains: ['A'] } } } },
        { attributeValues: { some: { attributeDefinitionId: 'tags-id', jsonValue: { array_contains: ['B'] } } } },
      ],
    }]);
  });

  it('resolves a profile from the current category without exposing profile internals publicly', async () => {
    const { service } = setup();
    const result = await service.publicProductAttributes('product-1', 'category-1', { Capacity: '2 TB' });
    expect(result).toEqual({ attributes: [], specs: [], comparisonAttributes: [] });
  });

  it('returns only configured, valued summary attributes in stable order and format', async () => {
    const { service, prisma, profile } = setup();
    profile.items = [
      { attributeDefinitionId: 'cpu-id', required: false, filterable: true, comparable: true, visibleOnProduct: true, visibleInSummary: true, sortOrder: 30, attributeDefinition: { ...definition('cpu', AttributeDataType.TEXT), nameAr: 'المعالج' } },
      { attributeDefinitionId: 'ram-id', required: false, filterable: true, comparable: true, visibleOnProduct: true, visibleInSummary: true, sortOrder: 10, attributeDefinition: { ...definition('ram', AttributeDataType.NUMBER), nameAr: 'الذاكرة', unit: 'GB' } },
      { attributeDefinitionId: 'ports-id', required: false, filterable: true, comparable: true, visibleOnProduct: true, visibleInSummary: true, sortOrder: 20, attributeDefinition: { ...definition('ports', AttributeDataType.MULTI_SELECT, ['USB-C', 'HDMI']), nameAr: 'المنافذ' } },
      { attributeDefinitionId: 'enabled-id', required: false, filterable: true, comparable: true, visibleOnProduct: true, visibleInSummary: true, sortOrder: 25, attributeDefinition: { ...definition('enabled', AttributeDataType.BOOLEAN), nameAr: 'مفعّل' } },
      { attributeDefinitionId: 'hidden-id', required: false, filterable: true, comparable: true, visibleOnProduct: true, visibleInSummary: false, sortOrder: 1, attributeDefinition: definition('hidden', AttributeDataType.TEXT) },
      { attributeDefinitionId: 'empty-id', required: false, filterable: true, comparable: true, visibleOnProduct: true, visibleInSummary: true, sortOrder: 40, attributeDefinition: definition('empty', AttributeDataType.TEXT) },
    ];
    prisma.productAttributeValue.findMany.mockResolvedValueOnce([
      { productId: 'product-1', attributeDefinitionId: 'cpu-id', textValue: 'Core Ultra 7', numberValue: null, booleanValue: null, jsonValue: null },
      { productId: 'product-1', attributeDefinitionId: 'ram-id', textValue: null, numberValue: 32, booleanValue: null, jsonValue: null },
      { productId: 'product-1', attributeDefinitionId: 'ports-id', textValue: null, numberValue: null, booleanValue: null, jsonValue: ['USB-C', 'HDMI'] },
      { productId: 'product-1', attributeDefinitionId: 'enabled-id', textValue: null, numberValue: null, booleanValue: false, jsonValue: null },
      { productId: 'product-1', attributeDefinitionId: 'hidden-id', textValue: 'secret', numberValue: null, booleanValue: null, jsonValue: null },
    ]);

    const result = await service.publicSummaryAttributesForProducts([{ id: 'product-1', categoryId: 'category-1' }]);

    expect(result.get('product-1')).toEqual([
      { code: 'ram', label: 'الذاكرة', displayValue: '32 GB', sortOrder: 10 },
      { code: 'ports', label: 'المنافذ', displayValue: 'USB-C، HDMI', sortOrder: 20 },
      { code: 'enabled', label: 'مفعّل', displayValue: 'لا', sortOrder: 25 },
      { code: 'cpu', label: 'المعالج', displayValue: 'Core Ultra 7', sortOrder: 30 },
    ]);
    expect(prisma.category.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.attributeProfile.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.productAttributeValue.findMany).toHaveBeenCalledTimes(1);
  });

  it('inherits active profiles, caps summaries at five, and returns an empty array without values', async () => {
    const { service, prisma, profile } = setup();
    prisma.category.findMany.mockResolvedValueOnce([
      { id: 'parent', parentId: null, attributeProfileId: 'profile-1' },
      { id: 'child', parentId: 'parent', attributeProfileId: null },
      { id: 'plain', parentId: null, attributeProfileId: null },
    ]);
    profile.items = Array.from({ length: 7 }, (_, index) => ({
      attributeDefinitionId: `a${index}-id`, required: false, filterable: false, comparable: false,
      visibleOnProduct: true, visibleInSummary: true, sortOrder: index,
      attributeDefinition: definition(`a${index}`, AttributeDataType.SELECT, [`V${index}`]),
    }));
    prisma.productAttributeValue.findMany.mockResolvedValueOnce(profile.items.map((item, index) => ({
      productId: 'product-1', attributeDefinitionId: item.attributeDefinitionId,
      textValue: `V${index}`, numberValue: null, booleanValue: null, jsonValue: null,
    })));

    const result = await service.publicSummaryAttributesForProducts([
      { id: 'product-1', category: { id: 'child' } },
      { id: 'product-2', categoryId: 'plain' },
    ]);

    expect(result.get('product-1')).toHaveLength(5);
    expect(result.get('product-1')?.map((item) => item.code)).toEqual(['a0', 'a1', 'a2', 'a3', 'a4']);
    expect(result.get('product-2')).toEqual([]);
  });

  it('ignores inactive profiles', async () => {
    const { service, prisma } = setup();
    prisma.attributeProfile.findMany.mockResolvedValueOnce([]);
    const result = await service.publicSummaryAttributesForProducts([{ id: 'product-1', categoryId: 'category-1' }]);
    expect(result.get('product-1')).toEqual([]);
    expect(prisma.productAttributeValue.findMany).not.toHaveBeenCalled();
  });
});
