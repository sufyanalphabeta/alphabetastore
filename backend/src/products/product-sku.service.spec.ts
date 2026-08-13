import { ProductSkuService } from './product-sku.service';

function database(values: bigint[], existing: string[] = []) {
  let index = 0;
  return {
    $queryRaw: jest.fn().mockImplementation(() => Promise.resolve([{ value: values[index++] }])),
    product: {
      findUnique: jest.fn().mockImplementation(({ where }: { where: { sku: string } }) =>
        Promise.resolve(existing.includes(where.sku) ? { id: 'existing' } : null),
      ),
    },
  };
}

describe('ProductSkuService', () => {
  it('preserves and trims an explicit custom SKU without consuming the sequence', async () => {
    const prisma = database([1n]);
    const service = new ProductSkuService(prisma as never);

    await expect(service.resolve(' CUSTOM-42 ')).resolves.toBe('CUSTOM-42');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it.each([
    [1n, 'AB-000001'],
    [345n, 'AB-000345'],
    [1_000_000n, 'AB-1000000'],
  ])('formats sequence value %s without wrapping', async (value, expected) => {
    const prisma = database([value]);
    await expect(new ProductSkuService(prisma as never).resolve()).resolves.toBe(expected);
  });

  it('skips an existing custom SKU collision and consumes the next sequence value', async () => {
    const prisma = database([7n, 8n], ['AB-000007']);
    await expect(new ProductSkuService(prisma as never).resolve()).resolves.toBe('AB-000008');
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('returns unique values for concurrent generation requests', async () => {
    let value = 20n;
    const prisma = {
      $queryRaw: jest.fn().mockImplementation(() => Promise.resolve([{ value: value++ }])),
      product: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new ProductSkuService(prisma as never);
    const generated = await Promise.all(Array.from({ length: 20 }, () => service.resolve()));

    expect(new Set(generated).size).toBe(20);
    expect(generated).toContain('AB-000020');
    expect(generated).toContain('AB-000039');
  });

  it('does not recycle a deleted Product SKU because the sequence only moves forward', async () => {
    const prisma = database([41n, 42n]);
    const service = new ProductSkuService(prisma as never);
    await expect(service.resolve()).resolves.toBe('AB-000041');
    await expect(service.resolve()).resolves.toBe('AB-000042');
  });
});
