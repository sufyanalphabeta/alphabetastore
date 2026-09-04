import { BadRequestException } from "@nestjs/common";

import { PURCHASE_QUANTITY_ERROR } from "../inventory/purchase-quantity.policy";
import { OrderPaymentStatus, OrderStatus } from "../prisma/prisma-client";
import { OrdersService } from "./orders.service";

const identity = { userId: "user-1", sessionId: null };
const orderDto = {
  fullName: "Inventory Tester",
  phone: "+218911111111",
  city: "طرابلس",
  address: "Tripoli test address"
};

function cart(quantity = 1, overrides: Record<string, unknown> = {}) {
  return {
    id: "cart-1",
    items: [
      {
        id: "cart-item-1",
        productId: "product-1",
        variantId: null,
        variantName: null,
        variantAttributes: null,
        quantity,
        unitPrice: 10,
        product: {
          id: "product-1",
          name: "Inventory product",
          slug: "inventory-product",
          stockQty: 10,
          maxPurchaseQty: null,
          status: "ACTIVE",
          baseCurrency: "LYD",
          comparePrice: null,
          discountType: "NONE",
          discountValue: null,
          discountStartAt: null,
          discountEndAt: null,
          ...overrides
        },
        variant: null
      }
    ]
  };
}

function createOrderService(
  options: {
    carts?: Array<ReturnType<typeof cart>>;
    stock?: { value: number };
    currentMax?: number | null;
  } = {}
) {
  const carts = options.carts ?? [cart()];
  const stock = options.stock ?? { value: 10 };
  let cartIndex = 0;
  let orderIndex = 0;
  const tx = {
    product: {
      findMany: jest.fn().mockImplementation(async () => [
        {
          id: "product-1",
          status: "ACTIVE",
          maxPurchaseQty: options.currentMax ?? null
        }
      ]),
      updateMany: jest.fn().mockImplementation(async ({ where, data }) => {
        const requested = Number(where.stockQty.gte);
        if (stock.value < requested) return { count: 0 };
        stock.value -= Number(data.stockQty.decrement);
        return { count: 1 };
      })
    },
    productVariant: { updateMany: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([{ sequence: 1 }]),
    order: {
      create: jest.fn().mockImplementation(async ({ data }) => ({
        id: `order-${++orderIndex}`,
        userId: identity.userId,
        totalAmount: data.totalAmount
      }))
    },
    cartItem: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    cart: { update: jest.fn().mockResolvedValue({}) }
  };
  const prisma = {
    cart: {
      findFirst: jest
        .fn()
        .mockImplementation(async () => carts[Math.min(cartIndex++, carts.length - 1)])
    },
    order: {
      findUnique: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0)
    },
    systemSetting: { findUnique: jest.fn().mockResolvedValue(null) },
    user: { findUnique: jest.fn().mockResolvedValue({ customerCode: "TEST" }) },
    $transaction: jest.fn().mockImplementation(async (callback) => callback(tx))
  };
  const notifications = { notifyOrderPlaced: jest.fn(), notifyOrderStatusChanged: jest.fn() };
  const pricing = { getPricingSettings: jest.fn().mockResolvedValue({ exchangeRate: 1 }) };
  const products = { invalidatePublicationCaches: jest.fn().mockResolvedValue(undefined) };
  const service = new OrdersService(
    prisma as never,
    notifications as never,
    pricing as never,
    products as never
  );
  jest.spyOn(service as never, "serializeOrder" as never).mockImplementation((value) => value);
  return { service, prisma, tx, stock, products };
}

describe("OrdersService inventory safety", () => {
  it("rejects a stale cart before checkout", async () => {
    const { service, tx } = createOrderService({ carts: [cart(3, { stockQty: 2 })] });
    await expect(service.createOrder(identity, orderDto)).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: PURCHASE_QUANTITY_ERROR.CART_STOCK_CHANGED })
    });
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it("rechecks maxPurchaseQty inside the checkout transaction", async () => {
    const { service, tx } = createOrderService({
      carts: [cart(3, { stockQty: 10, maxPurchaseQty: 4 })],
      currentMax: 2
    });
    await expect(service.createOrder(identity, orderDto)).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: PURCHASE_QUANTITY_ERROR.MAX_PURCHASE_QUANTITY_EXCEEDED
      })
    });
    expect(tx.product.updateMany).not.toHaveBeenCalled();
  });

  it("allows only one concurrent checkout to consume the last unit", async () => {
    const sharedStock = { value: 1 };
    const { service, tx } = createOrderService({
      carts: [cart(1), cart(1)],
      stock: sharedStock
    });
    const results = await Promise.allSettled([
      service.createOrder(identity, orderDto),
      service.createOrder(identity, orderDto)
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(sharedStock.value).toBe(0);
    expect(tx.order.create).toHaveBeenCalledTimes(1);
  });

  it("invalidates public product caches after stock changes", async () => {
    const { service, products } = createOrderService();
    await service.createOrder(identity, orderDto);
    expect(products.invalidatePublicationCaches).toHaveBeenCalledWith(
      "product-1",
      "inventory-product"
    );
  });
});

function cancellationService({ variantId = null as string | null, alreadyCancelled = false } = {}) {
  const stock = { product: 0, variant: 0 };
  let cancelled = alreadyCancelled;
  const order = {
    id: "order-1",
    userId: "user-1",
    status: OrderStatus.PENDING,
    paymentStatus: OrderPaymentStatus.PENDING,
    items: [
      {
        productId: "product-1",
        variantId,
        quantity: 2,
        product: { slug: "inventory-product" }
      }
    ]
  };
  const tx = {
    order: {
      updateMany: jest.fn().mockImplementation(async () => {
        if (cancelled) return { count: 0 };
        cancelled = true;
        return { count: 1 };
      })
    },
    product: {
      update: jest.fn().mockImplementation(async ({ data }) => {
        stock.product += data.stockQty.increment;
      })
    },
    productVariant: {
      update: jest.fn().mockImplementation(async ({ data }) => {
        stock.variant += data.stockQty.increment;
      })
    },
    orderStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    paymentTransaction: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) }
  };
  const prisma = {
    order: {
      findUnique: jest.fn().mockResolvedValue(order),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: "order-1",
        userId: "user-1",
        status: OrderStatus.CANCELLED
      })
    },
    $transaction: jest.fn().mockImplementation(async (callback) => callback(tx))
  };
  const notifications = { notifyOrderPlaced: jest.fn(), notifyOrderStatusChanged: jest.fn() };
  const products = { invalidatePublicationCaches: jest.fn().mockResolvedValue(undefined) };
  const service = new OrdersService(
    prisma as never,
    notifications as never,
    {} as never,
    products as never
  );
  jest.spyOn(service as never, "serializeOrder" as never).mockImplementation((value) => value);
  return { service, tx, stock };
}

describe("OrdersService cancellation inventory restoration", () => {
  it("restores Product stock for a non-variant line", async () => {
    const { service, stock, tx } = cancellationService();
    await service.cancelOrder("order-1", "user-1", false);
    expect(stock.product).toBe(2);
    expect(stock.variant).toBe(0);
    expect(tx.productVariant.update).not.toHaveBeenCalled();
  });

  it("restores ProductVariant stock for a variant line", async () => {
    const { service, stock, tx } = cancellationService({ variantId: "variant-1" });
    await service.cancelOrder("order-1", "user-1", false);
    expect(stock.variant).toBe(2);
    expect(stock.product).toBe(0);
    expect(tx.product.update).not.toHaveBeenCalled();
  });

  it("does not restore stock twice when cancellation races", async () => {
    const { service, stock } = cancellationService();
    const results = await Promise.allSettled([
      service.cancelOrder("order-1", "user-1", false),
      service.cancelOrder("order-1", "user-1", false)
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(stock.product).toBe(2);
  });

  it("blocks generic status updates from bypassing cancellation restoration", async () => {
    const { service } = cancellationService();
    await expect(
      service.updateStatus("order-1", "admin-1", {
        status: OrderStatus.CANCELLED
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
