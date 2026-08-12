import sharp from 'sharp';

import { MediaProcessingService } from './media-processing.service';

describe('MediaProcessingService', () => {
  const prisma = {
    mediaAsset: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  } as any;
  const storage = {
    saveFile: jest.fn(async (_buffer: Buffer, options: { storageKey?: string }) => `/uploads/${options.storageKey}`),
    deleteFile: jest.fn(),
  } as any;
  const service = new MediaProcessingService(prisma, storage);

  beforeEach(() => jest.clearAllMocks());

  async function image(format: 'jpeg' | 'png' | 'webp', width = 900, height = 600) {
    return sharp({
      create: { width, height, channels: 3, background: '#336699' },
    })[format]().toBuffer();
  }

  it.each(['jpeg', 'png', 'webp'] as const)('processes valid %s input into square WebP variants', async format => {
    const buffer = await image(format);
    prisma.mediaAsset.findUnique.mockResolvedValue(null);
    prisma.mediaAsset.create.mockImplementation(async ({ data }: any) => ({ ...data, id: data.id }));
    prisma.mediaAsset.update.mockImplementation(async ({ data }: any) => ({ id: 'asset', ...data }));

    const result = await service.processImage({ buffer, originalname: `product.${format}`, mimetype: `image/${format === 'jpeg' ? 'jpeg' : format}` });

    expect(result.duplicate).toBe(false);
    expect(Object.keys(result.variants)).toEqual(['thumbnail', 'card', 'product', 'zoom']);
    expect(storage.saveFile).toHaveBeenCalledTimes(5);
    expect(prisma.mediaAsset.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ processingStatus: 'READY' }) }));
    for (const call of storage.saveFile.mock.calls.slice(1)) {
      const metadata = await sharp(call[0]).metadata();
      expect(metadata.format).toBe('webp');
      expect(metadata.width).toBe(metadata.height);
    }
  });

  it('does not upscale a low-resolution source in generated variants', async () => {
    const containedProduct = await image('png', 200, 150);
    const buffer = await sharp({
      create: { width: 400, height: 300, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } },
    })
      .composite([{ input: containedProduct, left: 100, top: 75 }])
      .png()
      .toBuffer();
    prisma.mediaAsset.findUnique.mockResolvedValue(null);
    prisma.mediaAsset.create.mockImplementation(async ({ data }: any) => ({ ...data, id: data.id }));
    prisma.mediaAsset.update.mockImplementation(async ({ data }: any) => ({ id: 'asset', ...data }));

    await service.processImage({ buffer, originalname: 'small.png', mimetype: 'image/png' });

    const variantBuffers = storage.saveFile.mock.calls.slice(1).map((call: any[]) => call[0]);
    for (const variantBuffer of variantBuffers) {
      const { data, info } = await sharp(variantBuffer).raw().toBuffer({ resolveWithObject: true });
      const corner = [data[0], data[1], data[2]];
      const centerOffset = (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * info.channels;
      const center = [data[centerOffset], data[centerOffset + 1], data[centerOffset + 2]];
      expect(corner.every((channel) => channel >= 240)).toBe(true);
      expect(center.some((channel) => channel < 240)).toBe(true);
    }
  });

  it('reuses an exact duplicate without writing another file', async () => {
    const buffer = await image('jpeg');
    const existing = { id: 'existing', originalWidth: 900, originalHeight: 600, variants: {} };
    prisma.mediaAsset.findUnique.mockResolvedValue(existing);

    const result = await service.processImage({ buffer, originalname: 'same.jpg', mimetype: 'image/jpeg' });

    expect(result.duplicate).toBe(true);
    expect(result.asset).toBe(existing);
    expect(storage.saveFile).not.toHaveBeenCalled();
  });

  it('validates filename and MIME before duplicate reuse', async () => {
    const buffer = await image('jpeg');
    prisma.mediaAsset.findUnique.mockResolvedValue({ id: 'existing', originalWidth: 900, originalHeight: 600, variants: {} });
    await expect(service.processImage({ buffer, originalname: 'same.png', mimetype: 'image/png' })).rejects.toThrow('لا يطابق');
  });

  it('rejects SVG-like, malformed, oversized, and pixel-heavy input', async () => {
    prisma.mediaAsset.findUnique.mockResolvedValue(null);
    await expect(service.processImage({ buffer: Buffer.from('<svg/>'), originalname: 'x.svg', mimetype: 'image/svg+xml' })).rejects.toThrow();
    await expect(service.processImage({ buffer: Buffer.from('not an image'), originalname: 'x.jpg', mimetype: 'image/jpeg' })).rejects.toThrow();
    await expect(service.processImage({ buffer: Buffer.alloc(15 * 1024 * 1024 + 1), originalname: 'x.jpg', mimetype: 'image/jpeg' })).rejects.toThrow();
    const large = await image('jpeg', 7100, 7100);
    await expect(service.processImage({ buffer: large, originalname: 'large.jpg', mimetype: 'image/jpeg' })).rejects.toThrow();
    const validJpeg = await image('jpeg');
    await expect(service.processImage({ buffer: validJpeg, originalname: 'fake.png', mimetype: 'image/png' })).rejects.toThrow('لا يطابق');
  });

  it('marks small images with a user-friendly low resolution warning', async () => {
    const buffer = await image('jpeg', 400, 300);
    prisma.mediaAsset.findUnique.mockResolvedValue(null);
    prisma.mediaAsset.create.mockImplementation(async ({ data }: any) => ({ ...data, id: data.id }));
    prisma.mediaAsset.update.mockImplementation(async ({ data }: any) => ({ id: 'asset', ...data }));

    const result = await service.processImage({ buffer, originalname: 'small.jpg', mimetype: 'image/jpeg' });

    expect(result.lowResolution).toBe(true);
    expect(result.warning).toContain('جودة الصورة منخفضة');
  });
});
