import { existsSync, readFileSync } from 'fs';

import { parseCsvBuffer } from '../parsing';
import { mapCatalogRow, mapCatalogRows, validateMappingProfile } from './mapping.engine';
import { CatalogMappingProfile } from './mapping.types';
import { RAKIZA_CSV_PROFILE } from '../profiles/rakiza.profile';

const genericProfile: CatalogMappingProfile = {
  sourceSystem: 'GENERIC_CSV',
  fileFormat: 'CSV',
  sourceCurrency: 'LYD',
  storeCurrency: 'LYD',
  columnMapping: {
    externalId: 'code',
    name: 'name',
    price: 'price',
    sourceCategory: 'category',
    sourceBarcode: 'barcode',
    sourceBrand: 'brand',
    sourceDescription: 'description',
  },
};

function firstRow(source: string, profile = genericProfile) {
  const parsed = parseCsvBuffer(Buffer.from(source, 'utf8'));
  return mapCatalogRow(parsed.rows[0], profile);
}

describe('Catalog mapping engine', () => {
  it('maps generic columns to canonical fields', () => {
    const row = firstRow('code,name,price,category\nA-1,منتج,1200,Computers\n');

    expect(row.externalId).toBe('A-1');
    expect(row.name).toBe('منتج');
    expect(row.price).toBe(1200);
    expect(row.sourceCategory).toBe('Computers');
  });

  it('rejects missing required mapping and missing source headers', () => {
    const missingMapping = { ...genericProfile, columnMapping: { ...genericProfile.columnMapping, price: undefined } };
    expect(validateMappingProfile(missingMapping, ['code', 'name', 'category']).errors.map((error) => error.code))
      .toContain('REQUIRED_MAPPING_MISSING');

    expect(validateMappingProfile(genericProfile, ['code', 'name', 'category']).errors.map((error) => error.code))
      .toContain('MAPPED_SOURCE_HEADER_NOT_FOUND');
  });

  it('rejects unsupported fields and duplicate source mappings', () => {
    const profile = {
      ...genericProfile,
      columnMapping: {
        ...genericProfile.columnMapping,
        price: 'name',
        unsupported: 'other',
      },
    } as CatalogMappingProfile;
    const errors = validateMappingProfile(profile, ['code', 'name', 'price', 'category', 'barcode', 'brand', 'description', 'other']).errors;

    expect(errors.map((error) => error.code)).toEqual(expect.arrayContaining([
      'SOURCE_HEADER_MAPPED_MULTIPLE_TIMES',
      'UNSUPPORTED_TARGET_FIELD',
    ]));
  });

  it('maps Rakiza identity, barcode, LYD price, and preserves Arabic name', () => {
    const row = firstRow('tbItemNo,tbItemCode,tbItemName,tbSmallUnitQuantity,tbCategoryName\n000123,*5500934*,حاسوب احترافي,"1,200.50",Computers\n', RAKIZA_CSV_PROFILE);

    expect(row.externalId).toBe('000123');
    expect(row.sourceBarcode).toBe('5500934');
    expect(row.name).toBe('حاسوب احترافي');
    expect(row.price).toBe(1200.5);
    expect(row.currency).toBe('LYD');
  });

  it('supports a barcode without surrounding asterisks', () => {
    const row = firstRow('tbItemNo,tbItemCode,tbItemName,tbSmallUnitQuantity,tbCategoryName\n123,5500934,منتج,10,Network\n', RAKIZA_CSV_PROFILE);
    expect(row.sourceBarcode).toBe('5500934');
  });

  it('maps known categories and reports unknown categories', () => {
    const known = mapCatalogRow(
      parseCsvBuffer(Buffer.from('code,name,price,category\nA,Product,10,Computers\n')).rows[0],
      { ...genericProfile, categoryMapping: { Computers: 'category-1' } },
    );
    expect(known.mappedCategoryId).toBe('category-1');

    const unknown = firstRow('code,name,price,category\nA,Product,10,Unknown\n');
    expect(unknown.mappingWarnings.map((warning) => warning.code)).toContain('UNMAPPED_CATEGORY');
  });

  it('ignores generic Rakiza brand and maps known brands', () => {
    const ignored = mapCatalogRow(
      parseCsvBuffer(Buffer.from('code,name,price,category,brand\nA,Product,10,Computers,عام\n')).rows[0],
      genericProfile,
    );
    expect(ignored.mappedBrandId).toBeNull();

    const known = mapCatalogRow(
      parseCsvBuffer(Buffer.from('code,name,price,category,brand\nA,Product,10,Computers,HP\n')).rows[0],
      { ...genericProfile, brandMapping: { HP: 'brand-1' } },
    );
    expect(known.mappedBrandId).toBe('brand-1');
  });

  it('keeps optional description and flags zero/negative prices', () => {
    const noDescription = firstRow('code,name,price,category\nA,Product,0,Computers\n');
    expect(noDescription.sourceDescription).toBeNull();
    expect(noDescription.price).toBe(0);
    expect(noDescription.mappingWarnings.map((warning) => warning.code)).toContain('ZERO_PRICE');

    const negative = firstRow('code,name,price,category\nA,Product,-10,Computers\n');
    expect(negative.mappingErrors.map((error) => error.code)).toContain('NEGATIVE_PRICE');
  });

  it('maps the real Rakiza sample without querying production data', () => {
    const fixture = process.env.RAKIZA_CSV_FIXTURE;
    if (!fixture || !existsSync(fixture)) return;

    const parsed = parseCsvBuffer(readFileSync(fixture), { filename: 'PriceList.csv' });
    const categoryMapping = Object.fromEntries(
      [...new Set(parsed.rows.map((row) => row.normalized.tbCategoryName).filter(Boolean))].map((category) => [category, `category:${category}`]),
    );
    const mapped = mapCatalogRows(parsed.rows, parsed.headers, { ...RAKIZA_CSV_PROFILE, categoryMapping });

    expect(mapped.profileValidation.valid).toBe(true);
    expect(mapped.rows).toHaveLength(346);
    expect(mapped.rows.filter((row) => !row.name).length).toBe(1);
    expect(mapped.rows.filter((row) => row.price === 0).length).toBe(13);
    expect(mapped.rows.filter((row) => !row.externalId).length).toBe(0);
    expect(mapped.rows.filter((row) => !row.sourceBarcode).length).toBe(0);
    expect(mapped.rows.every((row) => row.currency === 'LYD')).toBe(true);
    expect(mapped.rows.filter((row) => row.sourceBrand === 'عام' && row.mappedBrandId === null).length).toBe(346);
  });
});
