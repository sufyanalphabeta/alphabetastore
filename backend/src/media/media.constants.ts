export const MEDIA_MAX_INPUT_BYTES = 15 * 1024 * 1024;
export const MEDIA_MAX_DECODED_PIXELS = 50_000_000;
export const MEDIA_MAX_WIDTH_OR_HEIGHT = 10_000;
export const MEDIA_MAX_PRODUCT_IMAGES = 4;
export const MEDIA_WEBP_QUALITY = 84;
export const MEDIA_LOW_RESOLUTION_THRESHOLD = 600;

export const MEDIA_VARIANTS = {
  thumbnail: 300,
  card: 600,
  product: 1200,
  zoom: 1600,
} as const;

export const MEDIA_ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const MEDIA_ALLOWED_SHARP_FORMATS = new Set(['jpeg', 'png', 'webp']);
