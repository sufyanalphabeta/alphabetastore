import { BadRequestException } from "@nestjs/common";

import { PURCHASE_QUANTITY_ERROR } from "../inventory/purchase-quantity.policy";
import { CartService } from "./cart.service";

const identity = { userId: "user-1", sessionId: null };
const productId = "9cebbd83-3ac9-49b1-b967-650a8a3d6caf";

function setup({
  stockQty = 10,
  maxPurchaseQty = null as number | null,
  existingQuantity = 2 as number | null,
  otherProductQuantity = 0,
  variantStockQty = null as number | null
} = {}) {
  const product = {
    id: productId,
    price: 10,
    baseCurrency: "LYD",
    exchangeRateOverride: null,
    comparePrice: null,
    discountType: "NONE",
    discountValue: null,
    discountStartAt: null,
    discountEndAt: null,
    stockQty,
    maxPurchaseQty,
    status: "ACTIVE",
    hasVariants: variantStockQty != null
  };
  const prisma = {
    cart: {
      findUnique: jest.fn().mockResolvedValue({ id: "cart-1" }),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({})
    },
    product: { findUnique: jest.fn().mockResolvedValue(product) },
    productVariant: {
      findFirst: jest.fn().mockResolvedValue(
        variantStockQty == null
          ? null
          : {
              id: "9cebbd83-3ac9-49b1-b967-650a8a3d6caa",
              name: "Variant",
              attributes: {},
              imageUrl: null,
              price: 10,
              comparePrice: null,
              stockQty: variantStockQty
            }
      )
    },
    cartItem: {
      findFirst: jest.fn().mockResolvedValue(existingQuantity == null ? null : {
          id: "item-1",
          cartId: "cart-1",
          productId,
          quantity: existingQuantity,
          product: { stockQty, maxPurchaseQty, status: "ACTIVE" },
          variant: variantStockQty == null ? null : { stockQty: variantStockQty }
        }),
      aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: otherProductQuantity } }),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({})
    }
  };
  const pricing = {
    getPricingSettings: jest.fn().mockResolvedValue({}),
    computePrice: jest.fn().mockReturnValue({ finalPrice: 52 })
  };
  const service = new CartService(prisma as never, pricing as never);
  jest.spyOn(service, "getCart").mockResolvedValue({ id: "cart-1" } as never);
  return { service, prisma, pricing };
}

function responseCode(error: unknown) {
  return ((error as BadRequestException).getResponse() as { errorCode: string }).errorCode;
}

describe("CartService inventory safety", () => {
  it("allows adding up to the configured product maximum", async () => {
    const { service, prisma } = setup({ maxPurchaseQty: 3, existingQuantity: 2 });
    await service.addItem(identity, { productId, quantity: 1 });
    expect(prisma.cartItem.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { quantity: 3 }
    });
  });

  it("rejects adding above the configured product maximum", async () => {
    const { service, prisma } = setup({ maxPurchaseQty: 3, existingQuantity: 2 });
    await expect(service.addItem(identity, { productId, quantity: 2 })).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: PURCHASE_QUANTITY_ERROR.MAX_PURCHASE_QUANTITY_EXCEEDED
      })
    });
    expect(prisma.cartItem.update).not.toHaveBeenCalled();
  });

  it("rejects adding above selected variant stock", async () => {
    const { service } = setup({ existingQuantity: 1, stockQty: 50, variantStockQty: 2 });
    try {
      await service.addItem(identity, {
        productId,
        variantId: "9cebbd83-3ac9-49b1-b967-650a8a3d6caa",
        quantity: 2
      });
      throw new Error("Expected stock rejection");
    } catch (error) {
      expect(responseCode(error)).toBe(PURCHASE_QUANTITY_ERROR.INSUFFICIENT_STOCK);
    }
  });

  it("applies maxPurchaseQty across variant lines", async () => {
    const { service } = setup({
      maxPurchaseQty: 3,
      existingQuantity: 1,
      otherProductQuantity: 2,
      variantStockQty: 10
    });
    await expect(
      service.addItem(identity, {
        productId,
        variantId: "9cebbd83-3ac9-49b1-b967-650a8a3d6caa",
        quantity: 1
      })
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: PURCHASE_QUANTITY_ERROR.MAX_PURCHASE_QUANTITY_EXCEEDED
      })
    });
  });

  it("uses the authoritative pricing engine for a new variant cart line", async () => {
    const { service, prisma, pricing } = setup({ existingQuantity: null, variantStockQty: 5 });

    await service.addItem(identity, {
      productId,
      variantId: "9cebbd83-3ac9-49b1-b967-650a8a3d6caa",
      quantity: 1
    });

    expect(pricing.computePrice).toHaveBeenCalledWith(
      expect.objectContaining({ price: 10, comparePrice: null }),
      expect.any(Object)
    );
    expect(prisma.cartItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ unitPrice: 52 })
    });
  });

  it("does not allow cart update to bypass stock", async () => {
    const { service, prisma } = setup({ stockQty: 2 });
    await expect(service.updateItem(identity, "item-1", { quantity: 3 })).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: PURCHASE_QUANTITY_ERROR.INSUFFICIENT_STOCK
      })
    });
    expect(prisma.cartItem.update).not.toHaveBeenCalled();
  });

  it("does not allow cart update to bypass the configured maximum", async () => {
    const { service } = setup({ stockQty: 20, maxPurchaseQty: 3 });
    await expect(service.updateItem(identity, "item-1", { quantity: 4 })).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: PURCHASE_QUANTITY_ERROR.MAX_PURCHASE_QUANTITY_EXCEEDED
      })
    });
  });
});
