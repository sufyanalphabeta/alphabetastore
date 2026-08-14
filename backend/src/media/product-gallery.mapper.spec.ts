import { normalizeProductGallery, resolveProductCardImage } from './product-gallery.mapper';

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

  it('places the PRIMARY media first even when its sort order is higher', () => {
    const secondary = {
      ...modern,
      id: 'secondary',
      role: 'GALLERY' as const,
      sortOrder: 0,
    };
    const primary = {
      ...modern,
      id: 'primary',
      role: 'PRIMARY' as const,
      sortOrder: 3,
    };

    const result = normalizeProductGallery({ images: [], media: [secondary, primary] });

    expect(result.gallery.map((item) => item.id)).toEqual(['primary', 'secondary']);
  });

  it('keeps the legacy images compatibility property authoritative', () => {
    const result = normalizeProductGallery({ images: [legacy], media: [modern] });
    expect(result.images).toEqual([{ id: 'relation', imageUrl: '/product.webp', sortOrder: 0 }]);
  });

  it('uses another optimized variant as a safe URL fallback', () => {
    const result = normalizeProductGallery({ images: [], media: [{ ...modern, mediaAsset: { altText: null, variants: { card: { url: '/only.webp' } } } }] });
    expect(result.gallery[0]).toMatchObject({ thumbnailUrl: '/only.webp', productUrl: '/only.webp', zoomUrl: '/only.webp' });
  });

  it('resolves the optimized card image with ProductMedia precedence', () => {
    expect(resolveProductCardImage({ images: [legacy], media: [modern] })).toBe('/card.webp');
  });

  it('keeps legacy card compatibility and permits an empty gallery', () => {
    expect(resolveProductCardImage({ images: [legacy], media: [] })).toBe('/legacy.jpg');
    expect(resolveProductCardImage({ images: [], media: [] })).toBeNull();
  });
});
