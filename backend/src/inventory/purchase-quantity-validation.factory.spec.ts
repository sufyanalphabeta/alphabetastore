import { AddCartItemDto } from "../cart/dto/add-cart-item.dto";
import { PURCHASE_QUANTITY_ERROR } from "./purchase-quantity.policy";
import { purchaseAwareValidationException } from "./purchase-quantity-validation.factory";

describe("purchase-aware validation exception factory", () => {
  it("returns INVALID_QUANTITY for cart quantity validation failures", () => {
    const target = Object.assign(new AddCartItemDto(), { quantity: 0 });
    const exception = purchaseAwareValidationException([
      {
        target,
        property: "quantity",
        constraints: { min: "quantity must not be less than 1" },
        children: []
      }
    ]);
    expect(exception.getResponse()).toMatchObject({
      errorCode: PURCHASE_QUANTITY_ERROR.INVALID_QUANTITY
    });
  });

  it("preserves normal validation messages for unrelated DTO fields", () => {
    const exception = purchaseAwareValidationException([
      {
        target: {},
        property: "name",
        constraints: { isString: "name must be a string" },
        children: []
      }
    ]);
    expect(exception.getResponse()).toMatchObject({ message: ["name must be a string"] });
  });
});
