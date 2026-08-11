const UNICODE_EDGE_WHITESPACE = /^[\s\uFEFF\u00A0]+|[\s\uFEFF\u00A0]+$/gu;

export function normalizeText(value: string | null | undefined): string | null {
  if (value == null) return null;

  const normalized = value
    .replace(/^\uFEFF/u, '')
    .replace(/\r\n?/gu, '\n')
    .replace(UNICODE_EDGE_WHITESPACE, '');

  return normalized.length > 0 ? normalized : null;
}

export function normalizeBarcode(value: string | null | undefined, options?: {
  stripSurroundingAsterisks?: boolean;
}): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  if (options?.stripSurroundingAsterisks && /^\*[^*]+\*$/u.test(normalized)) {
    return normalizeText(normalized.slice(1, -1));
  }

  return normalized;
}

export function escapeCsvFormulaInjection(value: string): string {
  return /^[=+\-@]/u.test(value) ? `'${value}` : value;
}
