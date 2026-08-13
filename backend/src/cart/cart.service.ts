import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { PricingService } from "../pricing/pricing.service";
import { resolveProductCardImage } from "../media/product-gallery.mapper";
import { AddCartItemDto } from "./dto/add-cart-item.dto";
import { UpdateCartItemDto } from "./dto/update-cart-item.dto";
import {
  assertPurchaseQuantity,
  calculatePurchaseAvailability
} from "../inventory/purchase-quantity.policy";

type CartIdentity = {
  userId: string | null;
  sessionId: string | null;
};

const cartInclude = {
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
          images: {
            orderBy: {
              sortOrder: "asc"
            },
            select: {
              id: true,
              imageUrl: true,
              sortOrder: true
            }
          },
          media: {
            orderBy: {
              sortOrder: "asc"
            },
            select: {
              id: true,
              mediaAssetId: true,
              role: true,
              sortOrder: true,
              mediaAsset: {
                select: {
                  altText: true,
                  variants: true
                }
              }
            }
          }
        }
      },
      variant: {
        select: {
          id: true,
          name: true,
          attributes: true,
          imageUrl: true,
          stockQty: true
        }
      }
    }
  }
} satisfies Prisma.CartInclude;

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService
  ) {}

  async getCart(identity: CartIdentity) {
    const cart = await this.findOrCreateCart(identity);
    return this.serializeCart(
      await this.prisma.cart.findUniqueOrThrow({
        where: { id: cart.id },
        include: cartInclude
      })
    );
  }

  async addItem(identity: CartIdentity, addCartItemDto: AddCartItemDto) {
    const cart = await this.findOrCreateCart(identity);
    const product = await this.prisma.product.findUnique({
      where: { id: addCartItemDto.productId },
      select: {
        id: true,
        price: true,
        baseCurrency: true,
        exchangeRateOverride: true,
        comparePrice: true,
        discountType: true,
        discountValue: true,
        discountStartAt: true,
        discountEndAt: true,
        stockQty: true,
        maxPurchaseQty: true,
        status: true,
        hasVariants: true
      }
    });

    if (!product) {
      throw new NotFoundException("Product not found.");
    }

    if (product.status !== "ACTIVE") {
      throw new BadRequestException("Product is not available.");
    }

    if (product.hasVariants && !addCartItemDto.variantId) {
      throw new BadRequestException({
        errorCode: "PRODUCT_VARIANT_REQUIRED",
        message: "Select a product variant before adding it to the cart."
      });
    }

    // Variant validation: if the product has variants, a variantId is required.
    let variantSnapshot: {
      id: string;
      name: string | null;
      attributes: unknown;
      imageUrl: string | null;
      price: unknown;
      stockQty: number;
    } | null = null;

    if (addCartItemDto.variantId) {
      const variant = await this.prisma.productVariant.findFirst({
        where: {
          id: addCartItemDto.variantId,
          productId: addCartItemDto.productId
        },
        select: {
          id: true,
          name: true,
          attributes: true,
          imageUrl: true,
          price: true,
          stockQty: true
        }
      });

      if (!variant) {
        throw new NotFoundException("Variant not found for this product.");
      }

      variantSnapshot = variant;
    }

    // Determine effective stock for the quantity check
    const effectiveStockQty = variantSnapshot ? variantSnapshot.stockQty : product.stockQty;

    const existingItem = await this.prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId: addCartItemDto.productId,
        variantId: addCartItemDto.variantId ?? null
      },
      select: {
        id: true,
        quantity: true
      }
    });

    const nextQuantity = (existingItem?.quantity ?? 0) + addCartItemDto.quantity;
    const otherProductQuantity = await this.sumOtherProductQuantity(
      cart.id,
      product.id,
      existingItem?.id
    );
    assertPurchaseQuantity(nextQuantity, {
      stockQty: effectiveStockQty,
      maxPurchaseQty: product.maxPurchaseQty,
      otherProductQuantity
    });

    if (existingItem) {
      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: nextQuantity
        }
      });
    } else {
      // Use variant price when provided, otherwise compute from pricing engine.
      let unitPrice: number;
      if (variantSnapshot) {
        unitPrice = Number(variantSnapshot.price);
      } else {
        const computedPrice = await this.pricingService.computePrice(
          product,
          await this.pricingService.getPricingSettings()
        );
        unitPrice = Number(computedPrice.finalPrice);
      }

      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: addCartItemDto.productId,
          variantId: addCartItemDto.variantId ?? null,
          variantName: variantSnapshot?.name ?? null,
          variantAttributes: variantSnapshot?.attributes
            ? (variantSnapshot.attributes as Prisma.InputJsonValue)
            : undefined,
          quantity: addCartItemDto.quantity,
          unitPrice
        }
      });
    }

    await this.touchCart(cart.id);
    return this.getCart(identity);
  }

  async updateItem(identity: CartIdentity, itemId: string, updateCartItemDto: UpdateCartItemDto) {
    const cartItem = await this.findOwnedPurchasableCartItem(identity, itemId);
    const availableStock = cartItem.variant?.stockQty ?? cartItem.product.stockQty;
    const otherProductQuantity = await this.sumOtherProductQuantity(
      cartItem.cartId,
      cartItem.productId,
      cartItem.id
    );
    assertPurchaseQuantity(updateCartItemDto.quantity, {
      stockQty:
        cartItem.product.status === "ACTIVE" && (!cartItem.product.hasVariants || cartItem.variant)
          ? availableStock
          : 0,
      maxPurchaseQty: cartItem.product.maxPurchaseQty,
      otherProductQuantity
    });

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: {
        quantity: updateCartItemDto.quantity
      }
    });

    await this.touchCart(cartItem.cartId);
    return this.getCart(identity);
  }

  async removeItem(identity: CartIdentity, itemId: string) {
    const cartItem = await this.findOwnedCartItem(identity, itemId);

    await this.prisma.cartItem.delete({
      where: { id: itemId }
    });

    await this.touchCart(cartItem.cartId);
    return this.getCart(identity);
  }

  async clearCart(identity: CartIdentity) {
    const cart = await this.findOrCreateCart(identity);

    await this.prisma.cartItem.deleteMany({
      where: {
        cartId: cart.id
      }
    });

    await this.touchCart(cart.id);
    return this.getCart(identity);
  }

  /**
   * Move guest cart items into the authenticated user's cart and delete the guest cart.
   * Quantities for the same product are summed and capped to product.stockQty.
   */
  async mergeGuestCart(userId: string, sessionId: string): Promise<void> {
    if (!userId || !sessionId?.trim()) {
      return;
    }

    const guestCart = await this.prisma.cart.findUnique({
      where: { sessionId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                stockQty: true,
                maxPurchaseQty: true,
                status: true,
                hasVariants: true
              }
            },
            variant: { select: { id: true, stockQty: true } }
          }
        }
      }
    });

    if (!guestCart || guestCart.items.length === 0) {
      // Nothing to merge; clean up an empty guest cart if it exists.
      if (guestCart) {
        await this.prisma.cart.delete({ where: { id: guestCart.id } }).catch(() => undefined);
      }
      return;
    }

    const userCart = await this.prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
      select: { id: true }
    });

    await this.prisma.$transaction(async (tx) => {
      for (const guestItem of guestCart.items) {
        if (
          !guestItem.product ||
          guestItem.product.status !== "ACTIVE" ||
          (guestItem.product.hasVariants && !guestItem.variant)
        ) {
          continue;
        }

        const existing = await tx.cartItem.findFirst({
          where: {
            cartId: userCart.id,
            productId: guestItem.productId,
            variantId: guestItem.variantId ?? null
          },
          select: { id: true, quantity: true }
        });

        const desired = (existing?.quantity ?? 0) + guestItem.quantity;
        const otherItems = await tx.cartItem.findMany({
          where: {
            cartId: userCart.id,
            productId: guestItem.productId,
            ...(existing ? { id: { not: existing.id } } : {})
          },
          select: { quantity: true }
        });
        const availability = calculatePurchaseAvailability({
          stockQty: guestItem.variant?.stockQty ?? guestItem.product.stockQty,
          maxPurchaseQty: guestItem.product.maxPurchaseQty,
          otherProductQuantity: otherItems.reduce((sum, item) => sum + item.quantity, 0)
        });
        const capped = Math.min(desired, availability.effectiveMaxQuantity);
        if (capped <= 0) continue;

        if (existing) {
          await tx.cartItem.update({
            where: { id: existing.id },
            data: { quantity: capped }
          });
        } else {
          await tx.cartItem.create({
            data: {
              cartId: userCart.id,
              productId: guestItem.productId,
              variantId: guestItem.variantId ?? null,
              variantName: guestItem.variantName ?? null,
              variantAttributes: guestItem.variantAttributes
                ? (guestItem.variantAttributes as Prisma.InputJsonValue)
                : undefined,
              quantity: capped,
              unitPrice: guestItem.unitPrice
            }
          });
        }
      }

      await tx.cartItem.deleteMany({ where: { cartId: guestCart.id } });
      await tx.cart.delete({ where: { id: guestCart.id } });
      await tx.cart.update({
        where: { id: userCart.id },
        data: { updatedAt: new Date() }
      });
    });
  }

  private async findOrCreateCart(identity: CartIdentity) {
    const where = this.createOwnerWhere(identity);
    const existingCart = await this.prisma.cart.findUnique({
      where,
      select: {
        id: true
      }
    });

    if (existingCart) {
      return existingCart;
    }

    return this.prisma.cart.create({
      data: identity.userId
        ? {
            userId: identity.userId
          }
        : {
            sessionId: identity.sessionId!
          },
      select: {
        id: true
      }
    });
  }

  private async findOwnedCartItem(identity: CartIdentity, itemId: string) {
    const cartItem = await this.prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cart: identity.userId
          ? {
              userId: identity.userId
            }
          : {
              sessionId: this.requireSessionId(identity)
            }
      },
      select: {
        id: true,
        cartId: true
      }
    });

    if (!cartItem) {
      throw new NotFoundException("Cart item not found.");
    }

    return cartItem;
  }

  private async findOwnedPurchasableCartItem(identity: CartIdentity, itemId: string) {
    const cartItem = await this.prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cart: identity.userId
          ? { userId: identity.userId }
          : { sessionId: this.requireSessionId(identity) }
      },
      include: {
        product: {
          select: {
            stockQty: true,
            maxPurchaseQty: true,
            status: true,
            hasVariants: true
          }
        },
        variant: { select: { stockQty: true } }
      }
    });
    if (!cartItem) throw new NotFoundException("Cart item not found.");
    return cartItem;
  }

  private async sumOtherProductQuantity(cartId: string, productId: string, excludeItemId?: string) {
    const result = await this.prisma.cartItem.aggregate({
      where: {
        cartId,
        productId,
        ...(excludeItemId ? { id: { not: excludeItemId } } : {})
      },
      _sum: { quantity: true }
    });
    return result._sum.quantity ?? 0;
  }

  private createOwnerWhere(identity: CartIdentity) {
    if (identity.userId) {
      return {
        userId: identity.userId
      } satisfies Prisma.CartWhereUniqueInput;
    }

    return {
      sessionId: this.requireSessionId(identity)
    } satisfies Prisma.CartWhereUniqueInput;
  }

  private requireSessionId(identity: CartIdentity) {
    if (!identity.sessionId?.trim()) {
      throw new BadRequestException("Session id is required for guest cart access.");
    }

    return identity.sessionId;
  }

  private async touchCart(cartId: string) {
    await this.prisma.cart.update({
      where: { id: cartId },
      data: {
        updatedAt: new Date()
      }
    });
  }

  private serializeCart(
    cart: Prisma.CartGetPayload<{
      include: typeof cartInclude;
    }>
  ) {
    const items = cart.items.map(
      (
        item: Prisma.CartGetPayload<{
          include: typeof cartInclude;
        }>["items"][number]
      ) => {
        const unitPrice = Number(item.unitPrice);
        const total = unitPrice * item.quantity;
        const otherProductQuantity = cart.items
          .filter((other) => other.id !== item.id && other.productId === item.productId)
          .reduce((sum, other) => sum + other.quantity, 0);
        const availability = calculatePurchaseAvailability({
          stockQty:
            item.product.status === "ACTIVE" && (!item.product.hasVariants || item.variant)
              ? (item.variant?.stockQty ?? item.product.stockQty)
              : 0,
          maxPurchaseQty: item.product.maxPurchaseQty,
          otherProductQuantity
        });

        return {
          id: item.id,
          productId: item.productId,
          variantId: item.variantId ?? null,
          variantName: item.variantName ?? null,
          variantAttributes: item.variantAttributes ?? null,
          quantity: item.quantity,
          unitPrice,
          total,
          ...availability,
          availabilityChanged: item.quantity > availability.effectiveMaxQuantity,
          product: {
            id: item.product.id,
            name: item.product.name,
            slug: item.product.slug,
            imageUrl: item.variant?.imageUrl ?? resolveProductCardImage(item.product) ?? null
          }
        };
      }
    );

    return {
      id: cart.id,
      userId: cart.userId,
      sessionId: cart.sessionId,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
      itemCount: items.length,
      quantityCount: items.reduce(
        (sum: number, item: (typeof items)[number]) => sum + item.quantity,
        0
      ),
      total: items.reduce((sum: number, item: (typeof items)[number]) => sum + item.total, 0),
      items
    };
  }
}
