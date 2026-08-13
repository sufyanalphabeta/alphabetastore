import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength
} from "class-validator";

import { BaseCurrency, DiscountType } from "../../prisma/prisma-client";

export class CreateProductDto {
  @IsUUID()
  categoryId!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  slug?: string;

  @IsString()
  @MinLength(2)
  description!: string;

  @IsString()
  @MinLength(2)
  shortDescription!: string;

  /** Base price stored in baseCurrency */
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  price!: number;

  /** Currency the price is denominated in */
  @IsOptional()
  @IsEnum(BaseCurrency)
  baseCurrency?: BaseCurrency;

  /** Optional USD to LYD rate for this product; blank uses the global rate. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0.000001)
  exchangeRateOverride?: number;

  /** Strikethrough / original price (same currency as baseCurrency) */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  comparePrice?: number;

  @IsOptional()
  @IsEnum(DiscountType)
  discountType?: DiscountType;

  /** Percentage (0-100) or fixed amount in baseCurrency */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  discountValue?: number;

  @IsOptional()
  @IsDateString()
  discountStartAt?: string;

  @IsOptional()
  @IsDateString()
  discountEndAt?: string;

  @IsInt()
  @Min(0)
  stockQty!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxPurchaseQty?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  warrantyText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  datasheetUrl?: string;

  @IsOptional()
  @IsObject()
  specs?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  highlights?: string[];

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  imageUrls?: string[];
}
