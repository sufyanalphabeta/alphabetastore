import { normalizeProductGallery } from './product-gallery.mapper';

const legacy = { id: 'legacy', imageUrl: '/legacy.jpg', sortOrder: 0 };
const modern = {
  id: 'relation', mediaAssetId: 'asset', role: 'PRIMARY' as const, sortOrder: 0,
  mediaAsset: {
    altText: 'حاسوب محمول',
    variants: {
      thumbnail: { url: '/thumb.webp' }, card: { url: '/card.webp' },
      product: { url: '/product.webp' }, zoom: { url: '/zoom.webp' },
    },
  },
};

describe('normalizeProductGallery', () => {
  it('falls back to legacy ProductImage', () => {
    const result = normalizeProductGallery({ id: 'p', images: [legacy], media: [] });
    expect(result.gallery[0]).toMatchObject({ mediaAssetId: null, productUrl: '/legacy.jpg', role: 'PRIMARY' });
  });

  it('returns resolved ProductMedia variant URLs and Arabic alt text', () => {
    const result = normalizeProductGallery({ images: [], media: [modern] });
    expect(result.gallery[0]).toMatchObject({ thumbnailUrl: '/thumb.webp', cardUrl: '/card.webp', productUrl: '/product.webp', zoomUrl: '/zoom.webp', altText: 'حاسوب محمول' });
  });

  it('gives ProductMedia precedence without duplicates when both systems exist', () => {
    const result = normalizeProductGallery({ images: [legacy], media: [modern] });
    expect(result.gallery).toHaveLength(1);
    expect(result.gallery[0].id).toBe('relation');
  });

  it('keeps the legacy images compatibility property authoritative', () => {
    const result = normalizeProductGallery({ images: [legacy], media: [modern] });
    expect(result.images).toEqual([{ id: 'relation', imageUrl: '/product.webp', sortOrder: 0 }]);
  });

  it('uses another optimized variant as a safe URL fallback', () => {
    const result = normalizeProductGallery({ images: [], media: [{ ...modern, mediaAsset: { altText: null, variants: { card: { url: '/only.webp' } } } }] });
    expect(result.gallery[0]).toMatchObject({ thumbnailUrl: '/only.webp', productUrl: '/only.webp', zoomUrl: '/only.webp' });
  });
});
