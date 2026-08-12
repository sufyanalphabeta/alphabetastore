import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMediaMetadataDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  altText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  caption?: string;
}
