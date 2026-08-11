import { ParsedCsvRow } from '../parsing';

export const CANONICAL_IMPORT_FIELDS = [
  'externalId',
  'sourceBarcode',
  'name',
  'price',
  'sourceCategory',
  'sourceBrand',
  'sourceDescription',
] as const;

export type CanonicalImportField = (typeof CANONICAL_IMPORT_FIELDS)[number];

export type ColumnMapping = Partial<Record<CanonicalImportField, string>>;

export type CatalogMappingProfile = {
  sourceSystem: string;
  fileFormat: 'CSV';
  sourceCurrency: string;
  storeCurrency: string;
  importMode?: string;
  columnMapping: ColumnMapping;
  categoryMapping?: Record<string, string>;
  brandMapping?: Record<string, string>;
  options?: {
    stripSurroundingAsterisks?: boolean;
    ignoredBrandValues?: string[];
  };
};

export type MappingIssue = {
  code: string;
  field?: CanonicalImportField;
  message: string;
};

export type ProfileValidationResult = {
  valid: boolean;
  errors: MappingIssue[];
  warnings: MappingIssue[];
};

export type MappedCatalogRow = {
  rowNumber: number;
  sourceSystem: string;
  externalId: string | null;
  sourceBarcode: string | null;
  name: string | null;
  price: number | null;
  currency: string;
  sourceCategory: string | null;
  mappedCategoryId: string | null;
  sourceBrand: string | null;
  mappedBrandId: string | null;
  sourceDescription: string | null;
  mappingWarnings: MappingIssue[];
  mappingErrors: MappingIssue[];
  parserErrors: string[];
  sourceRow: ParsedCsvRow;
};
