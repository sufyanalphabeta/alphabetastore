import { validate } from "class-validator";

import { AddCartItemDto } from "../cart/dto/add-cart-item.dto";
import { UpdateCartItemDto } from "../cart/dto/update-cart-item.dto";
import { UpdateProductDto } from "../products/dto/update-product.dto";

async function quantityErrors(target: object) {
  return (await validate(target)).flatMap((error) => Object.keys(error.constraints ?? {}));
}

describe("purchase quantity DTO validation", () => {
  it.each([0, -1, 1.5])("rejects cart add quantity %s", async (quantity) => {
    const dto = Object.assign(new AddCartItemDto(), {
      productId: "9cebbd83-3ac9-49b1-b967-650a8a3d6caf",
      quantity
    });
    expect(await quantityErrors(dto)).not.toHaveLength(0);
  });

  it("accepts cart add quantity 1", async () => {
    const dto = Object.assign(new AddCartItemDto(), {
      productId: "9cebbd83-3ac9-49b1-b967-650a8a3d6caf",
      quantity: 1
    });
    expect(await quantityErrors(dto)).toHaveLength(0);
  });

  it.each([0, -1, 1.5])("rejects cart update quantity %s", async (quantity) => {
    const dto = Object.assign(new UpdateCartItemDto(), { quantity });
    expect(await quantityErrors(dto)).not.toHaveLength(0);
  });

  it.each([0, -1, 1.5])("rejects product maxPurchaseQty %s", async (maxPurchaseQty) => {
    const dto = Object.assign(new UpdateProductDto(), { maxPurchaseQty });
    expect(await quantityErrors(dto)).not.toHaveLength(0);
  });

  it.each([undefined, null, 1, 25])(
    "accepts optional product maxPurchaseQty %s",
    async (maxPurchaseQty) => {
      const dto = Object.assign(new UpdateProductDto(), { maxPurchaseQty });
      expect(await quantityErrors(dto)).toHaveLength(0);
    }
  );
});
