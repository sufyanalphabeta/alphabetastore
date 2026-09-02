import { ActivityPresetsService } from './activity-presets.service';

function previewPrisma() {
  return {
    attributeDefinition: { findMany: jest.fn().mockResolvedValue([{ code: 'brand' }]) },
    attributeProfile: { findMany: jest.fn().mockResolvedValue([]) },
    category: { findMany: jest.fn().mockResolvedValue([
      { id: 'laptops-id', slug: 'laptops', name: 'Laptops', attributeProfileId: null },
    ]) },
  };
}

describe('ActivityPresetsService', () => {
  it('previews the electronics preset without mutating the database', async () => {
    const prisma = previewPrisma();
    const service = new ActivityPresetsService(prisma as never, { clear: jest.fn() } as never);

    const result = await service.preview();

    expect(result.preset.code).toBe('ELECTRONICS_COMPUTERS');
    expect(result.categoriesMatched).toEqual([{ id: 'laptops-id', slug: 'laptops', name: 'Laptops' }]);
    expect(result.categoriesUnmatched).toContain('monitors');
    expect(result.items.some(item => item.classification === 'CREATE')).toBe(true);
    expect(prisma.attributeDefinition.findMany).toHaveBeenCalledTimes(1);
  });

  it('applies missing definitions, profiles and empty category links transactionally', async () => {
    const tx = {
      attributeDefinition: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn(async ({ data }) => ({ id: `${data.code}-id`, ...data })) },
      attributeProfile: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn(async ({ data }) => ({ id: `${data.name}-id`, ...data })) },
      category: { findMany: jest.fn().mockResolvedValue([{ id: 'laptops-id', slug: 'laptops', attributeProfileId: null }]), update: jest.fn() },
      systemSetting: { upsert: jest.fn() },
    };
    const prisma = { $transaction: jest.fn(callback => callback(tx)) };
    const service = new ActivityPresetsService(prisma as never, { clear: jest.fn() } as never);

    const result = await service.apply();

    expect(result.createdDefinitions).toBeGreaterThan(0);
    expect(result.createdProfiles).toBeGreaterThan(0);
    expect(tx.category.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'laptops-id' } }));
    expect(tx.systemSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { key: 'activity_preset_code' } }));
  });
});
