import { CatalogMappingProfile, MappedCatalogRow, MappingIssue } from '../mapping';

export type RowClassification = 'NEW' | 'UNCHANGED' | 'PRICE_CHANGED' | 'CATEGORY_CHANGED' | 'CONFLICT' | 'INVALID';
export type IdentityMatch =
  | 'EXACT_EXTERNAL_ID'
  | 'NONE'
  | 'BROKEN_EXTERNAL_ID'
  | 'BARCODE_SOURCE_CONFLICT'
  | 'MANUAL_BARCODE_UNAVAILABLE';

export type DetectedChanges = {
  price?: { current: number | null; lastImported: number | null; incoming: number | null; manualOverrideSuspected: boolean | null };
  category?: { currentId: string | null; incomingId: string | null };
  sourceBarcode?: { current: string | null; incoming: string | null };
  name?: { current: string | null; incoming: string | null; manualEnrichmentUnknown: boolean };
};

export type ClassifiedCatalogRow = {
  rowNumber: number;
  classification: RowClassification;
  matchedProductId: string | null;
  identityMatch: IdentityMatch;
  validationErrors: MappingIssue[];
  warnings: MappingIssue[];
  changes: DetectedChanges;
  mappedRow: MappedCatalogRow;
};

export type ValidationMatchingResult = {
  rows: ClassifiedCatalogRow[];
  counts: Record<RowClassification, number>;
};

export type ValidationMatchingProfile = CatalogMappingProfile;
