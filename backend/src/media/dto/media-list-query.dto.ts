import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { MediaProcessingStatus, MediaType } from '../../prisma/prisma-client';

const toBoolean = ({ value, obj, key }: { value: unknown; obj: Record<string, unknown>; key: string }) => {
  // With enableImplicitConversion, class-transformer turns the non-empty string
  // "false" into true before field transforms run. Read the raw query value so
  // `used=false` keeps its intended meaning.
  const rawValue = obj?.[key] ?? value;
  if (rawValue === undefined || rawValue === '') return undefined;
  return rawValue === true || rawValue === 'true' || rawValue === '1';
};

export class MediaListQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 24;

  @IsOptional()
  @IsEnum(MediaType)
  mediaType?: MediaType;

  @IsOptional()
  @IsEnum(MediaProcessingStatus)
  processingStatus?: MediaProcessingStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  used?: boolean;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;
}
