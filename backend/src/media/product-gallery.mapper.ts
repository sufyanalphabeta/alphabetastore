import type { MediaVariants } from './media.types';

type LegacyImage = { id: string; imageUrl: string; sortOrder: number };
type NewMedia = {
  id: string;
  mediaAssetId: string;
  role: 'PRIMARY' | 'GALLERY' | 'VIDEO';
  sortOrder: number;
  mediaAsset: { altText?: string | null; variants?: unknown };
};

export type ProductGalleryImage = {
  id: string;
  mediaAssetId: string | null;
  role: 'PRIMARY' | 'GALLERY';
  sortOrder: number;
  thumbnailUrl: string;
  cardUrl: string;
  productUrl: string;
  zoomUrl: string;
  altText: string | null;
};

function variantUrls(variants: unknown) {
  const parsed = (variants ?? {}) as Partial<MediaVariants>;
  const fallback = parsed.product?.url ?? parsed.card?.url ?? parsed.thumbnail?.url ?? parsed.zoom?.url ?? '';
  return {
    thumbnailUrl: parsed.thumbnail?.url ?? fallback,
    cardUrl: parsed.card?.url ?? fallback,
    productUrl: parsed.product?.url ?? fallback,
    zoomUrl: parsed.zoom?.url ?? fallback,
  };
}

export function normalizeProductGallery<T extends { images?: LegacyImage[]; media?: NewMedia[] }>(product: T) {
  const { media = [], images: legacyImages = [], ...rest } = product;
  const imageMedia = media.filter((item) => item.role !== 'VIDEO');
  const gallery: ProductGalleryImage[] = imageMedia.length
    ? imageMedia
        .sort((left, right) => {
          const roleOrder = Number(right.role === 'PRIMARY') - Number(left.role === 'PRIMARY');
          return roleOrder || left.sortOrder - right.sortOrder || left.id.localeCompare(right.id);
        })
        .map((item) => ({
          id: item.id,
          mediaAssetId: item.mediaAssetId,
          role: item.role as 'PRIMARY' | 'GALLERY',
          sortOrder: item.sortOrder,
          ...variantUrls(item.mediaAsset.variants),
          altText: item.mediaAsset.altText ?? null,
        }))
    : legacyImages
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((item, index) => ({
          id: item.id,
          mediaAssetId: null,
          role: index === 0 ? 'PRIMARY' as const : 'GALLERY' as const,
          sortOrder: index,
          thumbnailUrl: item.imageUrl,
          cardUrl: item.imageUrl,
          productUrl: item.imageUrl,
          zoomUrl: item.imageUrl,
          altText: null,
        }));

  return {
    ...rest,
    gallery,
    // Compatibility adapter for the current storefront. Once ProductMedia
    // exists this contains only the authoritative new gallery.
    images: gallery.map((item) => ({
      id: item.id,
      imageUrl: item.productUrl || item.cardUrl || item.thumbnailUrl,
      sortOrder: item.sortOrder,
    })),
  };
}

export function resolveProductCardImage(product: { images?: LegacyImage[]; media?: NewMedia[] }) {
  return normalizeProductGallery(product).gallery[0]?.cardUrl || null;
}
