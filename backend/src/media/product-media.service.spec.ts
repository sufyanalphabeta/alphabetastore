import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { ProductMediaService } from './product-media.service';

type Relation = { id: string; productId: string; mediaAssetId: string; role: 'PRIMARY' | 'GALLERY'; sortOrder: number };

describe('ProductMediaService', () => {
  let relations: Relation[];
  let products: Array<{ id: string; slug: string }>;
  let assets: Array<{ id: string; mediaType: string; processingStatus: string; altText: string; variants: object }>;
  let sequence: number;
  let prisma: any;
  let cache: any;
  let service: ProductMediaService;
  let reviewAudit: any;

  beforeEach(() => {
    relations = [];
    products = [{ id: 'p1', slug: 'one' }, { id: 'p2', slug: 'two' }];
    assets = Array.from({ length: 6 }, (_, index) => ({
      id: `a${index + 1}`, mediaType: 'IMAGE', processingStatus: 'READY', altText: `صورة ${index + 1}`,
      variants: { product: { url: `/p${index + 1}.webp` } },
    }));
    sequence = 0;
    const hydrate = (relation: Relation) => ({ ...relation, mediaAsset: assets.find((asset) => asset.id === relation.mediaAssetId) });
    const tx = {
      product: { findUnique: jest.fn(({ where }: any) => Promise.resolve(products.find((p) => p.id === where.id) ?? null)) },
      mediaAsset: { findUnique: jest.fn(({ where }: any) => Promise.resolve(assets.find((a) => a.id === where.id) ?? null)) },
      productMedia: {
        findUnique: jest.fn(({ where }: any) => Promise.resolve(relations.find((r) => r.productId === where.productId_mediaAssetId.productId && r.mediaAssetId === where.productId_mediaAssetId.mediaAssetId) ?? null)),
        findMany: jest.fn(({ where }: any) => Promise.resolve(relations.filter((r) => r.productId === where.productId).sort((a, b) => a.sortOrder - b.sortOrder).map(hydrate))),
        findFirst: jest.fn(({ where }: any) => Promise.resolve(relations.find((r) => r.id === where.id && r.productId === where.productId) ?? null)),
        findFirstOrThrow: jest.fn(({ where }: any) => {
          const found = relations.find((r) => r.id === where.id && r.productId === where.productId);
          if (!found) throw new Error('missing');
          return Promise.resolve(hydrate(found));
        }),
        count: jest.fn(({ where }: any) => Promise.resolve(relations.filter((r) => r.productId === where.productId).length)),
        create: jest.fn(({ data }: any) => {
          const relation = { id: `r${++sequence}`, ...data } as Relation;
          relations.push(relation);
          return Promise.resolve(hydrate(relation));
        }),
        updateMany: jest.fn(({ where, data }: any) => {
          relations.filter((r) => r.productId === where.productId && (!where.role || r.role === where.role)).forEach((r) => Object.assign(r, data));
          return Promise.resolve({ count: 1 });
        }),
        update: jest.fn(({ where, data }: any) => {
          const relation = relations.find((r) => r.id === where.id)!;
          Object.assign(relation, data);
          return Promise.resolve(hydrate(relation));
        }),
        delete: jest.fn(({ where }: any) => {
          const index = relations.findIndex((r) => r.id === where.id);
          return Promise.resolve(relations.splice(index, 1)[0]);
        }),
      },
    };
    prisma = { ...tx, $transaction: jest.fn((callback: any) => callback(tx)) };
    cache = { get: jest.fn().mockResolvedValue([]), del: jest.fn().mockResolvedValue(undefined) };
    reviewAudit = { invalidate: jest.fn().mockResolvedValue(undefined) };
    service = new ProductMediaService(prisma, cache, reviewAudit);
  });

  const attach = (asset = 'a1', product = 'p1', role?: 'PRIMARY' | 'GALLERY') => service.attachImage(product, asset, role);

  it('makes the first attached image PRIMARY', async () => {
    await attach();
    expect(relations[0]).toMatchObject({ role: 'PRIMARY', sortOrder: 0 });
    expect(reviewAudit.invalidate).toHaveBeenCalledWith(expect.anything(), 'p1');
  });

  it('makes a second attached image GALLERY', async () => {
    await attach(); await attach('a2');
    expect(relations.map((r) => r.role)).toEqual(['PRIMARY', 'GALLERY']);
  });

  it('accepts four images with contiguous order', async () => {
    for (let index = 1; index <= 4; index += 1) await attach(`a${index}`);
    expect(relations.map((r) => r.sortOrder)).toEqual([0, 1, 2, 3]);
  });

  it('rejects a fifth image', async () => {
    for (let index = 1; index <= 4; index += 1) await attach(`a${index}`);
    await expect(attach('a5')).rejects.toBeInstanceOf(ConflictException);
  });

  it('sets a different PRIMARY and demotes the old one', async () => {
    await attach(); const second = await attach('a2');
    await service.updateRole('p1', second.id, 'PRIMARY');
    expect(relations.filter((r) => r.role === 'PRIMARY')).toHaveLength(1);
    expect(relations.find((r) => r.role === 'PRIMARY')?.mediaAssetId).toBe('a2');
    expect(reviewAudit.invalidate).toHaveBeenCalledTimes(3);
  });

  it('removes a gallery relation without deleting MediaAsset', async () => {
    await attach(); const second = await attach('a2');
    await service.remove('p1', second.id);
    expect(relations).toHaveLength(1);
    expect(assets).toHaveLength(6);
    expect(reviewAudit.invalidate).toHaveBeenCalledTimes(3);
  });

  it('promotes the next image when PRIMARY is removed', async () => {
    const first = await attach(); await attach('a2');
    await service.remove('p1', first.id);
    expect(relations[0]).toMatchObject({ role: 'PRIMARY', sortOrder: 0 });
  });

  it('leaves no PRIMARY after removing the last image', async () => {
    const first = await attach();
    await service.remove('p1', first.id);
    expect(relations).toHaveLength(0);
  });

  it('reorders all relations while keeping PRIMARY first', async () => {
    const first = await attach(); const second = await attach('a2'); const third = await attach('a3');
    reviewAudit.invalidate.mockClear();
    const result = await service.reorder('p1', [third.id, second.id, first.id]);
    expect(result.map((item) => item.id)).toEqual([first.id, third.id, second.id]);
    expect(reviewAudit.invalidate).toHaveBeenCalledWith(expect.anything(), 'p1');
  });

  it('rejects an incomplete reorder', async () => {
    const first = await attach(); await attach('a2');
    await expect(service.reorder('p1', [first.id])).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate relation', async () => {
    await attach();
    await expect(attach()).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a non-READY asset', async () => {
    assets[0].processingStatus = 'FAILED';
    await expect(attach()).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a non-image asset', async () => {
    assets[0].mediaType = 'VIDEO';
    await expect(attach()).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows one MediaAsset to be reused by another Product', async () => {
    await attach('a1', 'p1'); await attach('a1', 'p2');
    expect(relations.filter((r) => r.mediaAssetId === 'a1')).toHaveLength(2);
  });

  it('returns not found for missing product or relation', async () => {
    await expect(attach('a1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove('p1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('uses SERIALIZABLE transactions for race protection', async () => {
    await attach();
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
  });

  it('translates a concurrent transaction abort into Conflict', async () => {
    prisma.$transaction.mockRejectedValueOnce({ code: 'P2034' });
    await expect(attach()).rejects.toBeInstanceOf(ConflictException);
  });

  it('invalidates product detail and list caches after mutation', async () => {
    cache.get.mockResolvedValueOnce(['products:list:test']);
    await attach();
    expect(cache.del).toHaveBeenCalledWith('products:detail:p1');
    expect(cache.del).toHaveBeenCalledWith('products:detail:one');
    expect(cache.del).toHaveBeenCalledWith('products:list:test');
  });
});
