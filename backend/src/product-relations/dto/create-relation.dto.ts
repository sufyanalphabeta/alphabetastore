import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum ProductRelationType {
  ACCESSORY = 'ACCESSORY',
  FREQUENTLY_BOUGHT_TOGETHER = 'FREQUENTLY_BOUGHT_TOGETHER',
  RECOMMENDED = 'RECOMMENDED',
  COMPATIBLE = 'COMPATIBLE',
}

export class CreateRelationDto {
  @IsString()
  targetId!: string;

  @IsEnum(ProductRelationType)
  relationType!: ProductRelationType;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number;
}
