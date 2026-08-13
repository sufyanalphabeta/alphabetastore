import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { OrderPaymentStatus, OrderStatus, PaymentMethodCode } from "../prisma/prisma-client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationService } from "../queue/notification.service";
import { PricingService } from "../pricing/pricing.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { FindOrdersQueryDto } from "./dto/find-orders-query.dto";
import { UpdateOrderStatusDto } from "./dto/update-order-status.dto";
import { ProductsService } from "../products/products.service";
import {
  assertPurchaseQuantity,
  PURCHASE_QUANTITY_ERROR
} from "../inventory/purchase-quantity.policy";

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
      role: true
    }
  },
  items: {
    orderBy: {
      id: "asc"
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          images: {
            orderBy: {
              sortOrder: "asc"
            },
            select: {
              imageUrl: true
            }
          }
        }
      }
    }
  },
  savedAddress: {
    select: {
      id: true,
      label: true
    }
  },
  paymentTransactions: {
    orderBy: {
      createdAt: "desc"
    },
    take: 1,
    include: {
      paymentMethod: {
        select: {
          id: true,
          code: true,
          name: true
        }
      },
      receipts: {
        orderBy: {
          createdAt: "desc"
        },
        take: 1,
        select: {
          id: true,
          fileUrl: true,
          reviewStatus: true,
          createdAt: true
        }
      }
    }
  },
  statusHistory: {
    orderBy: {
      createdAt: "asc"
    },
    include: {
      changedByUser: {
        select: {
          id: true,
          name: true,
          role: true
        }
      }
    }
  }
} as const;

const cartForOrderInclude = {
  items: {
    orderBy: {
      id: "asc"
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          stockQty: true,
          maxPurchaseQty: true,
          status: true,
          hasVariants: true,
          baseCurrency: true,
          comparePrice: true,
          discountType: true,
          discountValue: true,
          discountStartAt: true,
          discountEndAt: true
        }
      },
      variant: {
        select: {
          id: true,
          name: true,
          attributes: true,
          stockQty: true
        }
      }
    }
  }
} as const;

type CartForOrder = Prisma.CartGetPayload<{ include: typeof cartForOrderInclude }>;

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;
const ORDER_STATUS_VALUES = Object.values(OrderStatus) as Array<
  (typeof OrderStatus)[keyof typeof OrderStatus]
>;

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly pricingService: PricingService,
    private readonly productsService: ProductsService
  ) {}

  async createOrder(identity: OrderIdentity, createOrderDto: CreateOrderDto) {
    const cart = await this.findCartWithItems(identity);

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException("Cart is empty.");
    }

    // Idempotency: if a key was provided, return any existing order with that key.
    if (createOrderDto.idempotencyKey) {
      const existing = await this.prisma.order.findUnique({
        where: { idempotencyKey: createOrderDto.idempotencyKey },
        include: orderInclude
      });
      if (existing) {
        return this.serializeOrder(existing);
      }
    }

    const productQuantities = this.sumProductQuantities(cart);

    // Fast-path validation. Current database state is checked again in the transaction.
    for (const item of cart.items) {
      const effectiveStock = item.variant ? item.variant.stockQty : item.product.stockQty;
      assertPurchaseQuantity(
        item.quantity,
        {
          stockQty:
            item.product.status === "ACTIVE" &&
            (!item.product.hasVariants || (item.variantId && item.variant))
              ? effectiveStock
              : 0,
          maxPurchaseQty: item.product.maxPurchaseQty,
          otherProductQuantity:
            (productQuantities.get(item.productId) ?? item.quantity) - item.quantity
        },
        { staleCart: true }
      );
    }

    const savedAddress = await this.resolveSavedAddress(identity.userId, createOrderDto.addressId);

    const totalAmount = cart.items.reduce(
      (sum: number, item: CartForOrder["items"][number]) =>
        sum + Number(item.unitPrice) * item.quantity,
      0
    );

    const minimumOrderAmount = await this.getMinimumOrderAmount();

    if (totalAmount < minimumOrderAmount) {
      throw new BadRequestException(`Minimum order amount is ${minimumOrderAmount}.`);
    }

    const orderNumber = await this.generateOrderNumber(identity.userId);

    // Lock exchange rate at time of order
    const pricingSettings = await this.pricingService.getPricingSettings();

    // Use an interactive transaction so we can atomically decrement stock
    // with an UPDATE ... WHERE stock_qty >= qty check that prevents overselling.
    let order: OrderWithRelations;
    try {
      order = await this.prisma.$transaction(
        async (tx) => {
          const currentProducts = await tx.product.findMany({
            where: { id: { in: [...productQuantities.keys()] } },
            select: { id: true, status: true, maxPurchaseQty: true, hasVariants: true }
          });
          const currentProductById = new Map(
            currentProducts.map((product) => [product.id, product])
          );

          // Atomically decrement stock for each line item.
          // If stockQty < quantity, updateMany returns count=0 → throw immediately.
          for (const item of cart.items) {
            const currentProduct = currentProductById.get(item.productId);
            const totalProductQuantity = productQuantities.get(item.productId) ?? item.quantity;
            if (
              !currentProduct ||
              currentProduct.status !== "ACTIVE" ||
              (currentProduct.hasVariants && (!item.variantId || !item.variant))
            ) {
              throw new BadRequestException({
                errorCode: PURCHASE_QUANTITY_ERROR.CART_STOCK_CHANGED,
                message: `"${item.product.name}" is no longer available.`
              });
            }
            if (
              currentProduct.maxPurchaseQty != null &&
              totalProductQuantity > currentProduct.maxPurchaseQty
            ) {
              throw new BadRequestException({
                errorCode: PURCHASE_QUANTITY_ERROR.MAX_PURCHASE_QUANTITY_EXCEEDED,
                message: `Maximum purchase quantity for "${item.product.name}" is ${currentProduct.maxPurchaseQty}.`
              });
            }

            if (item.variantId && item.variant) {
              // Decrement variant stock
              const variantResult = await tx.productVariant.updateMany({
                where: {
                  id: item.variantId,
                  stockQty: { gte: item.quantity }
                },
                data: { stockQty: { decrement: item.quantity } }
              });
              if (variantResult.count === 0) {
                throw new BadRequestException({
                  errorCode: PURCHASE_QUANTITY_ERROR.CART_STOCK_CHANGED,
                  message: `Requested quantity for "${item.product.name}" is no longer available.`
                });
              }
            } else {
              // Decrement product stock
              const productResult = await tx.product.updateMany({
                where: {
                  id: item.productId,
                  stockQty: { gte: item.quantity }
                },
                data: { stockQty: { decrement: item.quantity } }
              });
              if (productResult.count === 0) {
                throw new BadRequestException({
                  errorCode: PURCHASE_QUANTITY_ERROR.CART_STOCK_CHANGED,
                  message: `Requested quantity for "${item.product.name}" is no longer available.`
                });
              }
            }
          }

          const newOrder = await tx.order.create({
            data: {
              userId: identity.userId,
              sessionId: identity.userId ? null : this.requireSessionId(identity),
              addressId: savedAddress?.id ?? null,
              orderNumber,
              idempotencyKey: createOrderDto.idempotencyKey ?? null,
              fullName: createOrderDto.fullName,
              phone: createOrderDto.phone,
              city: createOrderDto.city,
              address: createOrderDto.address,
              notes: createOrderDto.notes?.trim() || null,
              paymentStatus: OrderPaymentStatus.PENDING,
              totalAmount,
              status: OrderStatus.PENDING,
              items: {
                create: cart.items.map((item: CartForOrder["items"][number]) => ({
                  productId: item.productId,
                  variantId: item.variantId ?? null,
                  variantName: item.variantName ?? item.variant?.name ?? null,
                  variantAttributes: item.variantAttributes
                    ? (item.variantAttributes as Prisma.InputJsonValue)
                    : item.variant?.attributes
                      ? (item.variant.attributes as Prisma.InputJsonValue)
                      : undefined,
                  productName: item.product.name,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  baseCurrency: item.product.baseCurrency,
                  comparePrice: item.product.comparePrice,
                  exchangeRateUsed: pricingSettings.exchangeRate
                }))
              },
              statusHistory: {
                create: {
                  status: OrderStatus.PENDING,
                  note: null,
                  changedByUserId: identity.userId
                }
              }
            },
            include: orderInclude
          });

          await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
          await tx.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } });

          return newOrder;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2034"
      ) {
        throw new BadRequestException({
          errorCode: PURCHASE_QUANTITY_ERROR.CART_STOCK_CHANGED,
          message: "Inventory changed while placing the order. Refresh the cart and try again."
        });
      }
      throw error;
    }

    void this.notificationService.notifyOrderPlaced({
      orderId: order.id,
      userId: identity.userId,
      totalAmount: Number(order.totalAmount)
    });
    await this.invalidateInventoryProductCaches(
      cart.items.map((item) => ({ id: item.productId, slug: item.product.slug }))
    );

    return this.serializeOrder(order);
  }

  async findAll(query: FindOrdersQueryDto = {}) {
    return this.findManyWithQuery({}, query);
  }

  async findOne(id: string) {
    return this.findOneForAccess({
      id,
      userId: null,
      isAdmin: true
    });
  }

  async findMine(userId: string, query: FindOrdersQueryDto = {}) {
    return this.findManyWithQuery({ userId }, query);
  }

  async findOneForUser(id: string, userId: string, isAdmin: boolean) {
    return this.findOneForAccess({
      id,
      userId,
      isAdmin
    });
  }

  async updateStatus(id: string, adminUserId: string, updateOrderStatusDto: UpdateOrderStatusDto) {
    if (updateOrderStatusDto.status === OrderStatus.CANCELLED) {
      throw new BadRequestException(
        "Use the explicit cancel action so inventory is restored safely."
      );
    }
    const existingOrder = await this.prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true
      }
    });

    if (!existingOrder) {
      throw new NotFoundException("Order not found.");
    }

    if (existingOrder.status === OrderStatus.CANCELLED) {
      throw new BadRequestException("Cancelled orders cannot transition to another status.");
    }

    if (existingOrder.status === updateOrderStatusDto.status) {
      throw new BadRequestException("Order is already in the requested status.");
    }

    const transactionResults = await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id },
        data: {
          status: updateOrderStatusDto.status
        }
      }),
      this.prisma.orderStatusHistory.create({
        data: {
          orderId: id,
          status: updateOrderStatusDto.status,
          note: updateOrderStatusDto.note?.trim() || null,
          changedByUserId: adminUserId
        }
      }),
      this.prisma.order.findUniqueOrThrow({
        where: { id },
        include: orderInclude
      })
    ]);

    const updatedOrder = transactionResults[2];

    void this.notificationService.notifyOrderStatusChanged({
      orderId: updatedOrder.id,
      userId: updatedOrder.userId,
      status: updatedOrder.status
    });

    return this.serializeOrder(updatedOrder);
  }

  /**
   * Customer-initiated cancellation. Only allowed while the order is still PENDING.
   * Restores stock for every line item, marks the order CANCELLED, voids any pending
   * payment, and writes an audit row to OrderStatusHistory in the same transaction.
   */
  async cancelOrder(orderId: string, userId: string, isAdmin: boolean, note?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          select: {
            productId: true,
            variantId: true,
            quantity: true,
            product: { select: { slug: true } }
          }
        }
      }
    });

    if (!order) {
      throw new NotFoundException("Order not found.");
    }

    if (!isAdmin && order.userId !== userId) {
      throw new NotFoundException("Order not found.");
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException("Only orders in PENDING status can be cancelled.");
    }

    await this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.order.updateMany({
        where: { id: orderId, status: OrderStatus.PENDING },
        data: {
          status: OrderStatus.CANCELLED,
          paymentStatus:
            order.paymentStatus === OrderPaymentStatus.PAID
              ? order.paymentStatus
              : OrderPaymentStatus.REJECTED
        }
      });
      if (cancelled.count !== 1) {
        throw new BadRequestException("Order is no longer eligible for cancellation.");
      }

      for (const item of order.items) {
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stockQty: { increment: item.quantity } }
          });
        } else {
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQty: { increment: item.quantity } }
          });
        }
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          status: OrderStatus.CANCELLED,
          note: note?.trim() || (isAdmin ? "Cancelled by admin" : "Cancelled by customer"),
          changedByUserId: userId
        }
      });

      // Mark any still-pending payment transactions as REJECTED for this order.
      await tx.paymentTransaction.updateMany({
        where: { orderId, status: "PENDING" },
        data: { status: "REJECTED" }
      });
    });

    const fresh = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: orderInclude
    });
    await this.invalidateInventoryProductCaches(
      order.items.map((item) => ({ id: item.productId, slug: item.product.slug }))
    );

    void this.notificationService.notifyOrderStatusChanged({
      orderId: fresh.id,
      userId: fresh.userId,
      status: fresh.status
    });

    return this.serializeOrder(fresh);
  }

  private async findCartWithItems(identity: OrderIdentity) {
    return this.prisma.cart.findFirst({
      where: identity.userId
        ? {
            userId: identity.userId
          }
        : {
            sessionId: this.requireSessionId(identity)
          },
      include: cartForOrderInclude
    });
  }

  private sumProductQuantities(cart: CartForOrder) {
    const totals = new Map<string, number>();
    for (const item of cart.items) {
      totals.set(item.productId, (totals.get(item.productId) ?? 0) + item.quantity);
    }
    return totals;
  }

  private async invalidateInventoryProductCaches(products: Array<{ id: string; slug: string }>) {
    const unique = new Map(products.map((product) => [product.id, product]));
    await Promise.all(
      [...unique.values()].map((product) =>
        this.productsService.invalidatePublicationCaches(product.id, product.slug)
      )
    );
  }

  private requireSessionId(identity: OrderIdentity) {
    if (!identity.sessionId?.trim()) {
      throw new BadRequestException("Session id is required for guest checkout.");
    }

    return identity.sessionId;
  }

  private async findOneForAccess({
    id,
    userId,
    isAdmin
  }: {
    id: string;
    userId: string | null;
    isAdmin: boolean;
  }) {
    const order = await this.prisma.order.findFirst({
      where: {
        id,
        ...(isAdmin ? {} : { userId })
      },
      include: orderInclude
    });

    if (!order) {
      throw new NotFoundException("Order not found.");
    }

    return this.serializeOrder(order);
  }

  private async resolveSavedAddress(userId: string | null, addressId?: string) {
    if (!addressId) {
      return null;
    }

    if (!userId) {
      throw new BadRequestException("Guests cannot use saved addresses.");
    }

    const address = await this.prisma.address.findFirst({
      where: {
        id: addressId,
        userId
      },
      select: {
        id: true
      }
    });

    if (!address) {
      throw new NotFoundException("Address not found.");
    }

    return address;
  }

  private serializeOrder(order: OrderWithRelations) {
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
                  role: order.user.role
                }
              : null
          }
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
        order.paymentMethod ??
        latestPayment?.paymentMethodCode ??
        latestPayment?.paymentMethod.code ??
        null,
      paymentMethod:
        order.paymentMethod === PaymentMethodCode.COD
          ? "Cash on Delivery"
          : order.paymentMethod === PaymentMethodCode.BANK_TRANSFER
            ? "Bank Transfer"
            : (latestPayment?.paymentMethod.name ?? null),
      paymentStatus: order.paymentStatus ?? latestPayment?.status ?? null,
      paymentReceipt: latestReceipt
        ? {
            id: latestReceipt.id,
            fileUrl: latestReceipt.fileUrl,
            reviewStatus: latestReceipt.reviewStatus,
            createdAt: latestReceipt.createdAt
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
        changedByUser: entry.changedByUser
      })),
      items: order.items.map((item: OrderWithRelations["items"][number]) => ({
        id: item.id,
        productId: item.productId,
        variantId: item.variantId ?? null,
        variantName: item.variantName ?? null,
        variantAttributes: item.variantAttributes ?? null,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        product: {
          id: item.product.id,
          name: item.productName || item.product.name,
          slug: item.product.slug,
          imageUrl: item.product.images[0]?.imageUrl ?? null
        }
      }))
    };
  }

  private async getMinimumOrderAmount() {
    const setting = await this.prisma.systemSetting.findUnique({
      where: {
        key: "min_order"
      },
      select: {
        value: true
      }
    });

    const value = Number(setting?.value || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  private async generateOrderNumber(userId: string | null): Promise<string> {
    let customerCode: string | null = null;

    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { customerCode: true }
      });
      customerCode = user?.customerCode ?? null;
    }

    const code = customerCode ?? "GUEST";

    const count = await this.prisma.order.count({
      where: userId ? { userId } : {}
    });

    const seq = String(count + 1).padStart(4, "0");
    return `ORD-${code}-${seq}`;
  }

  private async findManyWithQuery(baseWhere: Record<string, unknown>, query: FindOrdersQueryDto) {
    const where = {
      ...baseWhere,
      ...this.buildSearchWhere(query.q)
    };

    if (!this.shouldPaginate(query)) {
      const orders = await this.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: {
          createdAt: "desc"
        }
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
          createdAt: "desc"
        },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prisma.order.count({ where })
    ]);

    return {
      items: orders.map((order: OrderWithRelations) => this.serializeOrder(order)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
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
      (status) => status.toLowerCase() === normalizedQuery.toLowerCase()
    );

    const orConditions: Array<Record<string, unknown>> = [
      {
        fullName: {
          contains: normalizedQuery,
          mode: "insensitive" as const
        }
      },
      {
        phone: {
          contains: normalizedQuery,
          mode: "insensitive" as const
        }
      },
      {
        city: {
          contains: normalizedQuery,
          mode: "insensitive" as const
        }
      },
      {
        address: {
          contains: normalizedQuery,
          mode: "insensitive" as const
        }
      }
    ];

    if (isUuidLike(normalizedQuery)) {
      orConditions.unshift({
        id: normalizedQuery
      });
    }

    if (normalizedStatus) {
      orConditions.push({ status: normalizedStatus });
    }

    return {
      OR: orConditions
    };
  }
}
