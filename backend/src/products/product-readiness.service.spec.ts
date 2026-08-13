import { Decimal } from '@prisma/client/runtime/library';

import { ProductReadinessService } from './product-readiness.service';

const readyProduct = () => ({
  name: 'Laptop',
  price: new Decimal(100),
  stockQty: 0,
  shortDescription: 'Short',
  description: 'Description',
  brandId: 'brand-1',
  specs: { cpu: 'i7' },
  warrantyText: '1 year',
  sku: 'SKU-1',
  category: { isActive: true, isVisible: true },
  media: [{
    role: 'PRIMARY',
    mediaAsset: { processingStatus: 'READY', originalWidth: 1200, originalHeight: 1200 },
  }],
  images: [],
  sourceIdentities: [],
});

describe('ProductReadinessService', () => {
  const service = new ProductReadinessService();

  it('marks a valid product with a READY primary image as ready even with zero stock', () => {
    expect(service.evaluate(readyProduct())).toMatchObject({ readyToPublish: true, blockers: [] });
  });

  it.each([
    ['zero price', { price: new Decimal(0) }, 'INVALID_PRICE'],
    ['inactive category', { category: { isActive: false, isVisible: true } }, 'INVALID_CATEGORY'],
    ['invisible category', { category: { isActive: true, isVisible: false } }, 'INVALID_CATEGORY'],
    ['missing image', { media: [], images: [] }, 'MISSING_IMAGE'],
    ['non-ready primary', { media: [{ role: 'PRIMARY', mediaAsset: { processingStatus: 'FAILED' } }], images: [{ id: 'legacy' }] }, 'MISSING_IMAGE'],
  ])('blocks %s', (_label, change, blocker) => {
    const result = service.evaluate({ ...readyProduct(), ...change });
    expect(result.readyToPublish).toBe(false);
    expect(result.blockers).toContain(blocker);
  });

  it('accepts a legacy image only when ProductMedia does not exist', () => {
    const result = service.evaluate({ ...readyProduct(), media: [], images: [{ id: 'legacy' }] });
    expect(result.blockers).not.toContain('MISSING_IMAGE');
  });

  it('does not treat a visual placeholder as a real image', () => {
    const result = service.evaluate({ ...readyProduct(), media: [], images: [] });
    expect(result.blockers).toContain('MISSING_IMAGE');
  });

  it('emits supported quality warnings without blocking publication', () => {
    const result = service.evaluate({
      ...readyProduct(),
      brandId: null,
      brand: '',
      specs: {},
      warrantyText: '',
      sku: '',
      sourceIdentities: [{ sourceBarcode: '', lastImportedName: 'Laptop' }],
      media: [{ role: 'PRIMARY', mediaAsset: { processingStatus: 'READY', originalWidth: 400, originalHeight: 300 } }],
    });
    expect(result.readyToPublish).toBe(true);
    expect(result.warnings).toEqual(expect.arrayContaining([
      'MISSING_BRAND', 'MISSING_SPECS', 'ONLY_ONE_IMAGE', 'LOW_RESOLUTION_IMAGE',
      'MISSING_WARRANTY', 'MISSING_SKU', 'MISSING_SOURCE_BARCODE', 'SOURCE_NAME_UNCHANGED',
    ]));
  });
});
