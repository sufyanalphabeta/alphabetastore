import { BadRequestException } from "@nestjs/common";
import type { ValidationError } from "class-validator";

import { PURCHASE_QUANTITY_ERROR } from "./purchase-quantity.policy";

const CART_QUANTITY_DTOS = new Set(["AddCartItemDto", "UpdateCartItemDto"]);

export function purchaseAwareValidationException(errors: ValidationError[]) {
  const invalidCartQuantity = errors.some(
    (error) =>
      error.property === "quantity" && CART_QUANTITY_DTOS.has(error.target?.constructor?.name ?? "")
  );

  if (invalidCartQuantity) {
    return new BadRequestException({
      errorCode: PURCHASE_QUANTITY_ERROR.INVALID_QUANTITY,
      message: "Quantity must be a positive integer."
    });
  }

  return new BadRequestException(flattenValidationMessages(errors));
}

function flattenValidationMessages(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...flattenValidationMessages(error.children ?? [])
  ]);
}
