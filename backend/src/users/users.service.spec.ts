import { UsersService } from './users.service';

describe('UsersService customer identity', () => {
  function createService(sequenceValue: bigint, createdCustomerCode?: string) {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ value: sequenceValue }]),
      user: {
        create: jest.fn().mockResolvedValue({
          id: 'customer-1',
          customerCode: createdCustomerCode ?? String(sequenceValue).padStart(3, '0'),
        }),
      },
    };
    return { service: new UsersService(prisma as never), prisma };
  }

  it('allocates a numeric customer code when omitted', async () => {
    const { service, prisma } = createService(42n);

    await service.createCustomer({
      name: 'Test Customer',
      email: 'customer@example.com',
      phone: '+218911111111',
      passwordHash: 'hash',
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ customerCode: '042' }),
      }),
    );
  });

  it('preserves an explicitly supplied customer code', async () => {
    const { service, prisma } = createService(99n, 'CUSTOM-01');

    await service.createCustomer({
      name: 'Test Customer',
      email: 'customer@example.com',
      phone: '+218911111111',
      passwordHash: 'hash',
      customerCode: 'CUSTOM-01',
    });

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ customerCode: 'CUSTOM-01' }),
      }),
    );
  });
});
