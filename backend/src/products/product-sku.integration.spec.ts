import { ConflictException } from '@nestjs/common';
import { ProductStatus } from '../prisma/prisma-client';
import { ProductsService } from './products.service';

const createDto = {
  categoryId: '9cebbd83-3ac9-49b1-b967-650a8a3d6caf',
  name: 'SKU test product',
  description: 'Description',
  shortDescription: 'Short description',
  price: 10,
  stockQty: 1,
  status: ProductStatus.INACTIVE,
};

function setup(options: { generated?: string; createError?: unknown } = {}) {
  const product = {
    id: 'product-1', slug: 'sku-test-product', sku: options.generated ?? 'AB-000001',
    images: [], media: [], variants: [], sourceRelations: [], targetRelations: [], priceHistory: [],
  };
  const prisma = {
    category: { findUnique: jest.fn().mockResolvedValue({ id: createDto.categoryId }) },
    product: {
      create: options.createError ? jest.fn().mockRejectedValue(options.createError) : jest.fn().mockResolvedValue(product),
      findUnique: jest.fn().mockResolvedValue(product),
      update: jest.fn().mockResolvedValue(product),
    },
    productMedia: { count: jest.fn().mockResolvedValue(0) },
  };
  const sku = { resolve: jest.fn().mockResolvedValue(options.generated ?? 'AB-000001') };
  const cache = { del: jest.fn(), get: jest.fn(), set: jest.fn() };
  const service = new ProductsService(prisma as never, {} as never, {} as never, cache as never, sku as never);
  return { service, prisma, sku };
}

describe('ProductsService automatic SKU integration', () => {
  it('generates a SKU for manual creation when omitted', async () => {
    const { service, prisma, sku } = setup({ generated: 'AB-000123' });
    await service.create(createDto);
    expect(sku.resolve).toHaveBeenCalledWith(undefined);
    expect(prisma.product.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sku: 'AB-000123' }) }));
  });

  it('preserves an explicitly supplied custom SKU', async () => {
    const { service, prisma, sku } = setup({ generated: 'CUSTOM-9' });
    await service.create({ ...createDto, sku: 'CUSTOM-9' });
    expect(sku.resolve).toHaveBeenCalledWith('CUSTOM-9');
    expect(prisma.product.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sku: 'CUSTOM-9' }) }));
  });

  it('reports duplicate custom SKU as a conflict', async () => {
    const duplicate = { code: 'P2002', meta: { target: ['sku'] } };
    const { service } = setup({ generated: 'CUSTOM-9', createError: duplicate });
    await expect(service.create({ ...createDto, sku: 'CUSTOM-9' })).rejects.toThrow(new ConflictException('Product SKU already exists.'));
  });

  it('does not regenerate SKU during a normal update', async () => {
    const { service, sku, prisma } = setup({ generated: 'AB-000123' });
    await service.update('product-1', { name: 'Updated name' });
    expect(sku.resolve).not.toHaveBeenCalled();
    expect(prisma.product.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sku: undefined }) }));
  });
});
