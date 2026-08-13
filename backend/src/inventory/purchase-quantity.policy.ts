import { BadRequestException } from "@nestjs/common";

export const PURCHASE_QUANTITY_ERROR = {
  INVALID_QUANTITY: "INVALID_QUANTITY",
  OUT_OF_STOCK: "OUT_OF_STOCK",
  INSUFFICIENT_STOCK: "INSUFFICIENT_STOCK",
  MAX_PURCHASE_QUANTITY_EXCEEDED: "MAX_PURCHASE_QUANTITY_EXCEEDED",
  CART_STOCK_CHANGED: "CART_STOCK_CHANGED"
} as const;

export type PurchaseAvailabilityInput = {
  stockQty: number;
  maxPurchaseQty?: number | null;
  otherProductQuantity?: number;
};

export type PurchaseAvailability = {
  availableStock: number;
  maxPurchaseQty: number | null;
  effectiveMaxQuantity: number;
};

export function calculatePurchaseAvailability({
  stockQty,
  maxPurchaseQty,
  otherProductQuantity = 0
}: PurchaseAvailabilityInput): PurchaseAvailability {
  const availableStock = Math.max(0, Math.trunc(Number(stockQty) || 0));
  const configuredLimit =
    maxPurchaseQty == null ? null : Math.max(0, Math.trunc(Number(maxPurchaseQty) || 0));
  const remainingConfiguredLimit =
    configuredLimit == null
      ? availableStock
      : Math.max(0, configuredLimit - Math.max(0, Math.trunc(otherProductQuantity)));

  return {
    availableStock,
    maxPurchaseQty: configuredLimit,
    effectiveMaxQuantity: Math.max(0, Math.min(availableStock, remainingConfiguredLimit))
  };
}

export function assertPurchaseQuantity(
  quantity: number,
  input: PurchaseAvailabilityInput,
  options: { staleCart?: boolean } = {}
): PurchaseAvailability {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw quantityError(
      PURCHASE_QUANTITY_ERROR.INVALID_QUANTITY,
      "Quantity must be a positive integer."
    );
  }

  const availability = calculatePurchaseAvailability(input);
  if (availability.availableStock <= 0) {
    throw quantityError(
      options.staleCart
        ? PURCHASE_QUANTITY_ERROR.CART_STOCK_CHANGED
        : PURCHASE_QUANTITY_ERROR.OUT_OF_STOCK,
      "Product is out of stock.",
      availability
    );
  }

  const totalProductQuantity = quantity + Math.max(0, Math.trunc(input.otherProductQuantity ?? 0));
  if (availability.maxPurchaseQty != null && totalProductQuantity > availability.maxPurchaseQty) {
    throw quantityError(
      PURCHASE_QUANTITY_ERROR.MAX_PURCHASE_QUANTITY_EXCEEDED,
      `Maximum purchase quantity is ${availability.maxPurchaseQty}.`,
      availability
    );
  }

  if (quantity > availability.availableStock) {
    throw quantityError(
      options.staleCart
        ? PURCHASE_QUANTITY_ERROR.CART_STOCK_CHANGED
        : PURCHASE_QUANTITY_ERROR.INSUFFICIENT_STOCK,
      `Requested quantity is unavailable. Available now: ${availability.availableStock}.`,
      availability
    );
  }

  return availability;
}

function quantityError(errorCode: string, message: string, availability?: PurchaseAvailability) {
  return new BadRequestException({
    errorCode,
    message,
    ...(availability ?? {})
  });
}
