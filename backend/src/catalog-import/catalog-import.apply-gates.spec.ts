import { BadRequestException } from '@nestjs/common';
import { CatalogImportService } from './catalog-import.service';

function serviceWithStatus(status: string) {
  const prisma: any = {
    catalogImportSession: { findUnique: jest.fn().mockResolvedValue({ id: 's-1', status, profile: {} }) },
    catalogImportRow: {},
  };
  return new CatalogImportService(prisma, {} as never, {} as never);
}

describe('CatalogImportService apply gates', () => {
  it('rejects a session that is not ready for review', async () => {
    await expect(serviceWithStatus('ANALYZING').apply('s-1', 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an already completed session without executing mutations', async () => {
    const service = serviceWithStatus('COMPLETED');
    await expect(service.apply('s-1', 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
  });
});
