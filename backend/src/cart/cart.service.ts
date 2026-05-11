import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

type CartIdentity = {
  userId: string | null;
  sessionId: string | null;
};

const cartInclude = {
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
} satisfies Prisma.CartInclude;

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
  ) {}

  async getCart(identity: CartIdentity) {
    const cart = await this.findOrCreateCart(identity);
    return this.serializeCart(
      await this.prisma.cart.findUniqueOrThrow({
        where: { id: cart.id },
        include: cartInclude,
      }),
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
        comparePrice: true,
        discountType: true,
        discountValue: true,
        discountStartAt: true,
        discountEndAt: true,
        stockQty: true,
        status: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found.');
    }

    if (product.status !== 'ACTIVE') {
      throw new BadRequestException('Product is not available.');
    }

    const existingItem = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId: addCartItemDto.productId,
        },
      },
      select: {
        id: true,
        quantity: true,
      },
    });

    const nextQuantity = (existingItem?.quantity ?? 0) + addCartItemDto.quantity;

    if (nextQuantity > product.stockQty) {
      throw new BadRequestException(
        `Only ${product.stockQty} unit(s) available in stock.`,
      );
    }

    if (existingItem) {
      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: nextQuantity,
        },
      });
    } else {
      // Use the pricing engine for the effective price
      const computedPrice = await this.pricingService.computePrice(
        product,
        await this.pricingService.getPricingSettings(),
      );
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: addCartItemDto.productId,
          quantity: addCartItemDto.quantity,
          unitPrice: computedPrice.finalPrice,
        },
      });
    }

    await this.touchCart(cart.id);
    return this.getCart(identity);
  }

  async updateItem(
    identity: CartIdentity,
    itemId: string,
    updateCartItemDto: UpdateCartItemDto,
  ) {
    const cartItem = await this.findOwnedCartItem(identity, itemId);

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: {
        quantity: updateCartItemDto.quantity,
      },
    });

    await this.touchCart(cartItem.cartId);
    return this.getCart(identity);
  }

  async removeItem(identity: CartIdentity, itemId: string) {
    const cartItem = await this.findOwnedCartItem(identity, itemId);

    await this.prisma.cartItem.delete({
      where: { id: itemId },
    });

    await this.touchCart(cartItem.cartId);
    return this.getCart(identity);
  }

  async clearCart(identity: CartIdentity) {
    const cart = await this.findOrCreateCart(identity);

    await this.prisma.cartItem.deleteMany({
      where: {
        cartId: cart.id,
      },
    });

    await this.touchCart(cart.id);
    return this.getCart(identity);
  }

  private async findOrCreateCart(identity: CartIdentity) {
    const where = this.createOwnerWhere(identity);
    const existingCart = await this.prisma.cart.findUnique({
      where,
      select: {
        id: true,
      },
    });

    if (existingCart) {
      return existingCart;
    }

    return this.prisma.cart.create({
      data: identity.userId
        ? {
            userId: identity.userId,
          }
        : {
            sessionId: identity.sessionId!,
          },
      select: {
        id: true,
      },
    });
  }

  private async findOwnedCartItem(identity: CartIdentity, itemId: string) {
    const cartItem = await this.prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cart: identity.userId
          ? {
              userId: identity.userId,
            }
          : {
              sessionId: this.requireSessionId(identity),
            },
      },
      select: {
        id: true,
        cartId: true,
      },
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found.');
    }

    return cartItem;
  }

  private createOwnerWhere(identity: CartIdentity) {
    if (identity.userId) {
      return {
        userId: identity.userId,
      } satisfies Prisma.CartWhereUniqueInput;
    }

    return {
      sessionId: this.requireSessionId(identity),
    } satisfies Prisma.CartWhereUniqueInput;
  }

  private requireSessionId(identity: CartIdentity) {
    if (!identity.sessionId?.trim()) {
      throw new BadRequestException('Session id is required for guest cart access.');
    }

    return identity.sessionId;
  }

  private async touchCart(cartId: string) {
    await this.prisma.cart.update({
      where: { id: cartId },
      data: {
        updatedAt: new Date(),
      },
    });
  }

  private serializeCart(
    cart: Prisma.CartGetPayload<{
      include: typeof cartInclude;
    }>,
  ) {
    const items = cart.items.map(
      (
        item: Prisma.CartGetPayload<{
          include: typeof cartInclude;
        }>['items'][number],
      ) => {
      const unitPrice = Number(item.unitPrice);
      const total = unitPrice * item.quantity;

      return {
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        total,
        product: {
          id: item.product.id,
          name: item.product.name,
          slug: item.product.slug,
          imageUrl: item.product.images[0]?.imageUrl ?? null,
        },
      };
      },
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
        0,
      ),
      total: items.reduce(
        (sum: number, item: (typeof items)[number]) => sum + item.total,
        0,
      ),
      items,
    };
  }
}