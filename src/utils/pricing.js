/**
 * Frontend pricing utility — mirrors backend PricingService.computePrice() logic.
 *
 * The backend is the authoritative source for all commerce pricing.
 * This utility is for CLIENT-SIDE DISPLAY ONLY — used to render prices in product cards,
 * live previews in admin forms, and other UI elements.
 *
 * Do NOT use this for cart totals or order amounts. Those always come from the backend.
 */

/**
 * @typedef {Object} PricingSettings
 * @property {number} exchangeRate - USD to LYD exchange rate
 * @property {string} defaultCurrency - Always "LYD" for storefront display
 * @property {boolean} autoRound - Whether to round to whole numbers
 */

/**
 * @typedef {Object} ComputedPrice
 * @property {number} finalPrice - Price to charge the customer (in store currency)
 * @property {number} displayBasePrice - Original price before discount (in store currency)
 * @property {number|null} comparePrice - Compare-at price (in store currency), if set
 * @property {boolean} hasActiveDiscount - Whether a discount is currently active
 * @property {number} discountPercent - Discount percentage (0-100), rounded to 1dp
 * @property {number} savings - How much the customer saves
 * @property {number} exchangeRateUsed - The exchange rate applied
 * @property {string} currency - Store display currency ("LYD" or "USD")
 */

function applyRounding(amount, autoRound) {
  if (autoRound) {
    return Math.round(amount);
  }
  // Round to 2 decimal places
  return Math.round(amount * 100) / 100;
}

function convertToStoreCurrency(amount, fromCurrency, toCurrency, exchangeRate) {
  if (fromCurrency === toCurrency) return amount;
  if (fromCurrency === "USD" && toCurrency === "LYD") {
    return amount * exchangeRate;
  }
  if (fromCurrency === "LYD" && toCurrency === "USD") {
    return exchangeRate > 0 ? amount / exchangeRate : amount;
  }
  return amount;
}

function isDiscountActive(product) {
  if (!product.discountType || product.discountValue == null) return false;
  const value = Number(product.discountValue);
  if (!Number.isFinite(value) || value <= 0) return false;
  const now = Date.now();
  if (product.discountStartAt && new Date(product.discountStartAt).getTime() > now) return false;
  if (product.discountEndAt && new Date(product.discountEndAt).getTime() < now) return false;
  return true;
}

/**
 * Compute display price for a product using frontend settings.
 * Mirrors backend PricingService.computePrice().
 *
 * @param {Object} product - Product object with pricing fields
 * @param {PricingSettings} settings - Current store pricing settings
 * @returns {ComputedPrice}
 */
export function computeStorefrontPrice(product, settings) {
  const exchangeRate = Number(settings?.exchangeRate) || 5.2;
  const productExchangeRate = Number(product.exchangeRateOverride);
  const effectiveExchangeRate = Number.isFinite(productExchangeRate) && productExchangeRate > 0
    ? productExchangeRate
    : exchangeRate;
  // The public storefront is Libya-first: never expose the internal USD price.
  const storeCurrency = "LYD";
  const autoRound = Boolean(settings?.autoRound);
  const baseCurrency = product.baseCurrency || "LYD";
  const basePrice = Number(product.price) || 0;

  // Compare price is in the product's base currency
  const comparePrice = product.comparePrice != null ? Number(product.comparePrice) : null;

  // Convert base price to store currency
  const priceInStore = convertToStoreCurrency(basePrice, baseCurrency, storeCurrency, effectiveExchangeRate);
  const comparePriceInStore = comparePrice != null
    ? convertToStoreCurrency(comparePrice, baseCurrency, storeCurrency, effectiveExchangeRate)
    : null;

  // Apply active discount
  const active = isDiscountActive(product);
  let finalPrice = priceInStore;
  let discountPercent = 0;

  if (active) {
    const discountValue = Number(product.discountValue);

    if (product.discountType === "PERCENTAGE") {
      discountPercent = discountValue;
      finalPrice = priceInStore * (1 - discountValue / 100);
    } else if (product.discountType === "FIXED") {
      // Fixed discount is in the product's base currency; convert to store currency
      const fixedInStore = convertToStoreCurrency(discountValue, baseCurrency, storeCurrency, effectiveExchangeRate);
      finalPrice = Math.max(0, priceInStore - fixedInStore);
      discountPercent = priceInStore > 0 ? (fixedInStore / priceInStore) * 100 : 0;
    }
  }

  const roundedFinal = applyRounding(finalPrice, autoRound);
  const roundedBase = applyRounding(priceInStore, autoRound);
  const roundedCompare = comparePriceInStore != null
    ? applyRounding(comparePriceInStore, autoRound)
    : null;

  return {
    finalPrice: roundedFinal,
    displayBasePrice: roundedBase,
    comparePrice: roundedCompare,
    hasActiveDiscount: active,
    discountPercent: Math.round(discountPercent * 10) / 10,
    savings: Math.round((roundedBase - roundedFinal) * 100) / 100,
    exchangeRateUsed: effectiveExchangeRate,
    currency: storeCurrency,
  };
}

/**
 * Format a price amount for display.
 *
 * @param {number} amount
 * @param {string} currency - "LYD" or "USD"
 * @param {string} locale - "ar-LY" or "en-US"
 * @returns {string}
 */
function legacyFormatPrice(amount, currency = "LYD", locale = "ar-LY") {
  const num = Number(amount);
  if (!Number.isFinite(num)) return "";

  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);

  return currency === "LYD" ? `${formatted} د.ل` : `$${formatted}`;
}

/**
 * Build pricing settings object from the SettingsContext values.
 * Use this to pass settings into computeStorefrontPrice().
 *
 * @param {Object} contextSettings - The settings object from SettingsContext
 * @returns {PricingSettings}
 */
export function buildPricingSettings(contextSettings) {
  return {
    exchangeRate: Number(contextSettings?.exchange_rate_usd_to_lyd) || 5.2,
    defaultCurrency: "LYD",
    autoRound: String(contextSettings?.auto_round_prices) === "true",
  };
}

// Keep one canonical currency label for admin previews as well as storefront cards.
export function formatPrice(amount, currency = "LYD", locale = "ar-LY") {
  const num = Number(amount);
  if (!Number.isFinite(num)) return "";
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
  return currency === "LYD" ? `${formatted} \u062f.\u0644` : `$${formatted}`;
}
