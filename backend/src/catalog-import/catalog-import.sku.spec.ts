import { Decimal } from '@prisma/client/runtime/library';
import { CatalogImportService } from './catalog-import.service';

const profile = { sourceSystem: 'RAKIZA' } as never;
const mappedRow = {
  externalId: '5500029', name: 'Rakiza product', price: '100', mappedCategoryId: 'category-1',
  mappedBrandId: null, sourceBarcode: '*5500029*', sourceCategory: 'Software', sourceDescription: null,
};

function setup() {
  const product = { id: 'product-1', slug: 'rakiza-product', sku: 'AB-000777', categoryId: 'category-1', price: new Decimal(100), comparePrice: null, baseCurrency: 'LYD' };
  const tx: any = {
    category: { findUnique: jest.fn().mockResolvedValue({ id: 'category-1', isActive: true }) },
    brand: { findUnique: jest.fn() },
    product: { findUnique: jest.fn().mockImplementation(({ where }: any) => where.slug ? null : product), create: jest.fn().mockResolvedValue(product), update: jest.fn() },
    productSourceIdentity: {
      create: jest.fn(),
      findUnique: jest.fn().mockResolvedValue({ id: 'identity-1', productId: product.id, sourceSystem: 'RAKIZA', externalId: '5500029', sourceBarcode: '*5500029*', lastImportedPrice: new Decimal(100), lastImportedCategoryId: 'category-1' }),
      findFirst: jest.fn(), update: jest.fn(),
    },
    catalogImportRow: { update: jest.fn() }, priceHistory: { create: jest.fn() },
  };
  const prisma: any = { $transaction: jest.fn().mockImplementation((callback: any) => callback(tx)), catalogImportRow: { update: jest.fn() } };
  const sku = { resolve: jest.fn().mockResolvedValue('AB-000777') };
  return { service: new CatalogImportService(prisma, {} as never, {} as never, sku as never), tx, sku };
}

describe('CatalogImportService Product SKU integration', () => {
  it('assigns an internal SKU to a newly imported Product', async () => {
    const { service, tx, sku } = setup();
    await (service as any).applyRow('session-1', 'row-1', 'NEW', null, mappedRow, profile, 'admin-1');
    expect(sku.resolve).toHaveBeenCalledWith(undefined, tx);
    expect(tx.product.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sku: 'AB-000777' }) }));
    expect(tx.productSourceIdentity.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ externalId: '5500029', sourceBarcode: '*5500029*' }) }));
  });

  it('preserves the existing internal SKU on a repeated import', async () => {
    const { service, tx, sku } = setup();
    await (service as any).applyRow('session-2', 'row-2', 'UNCHANGED', 'product-1', mappedRow, profile, 'admin-1');
    expect(sku.resolve).not.toHaveBeenCalled();
    expect(tx.product.update).not.toHaveBeenCalled();
  });
});
