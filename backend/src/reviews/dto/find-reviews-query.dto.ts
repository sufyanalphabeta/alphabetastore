import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ReviewStatus } from '@prisma/client';

export class ModerateReviewDto {
  @IsEnum(ReviewStatus)
  status!: ReviewStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  moderatorNote?: string;
}

const REVIEW_SORT_VALUES = ['newest', 'oldest', 'highest', 'lowest', 'verified'] as const;

export class FindReviewsQueryDto {
  @IsOptional()
  @IsIn(REVIEW_SORT_VALUES)
  sort?: (typeof REVIEW_SORT_VALUES)[number];

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  /** Admin-only: filter by status */
  @IsOptional()
  @IsEnum(ReviewStatus)
  status?: ReviewStatus;
}
