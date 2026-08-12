import { ProductMediaService } from './product-media.service';

describe('ProductMediaService', () => {
  const prisma = {
    product: { findUnique: jest.fn() },
    mediaAsset: { findUnique: jest.fn() },
    productMedia: { count: jest.fn(), updateMany: jest.fn(), create: jest.fn() },
  } as any;
  const service = new ProductMediaService(prisma);

  beforeEach(() => jest.clearAllMocks());

  it('allows a ready image and changes the previous primary to gallery', async () => {
    prisma.product.findUnique.mockResolvedValue({ id: 'product' });
    prisma.mediaAsset.findUnique.mockResolvedValue({ id: 'asset', mediaType: 'IMAGE', processingStatus: 'READY' });
    prisma.productMedia.count.mockResolvedValue(1);
    prisma.productMedia.create.mockResolvedValue({ id: 'relation', role: 'PRIMARY' });

    await service.attachImage('product', 'asset', 'PRIMARY');

    expect(prisma.productMedia.updateMany).toHaveBeenCalledWith({ where: { productId: 'product', role: 'PRIMARY' }, data: { role: 'GALLERY' } });
    expect(prisma.productMedia.create).toHaveBeenCalledWith({ data: { productId: 'product', mediaAssetId: 'asset', role: 'PRIMARY', sortOrder: 1 } });
  });

  it('enforces the four-image limit', async () => {
    prisma.product.findUnique.mockResolvedValue({ id: 'product' });
    prisma.mediaAsset.findUnique.mockResolvedValue({ id: 'asset', mediaType: 'IMAGE', processingStatus: 'READY' });
    prisma.productMedia.count.mockResolvedValue(4);

    await expect(service.attachImage('product', 'asset')).rejects.toThrow('up to 4 images');
  });

  it('allows the same ready asset to be reused by another product', async () => {
    prisma.product.findUnique
      .mockResolvedValueOnce({ id: 'product-1' })
      .mockResolvedValueOnce({ id: 'product-2' });
    prisma.mediaAsset.findUnique.mockResolvedValue({ id: 'asset', mediaType: 'IMAGE', processingStatus: 'READY' });
    prisma.productMedia.count.mockResolvedValue(0);
    prisma.productMedia.create.mockResolvedValue({ id: 'relation', role: 'GALLERY' });

    await service.attachImage('product-1', 'asset');
    await service.attachImage('product-2', 'asset');

    expect(prisma.productMedia.create).toHaveBeenCalledTimes(2);
    expect(prisma.productMedia.create).toHaveBeenNthCalledWith(1, { data: { productId: 'product-1', mediaAssetId: 'asset', role: 'GALLERY', sortOrder: 0 } });
    expect(prisma.productMedia.create).toHaveBeenNthCalledWith(2, { data: { productId: 'product-2', mediaAssetId: 'asset', role: 'GALLERY', sortOrder: 0 } });
  });
});
