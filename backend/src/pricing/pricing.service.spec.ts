import { Test, TestingModule } from '@nestjs/testing';
import { Decimal } from '@prisma/client/runtime/library';
import { PricingService, PricingSettings } from './pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import { BaseCurrency, DiscountType } from '../prisma/prisma-client';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function dec(value: string | number): Decimal {
  return new Decimal(value);
}

function makeProduct(overrides: {
  price: string | number;
  baseCurrency?: BaseCurrency;
  comparePrice?: string | number | null;
  discountType?: DiscountType | null;
  discountValue?: string | number | null;
  discountStartAt?: Date | null;
  discountEndAt?: Date | null;
}) {
  return {
    price: dec(overrides.price),
    baseCurrency: overrides.baseCurrency ?? BaseCurrency.LYD,
    comparePrice: overrides.comparePrice != null ? dec(overrides.comparePrice) : null,
    discountType: overrides.discountType ?? null,
    discountValue: overrides.discountValue != null ? dec(overrides.discountValue) : null,
    discountStartAt: overrides.discountStartAt ?? null,
    discountEndAt: overrides.discountEndAt ?? null,
  };
}

function makeLydSettings(overrides?: Partial<PricingSettings>): PricingSettings {
  return {
    exchangeRate: dec('5.2'),
    defaultCurrency: 'LYD',
    autoRound: false,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PricingService', () => {
  let service: PricingService;

  const mockPrisma = {
    systemSetting: { findMany: jest.fn() },
    product: { findMany: jest.fn(), findUniqueOrThrow: jest.fn() },
    priceHistory: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricingService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PricingService>(PricingService);
    jest.clearAllMocks();
  });

  // ─── convertToStoreCurrency ─────────────────────────────────────────────────

  describe('convertToStoreCurrency', () => {
    it('returns the same amount when currencies match (LYD→LYD)', () => {
      const result = service.convertToStoreCurrency(dec(100), 'LYD', 'LYD', dec('5.2'));
      expect(result.toFixed(2)).toBe('100.00');
    });

    it('multiplies by exchange rate for USD→LYD conversion', () => {
      const result = service.convertToStoreCurrency(dec(100), 'USD', 'LYD', dec('5.2'));
      expect(result.toFixed(2)).toBe('520.00');
    });

    it('divides by exchange rate for LYD→USD conversion', () => {
      const result = service.convertToStoreCurrency(dec(520), 'LYD', 'USD', dec('5.2'));
      expect(result.toFixed(2)).toBe('100.00');
    });

    it('handles zero exchange rate gracefully for LYD→USD', () => {
      const result = service.convertToStoreCurrency(dec(100), 'LYD', 'USD', dec(0));
      expect(result.toFixed(2)).toBe('100.00');
    });

    it('does not introduce floating-point errors on large amounts', () => {
      // Decimal should eliminate floating-point precision issues
      const result = service.convertToStoreCurrency(dec('199.99'), 'USD', 'LYD', dec('5.2'));
      expect(result.toString()).toBe('1039.948');
    });
  });

  // ─── computePrice – no discount ──────────────────────────────────────────────

  describe('computePrice — no discount', () => {
    it('returns base price unchanged for LYD product in LYD store', () => {
      const product = makeProduct({ price: 100 });
      const computed = service.computePrice(product, makeLydSettings());

      expect(computed.finalPrice.toFixed(2)).toBe('100.00');
      expect(computed.displayBasePrice.toFixed(2)).toBe('100.00');
      expect(computed.hasActiveDiscount).toBe(false);
      expect(computed.discountPercent).toBe(0);
      expect(computed.savings.toFixed(2)).toBe('0.00');
      expect(computed.currency).toBe('LYD');
      expect(computed.exchangeRateUsed.toFixed(0)).toBe('1');
    });

    it('converts USD product price to LYD at the exchange rate', () => {
      const product = makeProduct({ price: 100, baseCurrency: BaseCurrency.USD });
      const computed = service.computePrice(product, makeLydSettings());

      expect(computed.finalPrice.toFixed(2)).toBe('520.00');
      expect(computed.displayBasePrice.toFixed(2)).toBe('520.00');
      expect(computed.exchangeRateUsed.toNumber()).toBe(5.2);
      expect(computed.currency).toBe('LYD');
    });

    it('shows compare price when set (no active discount)', () => {
      const product = makeProduct({ price: 80, comparePrice: 100 });
      const computed = service.computePrice(product, makeLydSettings());

      expect(computed.finalPrice.toFixed(2)).toBe('80.00');
      expect(computed.comparePrice?.toFixed(2)).toBe('100.00');
      expect(computed.hasActiveDiscount).toBe(false);
    });
  });

  // ─── computePrice – PERCENTAGE discount ──────────────────────────────────────

  describe('computePrice — PERCENTAGE discount', () => {
    it('applies an active percentage discount correctly', () => {
      const product = makeProduct({
        price: 100,
        discountType: DiscountType.PERCENTAGE,
        discountValue: 20,
      });
      const computed = service.computePrice(product, makeLydSettings());

      expect(computed.hasActiveDiscount).toBe(true);
      expect(computed.discountPercent).toBe(20);
      expect(computed.finalPrice.toFixed(2)).toBe('80.00');
      expect(computed.savings.toFixed(2)).toBe('20.00');
    });

    it('applies percentage discount to USD product after currency conversion', () => {
      const product = makeProduct({
        price: 100,
        baseCurrency: BaseCurrency.USD,
        discountType: DiscountType.PERCENTAGE,
        discountValue: 10,
      });
      const computed = service.computePrice(product, makeLydSettings());

      // 100 USD → 520 LYD; 10% off = 468 LYD
      expect(computed.displayBasePrice.toFixed(2)).toBe('520.00');
      expect(computed.finalPrice.toFixed(2)).toBe('468.00');
      expect(computed.discountPercent).toBe(10);
    });

    it('does not apply discount if not yet started', () => {
      const futureDate = new Date(Date.now() + 86_400_000); // tomorrow
      const product = makeProduct({
        price: 100,
        discountType: DiscountType.PERCENTAGE,
        discountValue: 20,
        discountStartAt: futureDate,
      });
      const computed = service.computePrice(product, makeLydSettings());

      expect(computed.hasActiveDiscount).toBe(false);
      expect(computed.finalPrice.toFixed(2)).toBe('100.00');
    });

    it('does not apply discount if already expired', () => {
      const pastDate = new Date(Date.now() - 86_400_000); // yesterday
      const product = makeProduct({
        price: 100,
        discountType: DiscountType.PERCENTAGE,
        discountValue: 20,
        discountEndAt: pastDate,
      });
      const computed = service.computePrice(product, makeLydSettings());

      expect(computed.hasActiveDiscount).toBe(false);
      expect(computed.finalPrice.toFixed(2)).toBe('100.00');
    });

    it('applies discount within start/end window', () => {
      const yesterday = new Date(Date.now() - 86_400_000);
      const tomorrow = new Date(Date.now() + 86_400_000);
      const product = makeProduct({
        price: 200,
        discountType: DiscountType.PERCENTAGE,
        discountValue: 15,
        discountStartAt: yesterday,
        discountEndAt: tomorrow,
      });
      const computed = service.computePrice(product, makeLydSettings());

      expect(computed.hasActiveDiscount).toBe(true);
      expect(computed.finalPrice.toFixed(2)).toBe('170.00');
    });

    it('does not apply if discountValue is 0', () => {
      const product = makeProduct({
        price: 100,
        discountType: DiscountType.PERCENTAGE,
        discountValue: 0,
      });
      const computed = service.computePrice(product, makeLydSettings());
      expect(computed.hasActiveDiscount).toBe(false);
    });
  });

  // ─── computePrice – FIXED discount ───────────────────────────────────────────

  describe('computePrice — FIXED discount', () => {
    it('applies a fixed LYD discount to a LYD product', () => {
      const product = makeProduct({
        price: 500,
        discountType: DiscountType.FIXED,
        discountValue: 50,
      });
      const computed = service.computePrice(product, makeLydSettings());

      expect(computed.hasActiveDiscount).toBe(true);
      expect(computed.finalPrice.toFixed(2)).toBe('450.00');
      expect(computed.savings.toFixed(2)).toBe('50.00');
    });

    it('converts FIXED discount amount from product base currency before applying', () => {
      // USD product: price=100, fixedDiscount=10 USD → 52 LYD discount
      const product = makeProduct({
        price: 100,
        baseCurrency: BaseCurrency.USD,
        discountType: DiscountType.FIXED,
        discountValue: 10,
      });
      const computed = service.computePrice(product, makeLydSettings());

      // 100 USD = 520 LYD; discount = 10 USD = 52 LYD; final = 468 LYD
      expect(computed.finalPrice.toFixed(2)).toBe('468.00');
      expect(computed.savings.toFixed(2)).toBe('52.00');
    });

    it('does not go below zero for oversized fixed discounts', () => {
      const product = makeProduct({
        price: 10,
        discountType: DiscountType.FIXED,
        discountValue: 999,
      });
      const computed = service.computePrice(product, makeLydSettings());
      expect(computed.finalPrice.toNumber()).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── computePrice – rounding ─────────────────────────────────────────────────

  describe('computePrice — rounding', () => {
    it('rounds to 2 decimal places when autoRound is false', () => {
      const product = makeProduct({
        price: '19.999',
        discountType: DiscountType.PERCENTAGE,
        discountValue: 33,
      });
      const computed = service.computePrice(product, makeLydSettings({ autoRound: false }));
      // Should be precise to 2dp, not just a rough integer
      expect(computed.finalPrice.decimalPlaces()).toBeLessThanOrEqual(2);
    });

    it('rounds to whole numbers when autoRound is true', () => {
      const product = makeProduct({ price: '99.5' });
      const computed = service.computePrice(product, makeLydSettings({ autoRound: true }));
      expect(computed.finalPrice.decimalPlaces()).toBe(0);
    });

    it('rounds half-up (100.5 → 101) when autoRound is true', () => {
      const product = makeProduct({ price: '100.5' });
      const computed = service.computePrice(product, makeLydSettings({ autoRound: true }));
      expect(computed.finalPrice.toNumber()).toBe(101);
    });
  });

  // ─── getPricingSettings ──────────────────────────────────────────────────────

  describe('getPricingSettings', () => {
    it('returns defaults when no settings exist in DB', async () => {
      mockPrisma.systemSetting.findMany.mockResolvedValue([]);
      const settings = await service.getPricingSettings();

      expect(settings.exchangeRate.toNumber()).toBe(5.2);
      expect(settings.defaultCurrency).toBe('LYD');
      expect(settings.autoRound).toBe(false);
    });

    it('uses DB values when present', async () => {
      mockPrisma.systemSetting.findMany.mockResolvedValue([
        { key: 'exchange_rate_usd_to_lyd', value: '6.5' },
        { key: 'default_currency', value: 'USD' },
        { key: 'auto_round_prices', value: 'true' },
      ]);
      const settings = await service.getPricingSettings();

      expect(settings.exchangeRate.toNumber()).toBe(6.5);
      expect(settings.defaultCurrency).toBe('USD');
      expect(settings.autoRound).toBe(true);
    });

    it('falls back to 5.2 when exchange_rate_usd_to_lyd is invalid', async () => {
      mockPrisma.systemSetting.findMany.mockResolvedValue([
        { key: 'exchange_rate_usd_to_lyd', value: 'not-a-number' },
      ]);
      const settings = await service.getPricingSettings();
      expect(settings.exchangeRate.toNumber()).toBe(5.2);
    });
  });
});
