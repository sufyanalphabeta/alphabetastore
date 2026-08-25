import { Injectable } from '@nestjs/common';

import { MEDIA_LOW_RESOLUTION_THRESHOLD } from '../media/media.constants';

export const PRODUCT_BLOCKERS = [
  'INVALID_NAME',
  'INVALID_PRICE',
  'INVALID_CATEGORY',
  'MISSING_IMAGE',
  'MISSING_REQUIRED_ATTRIBUTES',
] as const;

export const PRODUCT_WARNINGS = [
  'MISSING_SHORT_DESCRIPTION',
  'MISSING_DESCRIPTION',
  'MISSING_BRAND',
  'MISSING_SPECS',
  'ONLY_ONE_IMAGE',
  'LOW_RESOLUTION_IMAGE',
  'MISSING_WARRANTY',
  'MISSING_SKU',
  'MISSING_SOURCE_BARCODE',
  'SOURCE_NAME_UNCHANGED',
] as const;

export type ProductBlockerCode = (typeof PRODUCT_BLOCKERS)[number];
export type ProductWarningCode = (typeof PRODUCT_WARNINGS)[number];

type ReadinessProduct = {
  name?: string | null;
  price?: { lte(value: number): boolean } | number | string | null;
  shortDescription?: string | null;
  description?: string | null;
  brand?: string | null;
  brandId?: string | null;
  specs?: unknown;
  attributeValues?: Array<unknown>;
  warrantyText?: string | null;
  sku?: string | null;
  category?: { isActive?: boolean; isVisible?: boolean } | null;
  media?: Array<{
    role?: string;
    mediaAsset?: {
      processingStatus?: string;
      originalWidth?: number | null;
      originalHeight?: number | null;
    } | null;
  }>;
  images?: unknown[];
  sourceIdentities?: Array<{
    sourceBarcode?: string | null;
    lastImportedName?: string | null;
  }>;
  _count?: { media?: number; images?: number };
  missingRequiredAttributes?: string[];
};

export type ProductReadiness = {
  readyToPublish: boolean;
  blockers: ProductBlockerCode[];
  warnings: ProductWarningCode[];
  issueCount: number;
};

@Injectable()
export class ProductReadinessService {
  evaluate(product: ReadinessProduct): ProductReadiness {
    const blockers: ProductBlockerCode[] = [];
    const warnings: ProductWarningCode[] = [];
    const media = product.media ?? [];
    const legacyImages = product.images ?? [];
    const mediaCount = product._count?.media ?? media.length;
    const legacyImageCount = product._count?.images ?? legacyImages.length;
    const primary = media.find((item) => item.role === 'PRIMARY');

    if (!product.name?.trim()) blockers.push('INVALID_NAME');
    if (this.isNonPositive(product.price)) blockers.push('INVALID_PRICE');
    if (!product.category?.isActive || !product.category?.isVisible) blockers.push('INVALID_CATEGORY');

    const hasReadyPrimary = primary?.mediaAsset?.processingStatus === 'READY';
    const hasUsableImage = mediaCount > 0 ? hasReadyPrimary : legacyImageCount > 0;
    if (!hasUsableImage) blockers.push('MISSING_IMAGE');
    if (product.missingRequiredAttributes?.length) blockers.push('MISSING_REQUIRED_ATTRIBUTES');

    if (!product.shortDescription?.trim()) warnings.push('MISSING_SHORT_DESCRIPTION');
    if (!product.description?.trim()) warnings.push('MISSING_DESCRIPTION');
    if (!product.brandId && !product.brand?.trim()) warnings.push('MISSING_BRAND');
    if (!this.hasSpecs(product.specs) && !product.attributeValues?.length) warnings.push('MISSING_SPECS');
    if ((mediaCount > 0 ? mediaCount : legacyImageCount) === 1) warnings.push('ONLY_ONE_IMAGE');

    const width = primary?.mediaAsset?.originalWidth;
    const height = primary?.mediaAsset?.originalHeight;
    if (width && height && Math.min(width, height) < MEDIA_LOW_RESOLUTION_THRESHOLD) {
      warnings.push('LOW_RESOLUTION_IMAGE');
    }

    if (!product.warrantyText?.trim()) warnings.push('MISSING_WARRANTY');
    if (!product.sku?.trim()) warnings.push('MISSING_SKU');

    const sources = product.sourceIdentities ?? [];
    if (sources.length && !sources.some((source) => source.sourceBarcode?.trim())) {
      warnings.push('MISSING_SOURCE_BARCODE');
    }
    if (
      sources.some(
        (source) => source.lastImportedName?.trim().toLocaleLowerCase() === product.name?.trim().toLocaleLowerCase(),
      )
    ) {
      warnings.push('SOURCE_NAME_UNCHANGED');
    }

    return {
      readyToPublish: blockers.length === 0,
      blockers,
      warnings,
      issueCount: blockers.length + warnings.length,
    };
  }

  private isNonPositive(value: ReadinessProduct['price']) {
    if (value && typeof value === 'object' && 'lte' in value) return value.lte(0);
    return Number(value ?? 0) <= 0;
  }

  private hasSpecs(specs: unknown) {
    return Boolean(specs && typeof specs === 'object' && !Array.isArray(specs) && Object.keys(specs).length);
  }
}
