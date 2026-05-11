import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { OrderPaymentStatus, OrderStatus, PaymentMethodCode } from '../prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../queue/notification.service';
import { PricingService } from '../pricing/pricing.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { FindOrdersQueryDto } from './dto/find-orders-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

type OrderIdentity = {
  userId: string | null;
  sessionId: string | null;
};

const orderInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
    },
  },
  items: {
    orderBy: {
      id: 'asc',
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          images: {
            orderBy: {
              sortOrder: 'asc',
            },
            select: {
              imageUrl: true,
            },
          },
        },
      },
    },
  },
  savedAddress: {
    select: {
      id: true,
      label: true,
    },
  },
  paymentTransactions: {
    orderBy: {
      createdAt: 'desc',
    },
    take: 1,
    include: {
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
        select: {
          id: true,
          fileUrl: true,
          reviewStatus: true,
          createdAt: true,
        },
      },
    },
  },
  statusHistory: {
    orderBy: {
      createdAt: 'asc',
    },
    include: {
      changedByUser: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
  },
} as const;

const cartForOrderInclude = {
  items: {
    orderBy: {
      id: 'asc',
    },
    include: {
      product: {
        select: {
          name: true,
          stockQty: true,
          baseCurrency: true,
          comparePrice: true,
          discountType: true,
          discountValue: true,
          discountStartAt: true,
          discountEndAt: true,
        },
      },
    },
  },
} as const;

type CartForOrder = Prisma.CartGetPayload<{ include: typeof cartForOrderInclude }>;

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;
const ORDER_STATUS_VALUES = Object.values(OrderStatus) as Array<
  (typeof OrderStatus)[keyof typeof OrderStatus]
>;

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly pricingService: PricingService,
  ) {}

  async createOrder(identity: OrderIdentity, createOrderDto: CreateOrderDto) {
    const cart = await this.findCartWithItems(identity);

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty.');
    }

    for (const item of cart.items) {
      if (item.product.stockQty < item.quantity) {
        throw new BadRequestException(
          `"${item.product.name}" has insufficient stock (available: ${item.product.stockQty}).`,
        );
      }
    }

    const savedAddress = await this.resolveSavedAddress(identity.userId, createOrderDto.addressId);

    const totalAmount = cart.items.reduce(
      (sum: number, item: CartForOrder['items'][number]) =>
        sum + Number(item.unitPrice) * item.quantity,
      0,
    );

    const minimumOrderAmount = await this.getMinimumOrderAmount();

    if (totalAmount < minimumOrderAmount) {
      throw new BadRequestException(
        `Minimum order amount is ${minimumOrderAmount}.`,
      );
    }

    const orderNumber = await this.generateOrderNumber(identity.userId);

    // Lock exchange rate at time of order
    const pricingSettings = await this.pricingService.getPricingSettings();

    const [order] = await this.prisma.$transaction([
      this.prisma.order.create({
        data: {
          userId: identity.userId,
          sessionId: identity.userId ? null : this.requireSessionId(identity),
          addressId: savedAddress?.id ?? null,
          orderNumber,
          fullName: createOrderDto.fullName,
          phone: createOrderDto.phone,
          city: createOrderDto.city,
          address: createOrderDto.address,
          notes: createOrderDto.notes?.trim() || null,
          paymentStatus: OrderPaymentStatus.PENDING,
          totalAmount,
          status: OrderStatus.PENDING,
          items: {
            create: cart.items.map((item: CartForOrder['items'][number]) => ({
              productId: item.productId,
              productName: item.product.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              baseCurrency: item.product.baseCurrency,
              comparePrice: item.product.comparePrice,
              exchangeRateUsed: pricingSettings.exchangeRate,
            })),
          },
          statusHistory: {
            create: {
              status: OrderStatus.PENDING,
              note: null,
              changedByUserId: identity.userId,
            },
          },
        },
        include: orderInclude,
      }),
      ...cart.items.map((item: CartForOrder['items'][number]) =>
        this.prisma.product.update({
          where: { id: item.productId },
          data: {
            stockQty: { decrement: item.quantity },
          },
        }),
      ),
      this.prisma.cartItem.deleteMany({
        where: {
          cartId: cart.id,
        },
      }),
      this.prisma.cart.update({
        where: { id: cart.id },
        data: {
          updatedAt: new Date(),
        },
      }),
    ]);

    void this.notificationService.notifyOrderPlaced({
      orderId: order.id,
      userId: identity.userId,
      totalAmount: Number(order.totalAmount),
    });

    return this.serializeOrder(order);
  }

  async findAll(query: FindOrdersQueryDto = {}) {
    return this.findManyWithQuery({}, query);
  }

  async findOne(id: string) {
    return this.findOneForAccess({
      id,
      userId: null,
      isAdmin: true,
    });
  }

  async findMine(userId: string, query: FindOrdersQueryDto = {}) {
    return this.findManyWithQuery({ userId }, query);
  }

  async findOneForUser(id: string, userId: string, isAdmin: boolean) {
    return this.findOneForAccess({
      id,
      userId,
      isAdmin,
    });
  }

  async updateStatus(id: string, adminUserId: string, updateOrderStatusDto: UpdateOrderStatusDto) {
    const existingOrder = await this.prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
      },
    });

    if (!existingOrder) {
      throw new NotFoundException('Order not found.');
    }

    if (existingOrder.status === updateOrderStatusDto.status) {
      throw new BadRequestException('Order is already in the requested status.');
    }

    const transactionResults = await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id },
        data: {
          status: updateOrderStatusDto.status,
        },
      }),
      this.prisma.orderStatusHistory.create({
        data: {
          orderId: id,
          status: updateOrderStatusDto.status,
          note: updateOrderStatusDto.note?.trim() || null,
          changedByUserId: adminUserId,
        },
      }),
      this.prisma.order.findUniqueOrThrow({
        where: { id },
        include: orderInclude,
      }),
    ]);

    const updatedOrder = transactionResults[2];

    void this.notificationService.notifyOrderStatusChanged({
      orderId: updatedOrder.id,
      userId: updatedOrder.userId,
      status: updatedOrder.status,
    });

    return this.serializeOrder(updatedOrder);
  }

  private async findCartWithItems(identity: OrderIdentity) {
    return this.prisma.cart.findFirst({
      where: identity.userId
        ? {
            userId: identity.userId,
          }
        : {
            sessionId: this.requireSessionId(identity),
          },
      include: cartForOrderInclude,
    });
  }

  private requireSessionId(identity: OrderIdentity) {
    if (!identity.sessionId?.trim()) {
      throw new BadRequestException('Session id is required for guest checkout.');
    }

    return identity.sessionId;
  }

  private async findOneForAccess({
    id,
    userId,
    isAdmin,
  }: {
    id: string;
    userId: string | null;
    isAdmin: boolean;
  }) {
    const order = await this.prisma.order.findFirst({
      where: {
        id,
        ...(isAdmin ? {} : { userId }),
      },
      include: orderInclude,
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    return this.serializeOrder(order);
  }

  private async resolveSavedAddress(userId: string | null, addressId?: string) {
    if (!addressId) {
      return null;
    }

    if (!userId) {
      throw new BadRequestException('Guests cannot use saved addresses.');
    }

    const address = await this.prisma.address.findFirst({
      where: {
        id: addressId,
        userId,
      },
      select: {
        id: true,
      },
    });

    if (!address) {
      throw new NotFoundException('Address not found.');
    }

    return address;
  }

  private serializeOrder(
    order: OrderWithRelations,
  ) {
    const latestPayment = order.paymentTransactions[0] ?? null;
    const latestReceipt = latestPayment?.receipts[0] ?? null;
    const statusHistory = order.statusHistory.length
      ? order.statusHistory
      : [
          {
            id: `${order.id}-initial`,
            orderId: order.id,
            status: order.status,
            note: null,
            changedByUserId: order.userId,
            createdAt: order.createdAt,
            changedByUser: order.user
              ? {
                  id: order.user.id,
                  name: order.user.name,
                  role: order.user.role,
                }
              : null,
          },
        ];

    return {
      id: order.id,
      userId: order.userId,
      sessionId: order.sessionId,
      addressId: order.addressId,
      orderNumber: order.orderNumber ?? null,
      fullName: order.fullName,
      phone: order.phone,
      city: order.city,
      address: order.address,
      notes: order.notes,
      totalAmount: Number(order.totalAmount),
      status: order.status,
      orderPaymentMethod: order.paymentMethod,
      paymentTransactionId: latestPayment?.id ?? null,
      paymentMethodCode:
        order.paymentMethod ?? latestPayment?.paymentMethodCode ?? latestPayment?.paymentMethod.code ?? null,
      paymentMethod:
        order.paymentMethod === PaymentMethodCode.COD
          ? 'Cash on Delivery'
          : order.paymentMethod === PaymentMethodCode.BANK_TRANSFER
            ? 'Bank Transfer'
            : latestPayment?.paymentMethod.name ?? null,
      paymentStatus: order.paymentStatus ?? latestPayment?.status ?? null,
      paymentReceipt: latestReceipt
        ? {
            id: latestReceipt.id,
            fileUrl: latestReceipt.fileUrl,
            reviewStatus: latestReceipt.reviewStatus,
            createdAt: latestReceipt.createdAt,
          }
        : null,
      createdAt: order.createdAt,
      user: order.user,
      savedAddress: order.savedAddress,
      statusHistory: statusHistory.map((entry: (typeof statusHistory)[number]) => ({
        id: entry.id,
        status: entry.status,
        note: entry.note,
        createdAt: entry.createdAt,
        changedByUser: entry.changedByUser,
      })),
      items: order.items.map((item: OrderWithRelations['items'][number]) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        product: {
          id: item.product.id,
          name: item.productName || item.product.name,
          slug: item.product.slug,
          imageUrl: item.product.images[0]?.imageUrl ?? null,
        },
      })),
    };
  }

  private async getMinimumOrderAmount() {
    const setting = await this.prisma.systemSetting.findUnique({
      where: {
        key: 'min_order',
      },
      select: {
        value: true,
      },
    });

    const value = Number(setting?.value || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  private async generateOrderNumber(userId: string | null): Promise<string> {
    let customerCode: string | null = null;

    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { customerCode: true },
      });
      customerCode = user?.customerCode ?? null;
    }

    const code = customerCode ?? 'GUEST';

    const count = await this.prisma.order.count({
      where: userId ? { userId } : {},
    });

    const seq = String(count + 1).padStart(4, '0');
    return `ORD-${code}-${seq}`;
  }

  private async findManyWithQuery(baseWhere: Record<string, unknown>, query: FindOrdersQueryDto) {
    const where = {
      ...baseWhere,
      ...this.buildSearchWhere(query.q),
    };

    if (!this.shouldPaginate(query)) {
      const orders = await this.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: {
          createdAt: 'desc',
        },
      });

      return orders.map((order: OrderWithRelations) => this.serializeOrder(order));
    }

    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: orders.map((order: OrderWithRelations) => this.serializeOrder(order)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  private shouldPaginate(query: FindOrdersQueryDto) {
    return Boolean(query.q?.trim()) || Number(query.page) > 0 || Number(query.limit) > 0;
  }

  private buildSearchWhere(query?: string) {
    const normalizedQuery = query?.trim();

    if (!normalizedQuery) {
      return {};
    }

    const normalizedStatus = ORDER_STATUS_VALUES.find(
      status => status.toLowerCase() === normalizedQuery.toLowerCase(),
    );

    const orConditions: Array<Record<string, unknown>> = [
      {
        fullName: {
          contains: normalizedQuery,
          mode: 'insensitive' as const,
        },
      },
      {
        phone: {
          contains: normalizedQuery,
          mode: 'insensitive' as const,
        },
      },
      {
        city: {
          contains: normalizedQuery,
          mode: 'insensitive' as const,
        },
      },
      {
        address: {
          contains: normalizedQuery,
          mode: 'insensitive' as const,
        },
      },
    ];

    if (isUuidLike(normalizedQuery)) {
      orConditions.unshift({
        id: normalizedQuery,
      });
    }

    if (normalizedStatus) {
      orConditions.push({ status: normalizedStatus });
    }

    return {
      OR: orConditions,
    };
  }
}