import { MediaLibraryController } from './media-library.controller';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { Role } from '../prisma/prisma-client';

describe('MediaLibraryController', () => {
  const service = {
    upload: jest.fn(),
    list: jest.fn(),
    findOne: jest.fn(),
    updateMetadata: jest.fn(),
    remove: jest.fn(),
  };
  const controller = new MediaLibraryController(service as any);

  beforeEach(() => jest.clearAllMocks());

  it('declares the existing ADMIN role contract on the controller', () => {
    expect(Reflect.getMetadata(ROLES_KEY, MediaLibraryController)).toEqual([Role.ADMIN]);
    expect(Reflect.getMetadata('__guards__', MediaLibraryController)).toHaveLength(2);
  });

  it('rejects an anonymous upload request without a file', () => {
    expect(() => controller.upload(undefined, { user: { sub: 'admin-1' } } as any)).toThrow('image is required');
  });

  it('delegates upload/list/details/update/delete and keeps admin route contract', async () => {
    const file = { originalname: 'x.jpg' } as Express.Multer.File;
    service.upload.mockResolvedValue({ id: 'a' });
    service.list.mockResolvedValue({ items: [] });
    service.findOne.mockResolvedValue({ id: 'a' });
    service.updateMetadata.mockResolvedValue({ id: 'a' });
    service.remove.mockResolvedValue({ deleted: true });
    await expect(controller.upload(file, { user: { sub: 'admin-1' } } as any)).resolves.toEqual({ id: 'a' });
    await expect(controller.list({ page: 1 } as any)).resolves.toEqual({ items: [] });
    await expect(controller.findOne('a')).resolves.toEqual({ id: 'a' });
    await expect(controller.updateMetadata('a', { title: 'x' })).resolves.toEqual({ id: 'a' });
    await expect(controller.remove('a')).resolves.toEqual({ deleted: true });
    expect(service.upload).toHaveBeenCalledWith(file, 'admin-1');
    expect(service.list).toHaveBeenCalledWith({ page: 1 });
    expect(service.findOne).toHaveBeenCalledWith('a');
    expect(service.updateMetadata).toHaveBeenCalledWith('a', { title: 'x' });
    expect(service.remove).toHaveBeenCalledWith('a');
  });
});
