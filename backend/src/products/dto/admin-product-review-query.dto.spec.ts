import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { AdminProductReviewQueryDto } from './admin-product-review-query.dto';

describe('AdminProductReviewQueryDto', () => {
  it.each([
    ['true', true],
    ['false', false],
  ])('preserves reviewed=%s under implicit conversion', (raw, expected) => {
    const dto = plainToInstance(
      AdminProductReviewQueryDto,
      { reviewed: raw },
      { enableImplicitConversion: true },
    );

    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.reviewed).toBe(expected);
  });
});
