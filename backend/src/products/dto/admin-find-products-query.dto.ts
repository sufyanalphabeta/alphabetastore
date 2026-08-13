import { IsEnum, IsOptional } from 'class-validator';

import { ProductStatus } from '../../prisma/prisma-client';
import { FindProductsQueryDto } from './find-products-query.dto';

export class AdminFindProductsQueryDto extends FindProductsQueryDto {
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: (typeof ProductStatus)[keyof typeof ProductStatus];
}
