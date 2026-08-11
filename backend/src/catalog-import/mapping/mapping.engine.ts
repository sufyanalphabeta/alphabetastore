import { normalizeBarcode, normalizeDecimal, normalizeText } from '../normalization';
import {
  CANONICAL_IMPORT_FIELDS,
  CatalogMappingProfile,
  CanonicalImportField,
  MappedCatalogRow,
  MappingIssue,
  ProfileValidationResult,
} from './mapping.types';

const REQUIRED_FIELDS: CanonicalImportField[] = ['externalId', 'name', 'price', 'sourceCategory'];
const DEFAULT_IGNORED_BRANDS = ['عام', 'Ø¹Ø§Ù…'];

function issue(code: string, message: string, field?: CanonicalImportField): MappingIssue {
  return { code, message, ...(field ? { field } : {}) };
}

function getMappedValue(
  row: MappedCatalogRow['sourceRow'],
  mapping: CatalogMappingProfile['columnMapping'],
  field: CanonicalImportField,
): string | null {
  const sourceHeader = mapping[field];
  return sourceHeader ? row.normalized[sourceHeader] ?? null : null;
}

export function validateMappingProfile(
  profile: CatalogMappingProfile,
  headers: string[],
): ProfileValidationResult {
  const errors: MappingIssue[] = [];
  const warnings: MappingIssue[] = [];
  const headerSet = new Set(headers);
  const mapping = profile.columnMapping ?? {};

  if (!profile.sourceSystem?.trim()) errors.push(issue('SOURCE_SYSTEM_REQUIRED', 'Source system is required.'));
  if (profile.fileFormat !== 'CSV') errors.push(issue('UNSUPPORTED_FILE_FORMAT', 'Only CSV profiles are supported in Phase 1B.'));
  if (!profile.sourceCurrency?.trim()) errors.push(issue('SOURCE_CURRENCY_REQUIRED', 'Source currency is required.'));
  if (!profile.storeCurrency?.trim()) errors.push(issue('STORE_CURRENCY_REQUIRED', 'Store currency is required.'));

  for (const field of REQUIRED_FIELDS) {
    const sourceHeader = mapping[field];
    if (!sourceHeader) {
      errors.push(issue('REQUIRED_MAPPING_MISSING', `Required mapping for ${field} is missing.`, field));
    } else if (!headerSet.has(sourceHeader)) {
      errors.push(issue('MAPPED_SOURCE_HEADER_NOT_FOUND', `Mapped source header "${sourceHeader}" was not found.`, field));
    }
  }

  for (const field of CANONICAL_IMPORT_FIELDS) {
    const sourceHeader = mapping[field];
    if (sourceHeader && !headerSet.has(sourceHeader)) {
      errors.push(issue('MAPPED_SOURCE_HEADER_NOT_FOUND', `Mapped source header "${sourceHeader}" was not found.`, field));
    }
  }

  const mappedHeaders = new Map<string, CanonicalImportField>();
  for (const field of CANONICAL_IMPORT_FIELDS) {
    const sourceHeader = mapping[field];
    if (!sourceHeader) continue;
    const previousField = mappedHeaders.get(sourceHeader);
    if (previousField) {
      errors.push(issue('SOURCE_HEADER_MAPPED_MULTIPLE_TIMES', `Source header "${sourceHeader}" is mapped to both ${previousField} and ${field}.`, field));
    } else {
      mappedHeaders.set(sourceHeader, field);
    }
  }

  for (const field of Object.keys(mapping)) {
    if (!(CANONICAL_IMPORT_FIELDS as readonly string[]).includes(field)) {
      errors.push(issue('UNSUPPORTED_TARGET_FIELD', `Unsupported target field "${field}".`));
    }
  }

  if (profile.sourceSystem === 'RAKIZA' && profile.sourceCurrency !== 'LYD') {
    errors.push(issue('RAKIZA_CURRENCY_MUST_BE_LYD', 'Rakiza profiles must use LYD source currency.'));
  }

  if (profile.options?.stripSurroundingAsterisks && !mapping.sourceBarcode) {
    warnings.push(issue('BARCODE_NORMALIZATION_UNUSED', 'Barcode normalization is enabled but sourceBarcode is not mapped.'));
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function mapCatalogRow(
  row: MappedCatalogRow['sourceRow'],
  profile: CatalogMappingProfile,
  categoryMapping?: Record<string, string>,
  brandMapping?: Record<string, string>,
): MappedCatalogRow {
  const mappingWarnings: MappingIssue[] = [];
  const mappingErrors: MappingIssue[] = [];
  const sourceCategory = getMappedValue(row, profile.columnMapping, 'sourceCategory');
  const sourceBrand = getMappedValue(row, profile.columnMapping, 'sourceBrand');
  const categoryMap = categoryMapping ?? profile.categoryMapping ?? {};
  const brandMap = brandMapping ?? profile.brandMapping ?? {};
  const ignoredBrands = new Set(profile.options?.ignoredBrandValues ?? DEFAULT_IGNORED_BRANDS);
  const priceText = getMappedValue(row, profile.columnMapping, 'price');
  const normalizedPrice = normalizeDecimal(priceText);

  const externalId = getMappedValue(row, profile.columnMapping, 'externalId');
  const name = getMappedValue(row, profile.columnMapping, 'name');
  const sourceBarcode = normalizeBarcode(
    getMappedValue(row, profile.columnMapping, 'sourceBarcode'),
    profile.options,
  );
  const mappedCategoryId = sourceCategory ? categoryMap[sourceCategory] ?? null : null;
  const ignoredBrand = !sourceBrand || ignoredBrands.has(sourceBrand);
  const mappedBrandId = ignoredBrand ? null : brandMap[sourceBrand] ?? null;

  if (!externalId) mappingErrors.push(issue('REQUIRED_VALUE_MISSING', 'External product identity is missing.', 'externalId'));
  if (!name) mappingErrors.push(issue('REQUIRED_VALUE_MISSING', 'Product name is missing.', 'name'));
  if (normalizedPrice.error) mappingErrors.push(issue(normalizedPrice.error, 'Price is missing, invalid, or ambiguous.', 'price'));
  if (normalizedPrice.value != null && normalizedPrice.value < 0) {
    mappingErrors.push(issue('NEGATIVE_PRICE', 'Price cannot be negative.', 'price'));
  }
  if (!sourceCategory) mappingErrors.push(issue('REQUIRED_VALUE_MISSING', 'Source category is missing.', 'sourceCategory'));
  else if (!mappedCategoryId) mappingWarnings.push(issue('UNMAPPED_CATEGORY', `Source category "${sourceCategory}" has no configured store category.`, 'sourceCategory'));

  if (sourceBrand && !ignoredBrand && !mappedBrandId) {
    mappingWarnings.push(issue('UNMAPPED_BRAND', `Source brand "${sourceBrand}" has no configured store brand.`, 'sourceBrand'));
  }
  if (normalizedPrice.value === 0) {
    mappingWarnings.push(issue('ZERO_PRICE', 'Price is zero and requires later validation.', 'price'));
  }

  return {
    rowNumber: row.rowNumber,
    sourceSystem: profile.sourceSystem,
    externalId,
    sourceBarcode,
    name,
    price: normalizedPrice.value,
    currency: profile.storeCurrency,
    sourceCategory,
    mappedCategoryId,
    sourceBrand,
    mappedBrandId,
    sourceDescription: getMappedValue(row, profile.columnMapping, 'sourceDescription'),
    mappingWarnings: [...mappingWarnings],
    mappingErrors: [...mappingErrors],
    parserErrors: [...row.parseErrors],
    sourceRow: row,
  };
}

export function mapCatalogRows(
  rows: MappedCatalogRow['sourceRow'][],
  headers: string[],
  profile: CatalogMappingProfile,
): { profileValidation: ProfileValidationResult; rows: MappedCatalogRow[] } {
  const profileValidation = validateMappingProfile(profile, headers);
  if (!profileValidation.valid) return { profileValidation, rows: [] };
  return {
    profileValidation,
    rows: rows.map((row) => mapCatalogRow(row, profile)),
  };
}
