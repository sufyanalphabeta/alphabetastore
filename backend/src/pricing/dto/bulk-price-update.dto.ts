import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export type BulkOperation =
  | 'increase_percent'
  | 'decrease_percent'
  | 'increase_fixed'
  | 'decrease_fixed'
  | 'set_fixed'
  | 'set_exchange_rate'
  | 'clear_exchange_rate';

export class BulkPriceUpdateDto {
  @IsEnum(['increase_percent', 'decrease_percent', 'increase_fixed', 'decrease_fixed', 'set_fixed', 'set_exchange_rate', 'clear_exchange_rate'])
  operation!: BulkOperation;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  value!: number;

  /** Apply to specific product IDs (optional; all if none specified) */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  productIds?: string[];

  /** Apply to a specific category */
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  /** Apply to a specific brand */
  @IsOptional()
  @IsString()
  brand?: string;
}
