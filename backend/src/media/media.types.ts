export type MediaVariantName = 'thumbnail' | 'card' | 'product' | 'zoom';

export type MediaVariant = {
  width: number;
  height: number;
  format: 'webp';
  storageKey: string;
  url: string;
  sizeBytes: number;
};

export type MediaVariants = Record<MediaVariantName, MediaVariant>;

export type ProcessedMediaAsset = {
  asset: unknown;
  duplicate: boolean;
  lowResolution: boolean;
  warning?: string;
  variants: MediaVariants;
};
