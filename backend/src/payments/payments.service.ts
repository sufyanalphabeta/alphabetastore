import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  PaymentMethodCode as PaymentMethodCodeType,
  PaymentTransactionStatus as PaymentTransactionStatusType,
  Prisma,
} from '@prisma/client';

import {
  OrderPaymentStatus,
  OrderStatus,
  PaymentMethodCode,
  PaymentTransactionStatus,
  ReceiptReviewStatus,
} from '../prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../queue/notification.service';
import { CreateOrderPaymentDto } from './dto/create-order-payment.dto';
import { ReviewPaymentDto } from './dto/review-payment.dto';

type PaymentIdentity = {
  userId: string | null;
  sessionId: string | null;
};

const SUPPORTED_PAYMENT_METHODS = [PaymentMethodCode.COD, PaymentMethodCode.BANK_TRANSFER] as const;

const adminPaymentInclude = {
  order: {
    select: {
      id: true,
      userId: true,
      fullName: true,
      phone: true,
      city: true,
      totalAmount: true,
      paymentMethod: true,
      paymentStatus: true,
      status: true,
      createdAt: true,
    },
  },
  paymentMethod: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  receipts: {
    orderBy: {
      createdAt: 'desc',
    },
    take: 1,
    include: {
      uploadedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      reviewedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
} as const;

type PaymentWithRelations = Prisma.PaymentTransactionGetPayload<{
  include: typeof adminPaymentInclude;
}>;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Look up a receipt and verify the requesting user is allowed to download it.
   * Returns the file URL so the controller can stream it via the storage layer.
   */
  async getReceiptForUser(receiptId: string, userId: string, isAdmin: boolean) {
    const receipt = await this.prisma.bankTransferReceipt.findUnique({
      where: { id: receiptId },
      select: {
        id: true,
        fileUrl: true,
        paymentTransaction: {
          select: {
            id: true,
            order: { select: { id: true, userId: true } },
          },
        },
      },
    });

    if (!receipt) {
      throw new NotFoundException('Receipt not found.');
    }

    const ownerId = receipt.paymentTransaction?.order?.userId ?? null;
    if (!isAdmin && (!ownerId || ownerId !== userId)) {
      throw new NotFoundException('Receipt not found.');
    }

    return receipt;
  }

  async findActiveMethods() {
    const methods = await this.prisma.paymentMethod.findMany({
      where: {
        isActive: true,
        code: {
          in: [...SUPPORTED_PAYMENT_METHODS],
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return methods.map((method) => ({
      id: method.id,
      code: method.code,
      name: method.name,
      isActive: method.isActive,
    }));
  }

  async createOrderPayment(
    identity: PaymentIdentity,
    orderId: string,
    createOrderPaymentDto: CreateOrderPaymentDto,
  ) {
    const order = await this.findOrderForIdentity(identity, orderId);
    const requestedPaymentMethod = createOrderPaymentDto.paymentMethod as PaymentMethodCodeType;
    const paymentMethod = await this.prisma.paymentMethod.findFirst({
      where: {
        code: requestedPaymentMethod,
        isActive: true,
      },
    });

    if (!paymentMethod || !SUPPORTED_PAYMENT_METHODS.includes(paymentMethod.code)) {
      throw new BadRequestException('Payment method is not available.');
    }

    const existingPayment = await this.prisma.paymentTransaction.findFirst({
      where: {
        orderId,
        status: {
          in: [PaymentTransactionStatus.PENDING, PaymentTransactionStatus.APPROVED],
        },
      },
      include: adminPaymentInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (existingPayment) {
      throw new BadRequestException(
        existingPayment.status === PaymentTransactionStatus.APPROVED
          ? 'Payment has already been completed for this order.'
          : 'A payment is already pending review for this order.',
      );
    }

    const payment = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const nextStatus =
        paymentMethod.code === PaymentMethodCode.COD
          ? PaymentTransactionStatus.APPROVED
          : PaymentTransactionStatus.PENDING;

      const createdPayment = await tx.paymentTransaction.create({
        data: {
          orderId,
          paymentMethodId: paymentMethod.id,
          paymentMethodCode: paymentMethod.code,
          amount: order.totalAmount,
          status: nextStatus,
          notes:
            paymentMethod.code === PaymentMethodCode.BANK_TRANSFER
              ? 'Awaiting bank transfer receipt upload.'
              : 'Marked as approved for cash on delivery.',
        },
      });

      await tx.order.update({
        where: {
          id: orderId,
        },
        data: {
          paymentMethod: paymentMethod.code,
          paymentStatus:
            paymentMethod.code === PaymentMethodCode.COD
              ? OrderPaymentStatus.PAID
              : OrderPaymentStatus.PENDING,
          status:
            paymentMethod.code === PaymentMethodCode.COD
              ? OrderStatus.CONFIRMED
              : order.status,
        },
      });

      if (paymentMethod.code === PaymentMethodCode.COD && order.status !== OrderStatus.CONFIRMED) {
        await tx.orderStatusHistory.create({
          data: {
            orderId,
            status: OrderStatus.CONFIRMED,
            note: 'Payment approved via Cash on Delivery.',
            changedByUserId: identity.userId,
          },
        });
      }

      return tx.paymentTransaction.findUniqueOrThrow({
        where: {
          id: createdPayment.id,
        },
        include: adminPaymentInclude,
      });
    });

    void this.notificationService.notifyPaymentReceived({
      orderId,
      paymentId: payment.id,
      userId: identity.userId,
      amount: Number(payment.amount),
    });

    return this.serializePayment(payment);
  }

  async uploadReceipt(identity: PaymentIdentity, paymentId: string, fileUrl: string) {
    const payment = await this.prisma.paymentTransaction.findUnique({
      where: {
        id: paymentId,
      },
      include: {
        order: {
          select: {
            id: true,
            userId: true,
            sessionId: true,
          },
        },
        paymentMethod: {
          select: {
            code: true,
          },
        },
        receipts: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          select: {
            id: true,
            reviewStatus: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found.');
    }

    this.assertOrderIdentity(payment.order, identity);

    if (payment.paymentMethodCode !== PaymentMethodCode.BANK_TRANSFER) {
      throw new BadRequestException('Receipt upload is only available for bank transfer payments.');
    }

    if (payment.status !== PaymentTransactionStatus.PENDING) {
      throw new BadRequestException('This payment is no longer accepting receipts.');
    }

    const existingReceipt = payment.receipts[0];

    if (existingReceipt?.reviewStatus === ReceiptReviewStatus.PENDING) {
      throw new BadRequestException('A receipt has already been uploaded and is pending review.');
    }

    await this.prisma.bankTransferReceipt.create({
      data: {
        paymentTransactionId: payment.id,
        fileUrl,
        uploadedById: identity.userId,
      },
    });

    const updatedPayment = await this.prisma.paymentTransaction.findUniqueOrThrow({
      where: {
        id: payment.id,
      },
      include: adminPaymentInclude,
    });

    return this.serializePayment(updatedPayment);
  }

  async findAllAdminPayments() {
    const payments = await this.prisma.paymentTransaction.findMany({
      where: {
        paymentMethodCode: {
          in: [...SUPPORTED_PAYMENT_METHODS],
        },
      },
      include: adminPaymentInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return payments.map((payment) => this.serializePayment(payment));
  }

  async reviewPayment(paymentId: string, adminUserId: string, reviewPaymentDto: ReviewPaymentDto) {
    const payment = await this.prisma.paymentTransaction.findUnique({
      where: {
        id: paymentId,
      },
      include: adminPaymentInclude,
    });

    if (!payment) {
      throw new NotFoundException('Payment not found.');
    }

    if (payment.status !== PaymentTransactionStatus.PENDING) {
      throw new BadRequestException('Only pending payments can be reviewed.');
    }

    if (
      reviewPaymentDto.status === PaymentTransactionStatus.APPROVED &&
      payment.paymentMethodCode === PaymentMethodCode.BANK_TRANSFER &&
      !payment.receipts.length
    ) {
      throw new BadRequestException('Bank transfer receipt is required before approval.');
    }

    const updatedPayment = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.paymentTransaction.update({
        where: {
          id: payment.id,
        },
        data: {
          status: reviewPaymentDto.status as PaymentTransactionStatusType,
          referenceNumber: reviewPaymentDto.referenceNumber?.trim() || null,
          notes: reviewPaymentDto.notes?.trim() || payment.notes,
        },
      });

      await tx.order.update({
        where: {
          id: payment.order.id,
        },
        data: {
          paymentMethod: payment.paymentMethodCode,
          paymentStatus:
            reviewPaymentDto.status === PaymentTransactionStatus.APPROVED
              ? OrderPaymentStatus.PAID
              : OrderPaymentStatus.REJECTED,
          status:
            reviewPaymentDto.status === PaymentTransactionStatus.APPROVED
              ? OrderStatus.CONFIRMED
              : payment.order.status,
        },
      });

      const latestReceipt = payment.receipts[0];

      if (latestReceipt) {
        await tx.bankTransferReceipt.update({
          where: {
            id: latestReceipt.id,
          },
          data: {
            reviewStatus:
              reviewPaymentDto.status === PaymentTransactionStatus.APPROVED
                ? ReceiptReviewStatus.APPROVED
                : ReceiptReviewStatus.REJECTED,
            reviewedById: adminUserId,
          },
        });
      }

      if (
        reviewPaymentDto.status === PaymentTransactionStatus.APPROVED &&
        payment.order.status !== OrderStatus.CONFIRMED
      ) {
        await tx.order.update({
          where: {
            id: payment.order.id,
          },
          data: {
            status: OrderStatus.CONFIRMED,
          },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: payment.order.id,
            status: OrderStatus.CONFIRMED,
            note: `Payment approved via ${payment.paymentMethod.name}.`,
            changedByUserId: adminUserId,
          },
        });
      }

      return tx.paymentTransaction.findUniqueOrThrow({
        where: {
          id: payment.id,
        },
        include: adminPaymentInclude,
      });
    });

    const serialized = this.serializePayment(updatedPayment);

    if (reviewPaymentDto.status === PaymentTransactionStatus.APPROVED) {
      void this.notificationService.notifyPaymentApproved({
        orderId: payment.order.id,
        paymentId: payment.id,
        userId: payment.order.userId ?? null,
        amount: Number(payment.amount),
      });
    } else {
      void this.notificationService.notifyPaymentRejected({
        orderId: payment.order.id,
        paymentId: payment.id,
        userId: payment.order.userId ?? null,
        amount: Number(payment.amount),
      });
    }

    return serialized;
  }

  private async findOrderForIdentity(identity: PaymentIdentity, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: identity.userId
        ? {
            id: orderId,
            userId: identity.userId,
          }
        : {
            id: orderId,
            sessionId: this.requireSessionId(identity),
          },
      select: {
        id: true,
        totalAmount: true,
        paymentMethod: true,
        paymentStatus: true,
        status: true,
        userId: true,
        sessionId: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    return order;
  }

  private assertOrderIdentity(
    order: {
      id: string;
      userId: string | null;
      sessionId: string | null;
    },
    identity: PaymentIdentity,
  ) {
    if (identity.userId) {
      if (order.userId !== identity.userId) {
        throw new NotFoundException('Payment not found.');
      }

      return;
    }

    if (order.sessionId !== this.requireSessionId(identity)) {
      throw new NotFoundException('Payment not found.');
    }
  }

  private requireSessionId(identity: PaymentIdentity) {
    if (!identity.sessionId?.trim()) {
      throw new BadRequestException('Session id is required for guest payment actions.');
    }

    return identity.sessionId;
  }

  private serializePayment(payment: PaymentWithRelations) {
    const latestReceipt = payment.receipts[0] ?? null;

    return {
      id: payment.id,
      orderId: payment.orderId,
      amount: Number(payment.amount),
      status: payment.status,
      referenceNumber: payment.referenceNumber,
      notes: payment.notes,
      createdAt: payment.createdAt,
      paymentMethodId: payment.paymentMethod.id,
      paymentMethodCode: payment.paymentMethodCode,
      paymentMethodName: payment.paymentMethod.name,
      order: {
        id: payment.order.id,
        fullName: payment.order.fullName,
        phone: payment.order.phone,
        city: payment.order.city,
        totalAmount: Number(payment.order.totalAmount),
        paymentMethod: payment.order.paymentMethod,
        paymentStatus: payment.order.paymentStatus,
        status: payment.order.status,
        createdAt: payment.order.createdAt,
      },
      receipt: latestReceipt
        ? {
            id: latestReceipt.id,
            fileUrl: latestReceipt.fileUrl,
            reviewStatus: latestReceipt.reviewStatus,
            createdAt: latestReceipt.createdAt,
            uploadedBy: latestReceipt.uploadedBy,
            reviewedBy: latestReceipt.reviewedBy,
          }
        : null,
    };
  }
}