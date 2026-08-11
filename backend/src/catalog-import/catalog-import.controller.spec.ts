import { CatalogImportController } from './catalog-import.controller';

describe('CatalogImportController', () => {
  it('delegates the admin preview endpoints to the import service', async () => {
    const service = {
      createPreview: jest.fn().mockResolvedValue({ id: 'session-1' }),
      listSessions: jest.fn().mockResolvedValue([]),
      findSession: jest.fn().mockResolvedValue({ id: 'session-1' }),
      findRows: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
      listUnmappedCategories: jest.fn().mockResolvedValue([]),
      resolveCategory: jest.fn().mockResolvedValue({}),
      apply: jest.fn().mockResolvedValue({ status: 'COMPLETED' }),
    };
    const controller = new CatalogImportController(service as never);
    const file = { originalname: 'PriceList.csv' } as Express.Multer.File;
    const request = { user: { sub: 'admin-1' } };

    await expect(controller.create(file, request)).resolves.toEqual({ id: 'session-1' });
    await expect(controller.list()).resolves.toEqual([]);
    await expect(controller.find('session-1')).resolves.toEqual({ id: 'session-1' });
    await expect(controller.rows('session-1', { page: 1, pageSize: 2 })).resolves.toEqual({ rows: [], total: 0 });
    await expect(controller.unmappedCategories('session-1')).resolves.toEqual([]);
    await expect(controller.resolveCategory('session-1', { sourceCategory: 'Server', categoryId: 'cat-1' })).resolves.toEqual({});
    await expect(controller.apply('session-1', request)).resolves.toEqual({ status: 'COMPLETED' });
    expect(service.createPreview).toHaveBeenCalledWith(file, 'admin-1');
    expect(service.findRows).toHaveBeenCalledWith('session-1', { page: 1, pageSize: 2 });
    expect(service.listUnmappedCategories).toHaveBeenCalledWith('session-1');
    expect(service.resolveCategory).toHaveBeenCalledWith('session-1', { sourceCategory: 'Server', categoryId: 'cat-1' });
    expect(service.apply).toHaveBeenCalledWith('session-1', 'admin-1');
  });
});
