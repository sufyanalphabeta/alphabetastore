import {
  OrderPaymentStatus,
  OrderStatus,
  PaymentMethodCode,
  PaymentTransactionStatus,
} from '../prisma/prisma-client';
import { PaymentsService } from './payments.service';

type TxMocks = {
  paymentTransaction: {
    create: jest.Mock;
    findUniqueOrThrow: jest.Mock;
  };
  order: {
    update: jest.Mock;
  };
  orderStatusHistory: {
    create: jest.Mock;
  };
};

function buildSerializedPayment(methodCode: any, status: any) {
  return {
    id: 'payment-1',
    orderId: 'order-1',
    amount: 150,
    status,
    referenceNumber: null,
    notes: 'note',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    paymentMethodCode: methodCode,
    paymentMethod: {
      id: 'method-1',
      code: methodCode,
      name: methodCode === PaymentMethodCode.COD ? 'Cash on Delivery' : 'Bank Transfer',
    },
    order: {
      id: 'order-1',
      fullName: 'User A',
      phone: '+218911111111',
      city: 'طرابلس',
      totalAmount: 150,
      paymentMethod: methodCode,
      paymentStatus:
        methodCode === PaymentMethodCode.COD ? OrderPaymentStatus.PAID : OrderPaymentStatus.PENDING,
      status: methodCode === PaymentMethodCode.COD ? OrderStatus.CONFIRMED : OrderStatus.PENDING,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    receipts: [],
  };
}

describe('PaymentsService', () => {
  const identity = {
    userId: 'user-1',
    sessionId: null,
  };

  function setup(methodCode: any) {
    const tx: TxMocks = {
      paymentTransaction: {
        create: jest.fn().mockResolvedValue({ id: 'payment-1' }),
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue(
            buildSerializedPayment(
              methodCode,
              methodCode === PaymentMethodCode.COD
                ? PaymentTransactionStatus.APPROVED
                : PaymentTransactionStatus.PENDING,
            ),
          ),
      },
      order: {
        update: jest.fn().mockResolvedValue(undefined),
      },
      orderStatusHistory: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    };

    const prisma = {
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'order-1',
          totalAmount: 150,
          paymentMethod: null,
          paymentStatus: OrderPaymentStatus.PENDING,
          status: OrderStatus.PENDING,
          userId: 'user-1',
          sessionId: null,
        }),
      },
      paymentMethod: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'method-1',
          code: methodCode,
          name: methodCode === PaymentMethodCode.COD ? 'Cash on Delivery' : 'Bank Transfer',
          isActive: true,
        }),
      },
      paymentTransaction: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (cb: (tx: TxMocks) => Promise<unknown>) => cb(tx)),
    };

    return {
      service: new PaymentsService(prisma as any, {
        notify: jest.fn(),
        notifyPaymentReceived: jest.fn(),
      } as any),
      prisma,
      tx,
    };
  }

  it('creates COD payment and marks order as paid/confirmed', async () => {
    const { service, tx } = setup(PaymentMethodCode.COD);

    const result = await service.createOrderPayment(identity, 'order-1', {
      paymentMethod: PaymentMethodCode.COD,
    } as any);

    expect(result.status).toBe(PaymentTransactionStatus.APPROVED);
    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentStatus: OrderPaymentStatus.PAID,
          status: OrderStatus.CONFIRMED,
        }),
      }),
    );
    expect(tx.orderStatusHistory.create).toHaveBeenCalledTimes(1);
  });

  it('creates bank transfer payment and keeps order pending', async () => {
    const { service, tx } = setup(PaymentMethodCode.BANK_TRANSFER);

    const result = await service.createOrderPayment(identity, 'order-1', {
      paymentMethod: PaymentMethodCode.BANK_TRANSFER,
    } as any);

    expect(result.status).toBe(PaymentTransactionStatus.PENDING);
    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentStatus: OrderPaymentStatus.PENDING,
        }),
      }),
    );
    expect(tx.orderStatusHistory.create).not.toHaveBeenCalled();
  });
});
