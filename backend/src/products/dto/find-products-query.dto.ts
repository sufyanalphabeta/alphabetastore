import {
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

import { ProductStatus } from '../../prisma/prisma-client';

const PRODUCT_SORT_VALUES = ['relevance', 'date', 'asc', 'desc'] as const;

export class FindProductsQueryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  q?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  search?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  category?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  brand?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  brandSlug?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  brandId?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === '1' || value === true)
  featured?: boolean;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: (typeof ProductStatus)[keyof typeof ProductStatus];

  @IsOptional()
  @IsIn(PRODUCT_SORT_VALUES)
  sort?: (typeof PRODUCT_SORT_VALUES)[number];

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}