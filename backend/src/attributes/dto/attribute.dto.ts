import 'reflect-metadata';

import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsDefined,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { AttributeDataType } from '@prisma/client';

export class CreateAttributeDefinitionDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*$/)
  @MaxLength(80)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  nameAr!: string;

  @IsOptional() @IsString() @MaxLength(160) nameEn?: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum(AttributeDataType) dataType!: AttributeDataType;
  @IsOptional() @IsString() @MaxLength(40) unit?: string;
  @IsOptional() @IsArray() @ArrayUnique() @IsString({ each: true }) allowedValues?: string[];
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateAttributeDefinitionDto extends CreateAttributeDefinitionDto {
  @IsOptional() declare code: string;
  @IsOptional() declare nameAr: string;
  @IsOptional() declare dataType: AttributeDataType;
}

export class AttributeProfileItemDto {
  @IsUUID() attributeDefinitionId!: string;
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @IsBoolean() filterable?: boolean;
  @IsOptional() @IsBoolean() comparable?: boolean;
  @IsOptional() @IsBoolean() visibleOnProduct?: boolean;
  @IsOptional() @IsBoolean() visibleInSummary?: boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class CreateAttributeProfileDto {
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttributeProfileItemDto)
  items!: AttributeProfileItemDto[];
}

export class UpdateAttributeProfileDto extends CreateAttributeProfileDto {
  @IsOptional() declare name: string;
  @IsOptional() declare items: AttributeProfileItemDto[];
}

export class AssignCategoryProfileDto {
  @IsOptional() @IsUUID() attributeProfileId?: string | null;
}

export class ProductAttributeValueDto {
  @IsString() @Matches(/^[a-z][a-z0-9_]*$/) code!: string;
  @IsDefined()
  value!: unknown;
}

export class ReplaceProductAttributesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAttributeValueDto)
  values!: ProductAttributeValueDto[];
}
