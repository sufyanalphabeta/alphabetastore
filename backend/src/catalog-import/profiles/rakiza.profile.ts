import { CatalogMappingProfile } from '../mapping';

export const RAKIZA_CSV_PROFILE: CatalogMappingProfile = {
  sourceSystem: 'RAKIZA',
  fileFormat: 'CSV',
  sourceCurrency: 'LYD',
  storeCurrency: 'LYD',
  importMode: 'PRODUCTS_AND_PRICES',
  columnMapping: {
    externalId: 'tbItemNo',
    sourceBarcode: 'tbItemCode',
    name: 'tbItemName',
    price: 'tbSmallUnitQuantity',
    sourceCategory: 'tbCategoryName',
    sourceBrand: 'tbManufacturerName',
    sourceDescription: 'tbItemSpecifications',
  },
  options: {
    stripSurroundingAsterisks: true,
    ignoredBrandValues: ['عام', 'Ø¹Ø§Ù…'],
  },
};
