import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';

import { ProductStatus } from '../../prisma/prisma-client';

export const PRODUCT_ORIGINS = ['MANUAL', 'IMPORTED'] as const;
export const PRODUCT_READINESS_VALUES = ['READY', 'BLOCKED'] as const;
export const PRODUCT_REVIEW_ISSUES = [
  'MISSING_IMAGE',
  'INVALID_PRICE',
  'INVALID_CATEGORY',
  'MISSING_BRAND',
  'MISSING_SPECS',
  'MISSING_SHORT_DESCRIPTION',
  'MISSING_DESCRIPTION',
  'LOW_RESOLUTION_IMAGE',
] as const;
export const PRODUCT_REVIEW_SORTS = ['updatedAt', 'name', 'price', 'status'] as const;

export class AdminProductReviewQueryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  q?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: (typeof ProductStatus)[keyof typeof ProductStatus];

  @IsOptional()
  @IsIn(PRODUCT_ORIGINS)
  origin?: (typeof PRODUCT_ORIGINS)[number];

  @IsOptional()
  @IsString()
  @MinLength(1)
  sourceSystem?: string;

  @IsOptional()
  @IsIn(PRODUCT_READINESS_VALUES)
  readiness?: (typeof PRODUCT_READINESS_VALUES)[number];

  @IsOptional()
  @IsIn(PRODUCT_REVIEW_ISSUES)
  issue?: (typeof PRODUCT_REVIEW_ISSUES)[number];

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsIn(PRODUCT_REVIEW_SORTS)
  sort?: (typeof PRODUCT_REVIEW_SORTS)[number];

  @IsOptional()
  @Transform(({ obj, key, value }) => {
    const raw = obj?.[key];
    return raw === true || raw === 'true' ? true : raw === false || raw === 'false' ? false : value;
  })
  @IsBoolean()
  reviewed?: boolean;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
