import { normalizeText } from './text.normalizer';

export type DecimalNormalizationResult = {
  value: number | null;
  error?: string;
};

function normalizeArabicDigits(value: string): string {
  return value
    .replace(/[٠-٩]/gu, (digit) => String(digit.charCodeAt(0) - '٠'.charCodeAt(0)))
    .replace(/[۰-۹]/gu, (digit) => String(digit.charCodeAt(0) - '۰'.charCodeAt(0)));
}

/**
 * Parses only unambiguous decimal forms. Locale-specific forms such as
 * "1,200" and "1.200" are intentionally rejected without a profile rule.
 */
export function normalizeDecimal(value: string | null | undefined): DecimalNormalizationResult {
  const text = normalizeText(value);
  if (text == null) return { value: null };

  const normalized = normalizeArabicDigits(text);
  const plainDecimal = /^[+-]?\d+(?:\.\d+)?$/u;
  const commaThousands = /^[+-]?\d{1,3}(?:,\d{3})+\.\d+$/u;

  if (plainDecimal.test(normalized)) {
    const unsigned = normalized.replace(/^[+-]/u, '');
    const [integerPart, decimalPart] = unsigned.split('.');
    if (decimalPart?.length === 3 && integerPart.length <= 3) {
      return { value: null, error: 'AMBIGUOUS_OR_INVALID_NUMBER' };
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed)
      ? { value: parsed }
      : { value: null, error: 'NUMBER_NOT_FINITE' };
  }

  if (commaThousands.test(normalized)) {
    const parsed = Number(normalized.replace(/,/gu, ''));
    return Number.isFinite(parsed)
      ? { value: parsed }
      : { value: null, error: 'NUMBER_NOT_FINITE' };
  }

  return { value: null, error: 'AMBIGUOUS_OR_INVALID_NUMBER' };
}
