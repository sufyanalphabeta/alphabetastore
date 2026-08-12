import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { MediaListQueryDto } from './media-list-query.dto';

describe('MediaListQueryDto', () => {
  it.each([
    ['false', false],
    ['0', false],
    ['true', true],
    ['1', true],
  ])('parses used=%s as %s with implicit conversion enabled', async (raw, expected) => {
    const dto = plainToInstance(MediaListQueryDto, { used: raw }, { enableImplicitConversion: true });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.used).toBe(expected);
  });
});
