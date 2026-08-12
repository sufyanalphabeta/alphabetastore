import { ConflictException, InternalServerErrorException, NotFoundException } from '@nestjs/common';

import { MediaLibraryService } from './media-library.service';

describe('MediaLibraryService', () => {
  const prisma = {
    mediaAsset: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  } as any;
  const storage = {
    getPublicUrl: jest.fn((key: string) => `/uploads/${key}`),
    deleteFile: jest.fn().mockResolvedValue(undefined),
  } as any;
  const processing = { processImage: jest.fn() } as any;
  const service = new MediaLibraryService(prisma, storage, processing);

  const variants = {
    thumbnail: { width: 300, height: 300, format: 'webp', storageKey: 'media/a/thumbnail.webp', url: '/uploads/media/a/thumbnail.webp', sizeBytes: 1000 },
    card: { width: 600, height: 600, format: 'webp', storageKey: 'media/a/card.webp', url: '/uploads/media/a/card.webp', sizeBytes: 2000 },
    product: { width: 1200, height: 1200, format: 'webp', storageKey: 'media/a/product.webp', url: '/uploads/media/a/product.webp', sizeBytes: 3000 },
    zoom: { width: 1600, height: 1600, format: 'webp', storageKey: 'media/a/zoom.webp', url: '/uploads/media/a/zoom.webp', sizeBytes: 4000 },
  };

  const asset = {
    id: 'asset-1',
    mediaType: 'IMAGE',
    originalFilename: 'لابتوب.png',
    originalMimeType: 'image/png',
    originalSizeBytes: 5000,
    originalWidth: 400,
    originalHeight: 300,
    aspectRatio: 1.3333,
    altText: null,
    title: null,
    caption: null,
    processingStatus: 'READY',
    variants,
    storageKey: 'media/asset-1/original.png',
    createdAt: new Date('2026-08-12T10:00:00Z'),
    updatedAt: new Date('2026-08-12T10:00:00Z'),
    uploadedBy: { id: 'admin-1', name: 'Admin', email: 'admin@example.com' },
    productMedia: [],
    _count: { productMedia: 0 },
  };

  beforeEach(() => jest.clearAllMocks());

  it('returns a business-safe upload response with resolved URLs', async () => {
    processing.processImage.mockResolvedValue({ asset, variants, duplicate: false, warning: 'جودة الصورة منخفضة، يفضل رفع صورة بدقة أعلى.' });
    const result = await service.upload({ originalname: asset.originalFilename } as Express.Multer.File, 'admin-1');
    expect(result).toMatchObject({ id: 'asset-1', duplicate: false, processingStatus: 'READY', warning: expect.stringContaining('جودة'), thumbnailUrl: '/uploads/media/a/thumbnail.webp' });
    expect(result).not.toHaveProperty('storageKey');
    expect(processing.processImage).toHaveBeenCalledWith(expect.anything(), 'admin-1');
  });

  it('returns duplicate reuse information without creating another asset', async () => {
    processing.processImage.mockResolvedValue({ asset, variants, duplicate: true });
    await expect(service.upload({ originalname: 'same.png' } as Express.Multer.File, 'admin-1')).resolves.toMatchObject({ duplicate: true, message: 'هذه الصورة موجودة مسبقًا في مكتبة الوسائط.' });
  });

  it('paginates newest-first and supports case-insensitive search filters', async () => {
    prisma.mediaAsset.findMany.mockResolvedValue([asset]);
    prisma.mediaAsset.count.mockResolvedValue(25);
    const result = await service.list({ page: 2, limit: 12, search: 'لابتوب', used: false } as any);
    expect(result).toMatchObject({ total: 25, page: 2, limit: 12, totalPages: 3 });
    expect(prisma.mediaAsset.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 12, take: 12, orderBy: { createdAt: 'desc' }, where: expect.objectContaining({ productMedia: { none: {} } }) }));
    expect(prisma.mediaAsset.findMany.mock.calls[0][0].where.OR).toEqual(expect.arrayContaining([{ originalFilename: { contains: 'لابتوب', mode: 'insensitive' } }]));
  });

  it('returns details, usage count, products, warnings and variant URLs without storage keys', async () => {
    const detail = { ...asset, productMedia: [{ role: 'PRIMARY', sortOrder: 0, product: { id: 'p-1', name: 'Laptop', slug: 'laptop' } }] };
    prisma.mediaAsset.findUnique.mockResolvedValue(detail);
    const result = await service.findOne('asset-1');
    expect(result).toMatchObject({ id: 'asset-1', usageCount: 1, products: [{ id: 'p-1', role: 'PRIMARY' }], zoomUrl: '/uploads/media/a/zoom.webp' });
    expect(JSON.stringify(result)).not.toContain('storageKey');
  });

  it('updates only editable metadata', async () => {
    prisma.mediaAsset.findUnique.mockResolvedValue({ id: 'asset-1' });
    prisma.mediaAsset.update.mockResolvedValue({ ...asset, title: 'عنوان', altText: 'وصف', caption: 'شرح' });
    await service.updateMetadata('asset-1', { title: ' عنوان ', altText: ' وصف ', caption: ' شرح ' });
    expect(prisma.mediaAsset.update).toHaveBeenCalledWith(expect.objectContaining({ data: { title: 'عنوان', altText: 'وصف', caption: 'شرح' } }));
  });

  it('rejects deleting a used asset with a business-safe conflict', async () => {
    prisma.mediaAsset.findUnique.mockResolvedValue({ ...asset, _count: { productMedia: 3 } });
    await expect(service.remove('asset-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.mediaAsset.update).not.toHaveBeenCalled();
  });

  it('deletes all original and variant files before deleting an unused asset', async () => {
    prisma.mediaAsset.findUnique.mockResolvedValue({ ...asset, _count: { productMedia: 0 } });
    prisma.mediaAsset.update.mockResolvedValue({});
    prisma.mediaAsset.delete.mockResolvedValue({});
    await expect(service.remove('asset-1')).resolves.toEqual({ id: 'asset-1', deleted: true });
    expect(storage.deleteFile).toHaveBeenCalledTimes(5);
    expect(prisma.mediaAsset.delete).toHaveBeenCalledWith({ where: { id: 'asset-1' } });
  });

  it('keeps a non-ready status if storage cleanup fails', async () => {
    prisma.mediaAsset.findUnique.mockResolvedValue({ ...asset, _count: { productMedia: 0 } });
    prisma.mediaAsset.update.mockResolvedValue({});
    storage.deleteFile.mockRejectedValue(new Error('storage down'));
    await expect(service.remove('asset-1')).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(prisma.mediaAsset.update).toHaveBeenCalledWith(expect.objectContaining({ data: { processingStatus: 'FAILED' } }));
    expect(prisma.mediaAsset.delete).not.toHaveBeenCalled();
  });

  it('throws not found for missing details', async () => {
    prisma.mediaAsset.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
