import { BadRequestException } from '@nestjs/common';
import { AttributeDataType } from '@prisma/client';

import { AttributesService } from './attributes.service';

const definition = (code: string, dataType: AttributeDataType, allowedValues: string[] | null = null) => ({
  id: `${code}-id`, code, nameAr: code, nameEn: code, description: null,
  dataType, unit: null, allowedValues, isActive: true,
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
    attributeProfile: { findFirst: jest.fn().mockResolvedValue(profile) },
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
});
