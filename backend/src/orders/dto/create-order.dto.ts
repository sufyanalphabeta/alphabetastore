import { IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

import { LIBYAN_CITIES, normalizeLibyanCity } from '../../common/constants/libya';

const LIBYA_PHONE_PATTERN = /^\+218\d{9}$/;

export class CreateOrderDto {
  @IsOptional()
  @IsUUID()
  addressId?: string;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsString()
  @MinLength(5)
  @Matches(LIBYA_PHONE_PATTERN, {
    message: 'phone must be a valid Libyan phone number starting with +218',
  })
  phone!: string;

  @IsString()
  @MinLength(2)
  @Transform(({ value }) => normalizeLibyanCity(value))
  @IsIn(LIBYAN_CITIES, {
    message: 'city must be one of the supported Libyan cities',
  })
  city!: string;

  @IsString()
  @MinLength(5)
  address!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  idempotencyKey?: string;
}
