import { formatDistanceStrict } from "date-fns/formatDistanceStrict";
import { formatStoreCurrency } from "utils/currency";
import { computeStorefrontPrice, buildPricingSettings } from "utils/pricing";

/**
 * GET THE DIFFERENCE DATE FORMAT
 * @param  DATE | NUMBER | STRING
 * @returns FORMATTED DATE STRING
 */

export function getDateDifference(date) {
  const distance = formatDistanceStrict(new Date(), new Date(date));
  return distance + " ago";
}

/**
 * RENDER THE PRODUCT PAGINATION INFO
 * @param page - CURRENT PAGE NUMBER
 * @param perPageProduct - PER PAGE PRODUCT LIST
 * @param totalProduct - TOTAL PRODUCT NUMBER
 * @returns
 */

export function renderProductCount(page, perPageProduct, totalProduct) {
  const startNumber = (page - 1) * perPageProduct;
  let endNumber = page * perPageProduct;
  if (endNumber > totalProduct) {
    endNumber = totalProduct;
  }
  return `Showing ${startNumber + 1}-${endNumber} of ${totalProduct} products`;
}

/**
 * CALCULATE PRICE WITH PRODUCT DISCOUNT THEN RETURN NEW PRODUCT PRICES
 * @param  price - PRODUCT PRICE
 * @param  discount - DISCOUNT PERCENT (legacy)
 * @returns - RETURN NEW PRICE
 */

export function calculateDiscount(price, discount) {
  const afterDiscount = Number((price - price * (discount / 100)).toFixed(2));
  return currency(afterDiscount);
}

/**
 * Compute and format price for a product using current store settings.
 * Use this when you have the full product object with new pricing fields.
 *
 * @param {Object} product - Product with baseCurrency, discountType, discountValue etc.
 * @param {Object} contextSettings - Settings from SettingsContext
 * @returns {{ finalFormatted: string, baseFormatted: string, hasDiscount: boolean, discountPercent: number }}
 */
export function computeProductPrice(product, contextSettings) {
  const settings = buildPricingSettings(contextSettings);
  const computed = computeStorefrontPrice(product, settings);
  const currency = computed.currency;
  const locale = contextSettings?.default_language?.startsWith("ar") ? "ar-LY" : "en-US";
  return {
    ...computed,
    finalFormatted: formatStoreCurrency(computed.finalPrice, 2, currency),
    baseFormatted: formatStoreCurrency(computed.displayBasePrice, 2, currency),
    compareFormatted: computed.comparePrice != null ? formatStoreCurrency(computed.comparePrice, 2, currency) : null,
  };
}

/**
 * CHANGE THE CURRENCY FORMAT
 * @param  price - PRODUCT PRICE
 * @param  fraction - HOW MANY FRACTION WANT TO SHOW
 * @returns - RETURN PRICE WITH CURRENCY
 */

export function currency(price, fraction = 2) {
  return formatStoreCurrency(price, fraction);
}