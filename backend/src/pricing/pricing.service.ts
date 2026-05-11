import { Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

import { BaseCurrency, DiscountType } from '../prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { BulkPriceUpdateDto } from './dto/bulk-price-update.dto';
import { GetPriceHistoryQueryDto } from './dto/get-price-history-query.dto';

export interface ComputedPrice {
  /** Final price the customer pays (in store default currency) */
  finalPrice: Decimal;
  /** Original base price before discount (in store default currency) */
  displayBasePrice: Decimal;
  /** Compare price / original price for strikethrough (in store default currency) */
  comparePrice: Decimal | null;
  /** Whether an active discount is applied right now */
  hasActiveDiscount: boolean;
  /** Discount percentage shown on badge (0 if none) */
  discountPercent: number;
  /** Amount saved (0 if no discount) */
  savings: Decimal;
  /** Exchange rate actually used (1 if no conversion) */
  exchangeRateUsed: Decimal;
  /** Currency in which this price is expressed */
  currency: string;
}

export interface PricingSettings {
  exchangeRate: Decimal;
  defaultCurrency: string;
  autoRound: boolean;
}

type ProductPricingFields = {
  price: Decimal;
  baseCurrency: BaseCurrency;
  comparePrice: Decimal | null;
  discountType: DiscountType | null;
  discountValue: Decimal | null;
  discountStartAt: Date | null;
  discountEndAt: Date | null;
};

const SETTINGS_KEYS = [
  'exchange_rate_usd_to_lyd',
  'default_currency',
  'auto_round_prices',
] as const;

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Settings ────────────────────────────────────────────────────────────────

  async getPricingSettings(): Promise<PricingSettings> {
    const rows = await this.prisma.systemSetting.findMany({
      where: { key: { in: [...SETTINGS_KEYS] } },
      select: { key: true, value: true },
    });

    const map: Record<string, string> = {
      exchange_rate_usd_to_lyd: '5.2',
      default_currency: 'LYD',
      auto_round_prices: 'false',
    };

    for (const row of rows as Array<{ key: string; value: string }>) {
      map[row.key] = row.value;
    }

    const rawRate = map['exchange_rate_usd_to_lyd'];
    let rate: Decimal;
    try {
      rate = new Decimal(rawRate);
    } catch {
      rate = new Decimal('5.2');
    }

    return {
      exchangeRate: rate.isFinite() && rate.gt(0) ? rate : new Decimal('5.2'),
      defaultCurrency: map['default_currency'] === 'USD' ? 'USD' : 'LYD',
      autoRound: map['auto_round_prices'] === 'true',
    };
  }

  // ─── Core Price Calculation ────────────────────────────────────────────────

  /**
   * Compute the storefront price for a product.
   *
   * Rules:
   * - If product.baseCurrency === USD and storeCurrency === LYD  → multiply by exchangeRate
   * - If product.baseCurrency === LYD and storeCurrency === LYD  → no conversion
   * - If product.baseCurrency === LYD and storeCurrency === USD  → divide by exchangeRate
   * - If product.baseCurrency === USD and storeCurrency === USD  → no conversion
   * - Discounts are always calculated on the converted price
   * - Price is never stored overwritten; original base_price is always preserved
   */
  computePrice(
    product: ProductPricingFields,
    settings: PricingSettings,
  ): ComputedPrice {
    const { exchangeRate, defaultCurrency, autoRound } = settings;

    // Step 1: Convert base price to display currency
    const baseInStore = this.convertToStoreCurrency(
      product.price,
      product.baseCurrency,
      defaultCurrency,
      exchangeRate,
    );

    // Step 2: Convert compare price if present
    const comparePriceInStore = product.comparePrice
      ? this.convertToStoreCurrency(
          product.comparePrice,
          product.baseCurrency,
          defaultCurrency,
          exchangeRate,
        )
      : null;

    // Step 3: Check if discount is active
    const now = new Date();
    const discountActive =
      product.discountType !== null &&
      product.discountValue !== null &&
      product.discountValue.gt(0) &&
      (product.discountStartAt === null || product.discountStartAt <= now) &&
      (product.discountEndAt === null || product.discountEndAt > now);

    // Step 4: Compute final price after discount
    let finalPrice = baseInStore;
    let discountPercent = 0;
    let savings = new Decimal(0);

    if (discountActive && product.discountValue) {
      if (product.discountType === DiscountType.PERCENTAGE) {
        const pct = product.discountValue.clamp(0, 100);
        savings = baseInStore.mul(pct).div(100);
        finalPrice = baseInStore.sub(savings);
        discountPercent = pct.toNumber();
      } else {
        // FIXED — discount_value is in the product's base currency, convert it
        const discountInStore = this.convertToStoreCurrency(
          product.discountValue,
          product.baseCurrency,
          defaultCurrency,
          exchangeRate,
        );
        savings = Decimal.min(discountInStore, baseInStore);
        finalPrice = baseInStore.sub(savings);
        discountPercent = savings.div(baseInStore).mul(100).toDecimalPlaces(1).toNumber();
      }
    }

    // Step 5: Apply rounding
    finalPrice = this.applyRounding(finalPrice, autoRound);
    const displayBasePrice = this.applyRounding(baseInStore, autoRound);
    const roundedComparePrice = comparePriceInStore
      ? this.applyRounding(comparePriceInStore, autoRound)
      : null;

    // Recalculate savings after rounding for display accuracy
    const roundedSavings = displayBasePrice.sub(finalPrice);

    // Determine which exchange rate was actually used
    const exchangeRateUsed =
      product.baseCurrency !== defaultCurrency ? exchangeRate : new Decimal(1);

    return {
      finalPrice,
      displayBasePrice,
      comparePrice: roundedComparePrice,
      hasActiveDiscount: discountActive,
      discountPercent,
      savings: roundedSavings.lt(0) ? new Decimal(0) : roundedSavings,
      exchangeRateUsed,
      currency: defaultCurrency,
    };
  }

  /**
   * Convert an amount from its source currency to the store's display currency.
   * All arithmetic uses Decimal to avoid floating-point errors.
   */
  convertToStoreCurrency(
    amount: Decimal,
    fromCurrency: string,
    toCurrency: string,
    exchangeRate: Decimal,
  ): Decimal {
    if (fromCurrency === toCurrency) return amount;

    if (fromCurrency === 'USD' && toCurrency === 'LYD') {
      return amount.mul(exchangeRate);
    }

    if (fromCurrency === 'LYD' && toCurrency === 'USD') {
      return exchangeRate.gt(0) ? amount.div(exchangeRate) : amount;
    }

    return amount;
  }

  /**
   * Apply commercial rounding rules:
   *  - Values ending in .1-.4 → round down
   *  - Values ending in .5-.9 → round up
   *  This gives whole numbers suitable for LYD pricing.
   */
  applyRounding(amount: Decimal, autoRound: boolean): Decimal {
    if (!autoRound) return amount.toDecimalPlaces(2);
    return amount.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  }

  // ─── Product-Level Helpers ────────────────────────────────────────────────

  async computePriceForProduct(
    productId: string,
    settings?: PricingSettings,
  ): Promise<ComputedPrice> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        price: true,
        baseCurrency: true,
        comparePrice: true,
        discountType: true,
        discountValue: true,
        discountStartAt: true,
        discountEndAt: true,
      },
    });

    if (!product) throw new NotFoundException('Product not found.');

    const resolvedSettings = settings ?? (await this.getPricingSettings());
    return this.computePrice(product, resolvedSettings);
  }

  // ─── Price History ────────────────────────────────────────────────────────

  async recordPriceHistory(params: {
    productId: string;
    oldBasePrice: Decimal;
    newBasePrice: Decimal;
    oldComparePrice: Decimal | null;
    newComparePrice: Decimal | null;
    oldCurrency: BaseCurrency;
    newCurrency: BaseCurrency;
    exchangeRateUsed: Decimal;
    changeReason?: string;
    changedByUserId?: string | null;
  }) {
    return this.prisma.priceHistory.create({
      data: {
        productId: params.productId,
        oldBasePrice: params.oldBasePrice,
        newBasePrice: params.newBasePrice,
        oldComparePrice: params.oldComparePrice,
        newComparePrice: params.newComparePrice,
        oldCurrency: params.oldCurrency,
        newCurrency: params.newCurrency,
        exchangeRateUsed: params.exchangeRateUsed,
        changeReason: params.changeReason ?? null,
        changedByUserId: params.changedByUserId ?? null,
      },
    });
  }

  async getPriceHistory(query: GetPriceHistoryQueryDto) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);

    const where = query.productId ? { productId: query.productId } : {};

    const [items, total] = await Promise.all([
      this.prisma.priceHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          product: { select: { id: true, name: true, slug: true } },
          changedByUser: { select: { id: true, name: true } },
        },
      }),
      this.prisma.priceHistory.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  // ─── Bulk Price Update ────────────────────────────────────────────────────

  async applyBulkPriceUpdate(
    dto: BulkPriceUpdateDto,
    changedByUserId: string,
  ): Promise<{ updatedCount: number }> {
    const settings = await this.getPricingSettings();

    // Build product filter
    const where = this.buildBulkFilter(dto);

    const products = await this.prisma.product.findMany({
      where,
      select: {
        id: true,
        price: true,
        comparePrice: true,
        baseCurrency: true,
        discountType: true,
        discountValue: true,
        discountStartAt: true,
        discountEndAt: true,
      },
    });

    if (products.length === 0) return { updatedCount: 0 };

    let updatedCount = 0;

    // Process in chunks to avoid enormous transactions
    const CHUNK = 50;
    for (let i = 0; i < products.length; i += CHUNK) {
      const chunk = products.slice(i, i + CHUNK);

      await this.prisma.$transaction(async (tx) => {
        for (const product of chunk) {
          const newPrice = this.applyBulkOperation(
            product.price,
            dto,
            settings,
          );

          if (newPrice.eq(product.price)) continue; // no change, skip

          await tx.product.update({
            where: { id: product.id },
            data: { price: newPrice },
          });

          await tx.priceHistory.create({
            data: {
              productId: product.id,
              oldBasePrice: product.price,
              newBasePrice: newPrice,
              oldComparePrice: product.comparePrice,
              newComparePrice: product.comparePrice,
              oldCurrency: product.baseCurrency,
              newCurrency: product.baseCurrency,
              exchangeRateUsed: settings.exchangeRate,
              changeReason: `bulk:${dto.operation}:${dto.value}`,
              changedByUserId,
            },
          });

          updatedCount++;
        }
      });
    }

    return { updatedCount };
  }

  private buildBulkFilter(dto: BulkPriceUpdateDto) {
    const and: Array<Record<string, unknown>> = [];

    if (dto.productIds?.length) {
      and.push({ id: { in: dto.productIds } });
    }

    if (dto.categoryId) {
      and.push({ categoryId: dto.categoryId });
    }

    if (dto.brand) {
      and.push({ brand: { equals: dto.brand, mode: 'insensitive' } });
    }

    return and.length ? { AND: and } : {};
  }

  private applyBulkOperation(
    currentPrice: Decimal,
    dto: BulkPriceUpdateDto,
    settings: PricingSettings,
  ): Decimal {
    const value = new Decimal(dto.value);
    let result: Decimal;

    switch (dto.operation) {
      case 'increase_percent':
        result = currentPrice.mul(new Decimal(1).add(value.div(100)));
        break;
      case 'decrease_percent':
        result = currentPrice.mul(new Decimal(1).sub(value.div(100)));
        break;
      case 'increase_fixed':
        result = currentPrice.add(value);
        break;
      case 'decrease_fixed':
        result = currentPrice.sub(value);
        break;
      case 'set_fixed':
        result = value;
        break;
      default:
        return currentPrice;
    }

    // Never go below zero
    result = Decimal.max(result, new Decimal(0));
    return this.applyRounding(result, settings.autoRound);
  }

  // ─── Preview ──────────────────────────────────────────────────────────────

  async previewPrice(params: {
    basePrice: number;
    baseCurrency: BaseCurrency;
    discountType?: DiscountType | null;
    discountValue?: number | null;
  }) {
    const settings = await this.getPricingSettings();

    const syntheticProduct: ProductPricingFields = {
      price: new Decimal(params.basePrice),
      baseCurrency: params.baseCurrency,
      comparePrice: null,
      discountType: params.discountType ?? null,
      discountValue:
        params.discountValue != null
          ? new Decimal(params.discountValue)
          : null,
      discountStartAt: null,
      discountEndAt: null,
    };

    const computed = this.computePrice(syntheticProduct, settings);

    return {
      finalPrice: computed.finalPrice.toFixed(2),
      displayBasePrice: computed.displayBasePrice.toFixed(2),
      hasActiveDiscount: computed.hasActiveDiscount,
      discountPercent: computed.discountPercent,
      savings: computed.savings.toFixed(2),
      currency: computed.currency,
      exchangeRateUsed: computed.exchangeRateUsed.toFixed(6),
    };
  }
}
