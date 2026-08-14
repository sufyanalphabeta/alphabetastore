import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { FindProductsQueryDto } from './find-products-query.dto';

describe('FindProductsQueryDto', () => {
  it.each(['relevance', 'newest', 'price-asc', 'price-desc', 'name-asc'])('accepts %s sorting', async (sort) => {
    const errors = await validate(plainToInstance(FindProductsQueryDto, { sort, page: '1', limit: '12' }));
    expect(errors).toHaveLength(0);
  });

  it('rejects unsupported sorting', async () => {
    const errors = await validate(plainToInstance(FindProductsQueryDto, { sort: 'invalid' }));
    expect(errors.some(error => error.property === 'sort')).toBe(true);
  });

  it.each(['in-stock', 'out-of-stock'])('accepts %s availability', async (availability) => {
    const errors = await validate(plainToInstance(FindProductsQueryDto, { availability }));
    expect(errors).toHaveLength(0);
  });

  it('rejects unsupported availability', async () => {
    const errors = await validate(plainToInstance(FindProductsQueryDto, { availability: 'all-secret-stock' }));
    expect(errors.some(error => error.property === 'availability')).toBe(true);
  });
});
