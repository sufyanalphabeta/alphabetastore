import { BadRequestException } from "@nestjs/common";

import {
  assertPurchaseQuantity,
  calculatePurchaseAvailability,
  PURCHASE_QUANTITY_ERROR
} from "./purchase-quantity.policy";

function errorCode(error: unknown) {
  return (error as BadRequestException).getResponse() as { errorCode: string };
}

describe("purchase quantity policy", () => {
  it.each([0, -1, 1.5])("rejects invalid quantity %s", (quantity) => {
    try {
      assertPurchaseQuantity(quantity, { stockQty: 10 });
      throw new Error("Expected quantity rejection");
    } catch (error) {
      expect(errorCode(error).errorCode).toBe(PURCHASE_QUANTITY_ERROR.INVALID_QUANTITY);
    }
  });

  it.each([
    [1, 1],
    [2, 2],
    [5, 5]
  ])("accepts quantity %s when stock is %s", (quantity, stockQty) => {
    expect(assertPurchaseQuantity(quantity, { stockQty })).toMatchObject({
      availableStock: stockQty,
      effectiveMaxQuantity: stockQty
    });
  });

  it("rejects an out-of-stock product", () => {
    expect(() => assertPurchaseQuantity(1, { stockQty: 0 })).toThrow(BadRequestException);
    try {
      assertPurchaseQuantity(1, { stockQty: 0 });
    } catch (error) {
      expect(errorCode(error).errorCode).toBe(PURCHASE_QUANTITY_ERROR.OUT_OF_STOCK);
    }
  });

  it("rejects quantity above available stock", () => {
    try {
      assertPurchaseQuantity(3, { stockQty: 2 });
    } catch (error) {
      expect(errorCode(error).errorCode).toBe(PURCHASE_QUANTITY_ERROR.INSUFFICIENT_STOCK);
    }
  });

  it("enforces the configured product maximum", () => {
    expect(assertPurchaseQuantity(3, { stockQty: 20, maxPurchaseQty: 3 })).toMatchObject({
      maxPurchaseQty: 3,
      effectiveMaxQuantity: 3
    });
    try {
      assertPurchaseQuantity(4, { stockQty: 20, maxPurchaseQty: 3 });
    } catch (error) {
      expect(errorCode(error).errorCode).toBe(
        PURCHASE_QUANTITY_ERROR.MAX_PURCHASE_QUANTITY_EXCEEDED
      );
    }
  });

  it("applies a product maximum across multiple variant lines", () => {
    const availability = calculatePurchaseAvailability({
      stockQty: 10,
      maxPurchaseQty: 3,
      otherProductQuantity: 2
    });
    expect(availability.effectiveMaxQuantity).toBe(1);
    expect(() =>
      assertPurchaseQuantity(2, {
        stockQty: 10,
        maxPurchaseQty: 3,
        otherProductQuantity: 2
      })
    ).toThrow(BadRequestException);
  });

  it("uses the stale-cart error contract during checkout", () => {
    try {
      assertPurchaseQuantity(2, { stockQty: 1 }, { staleCart: true });
    } catch (error) {
      expect(errorCode(error).errorCode).toBe(PURCHASE_QUANTITY_ERROR.CART_STOCK_CHANGED);
    }
  });
});
