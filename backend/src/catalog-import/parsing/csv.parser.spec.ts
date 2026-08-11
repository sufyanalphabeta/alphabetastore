import { existsSync, readFileSync } from 'fs';

import { normalizeDecimal, normalizeBarcode, escapeCsvFormulaInjection } from '../normalization';
import { parseCsvBuffer } from './csv.parser';

function parse(text: string, delimiter?: ',' | ';' | '\t') {
  return parseCsvBuffer(Buffer.from(text, 'utf8'), { delimiter });
}

describe('parseCsvBuffer', () => {
  it('parses UTF-8 Arabic text and quoted commas', () => {
    const result = parse('name,description\nحاسوب,"جهاز, احترافي"\n');

    expect(result.encoding).toBe('UTF-8');
    expect(result.headers).toEqual(['name', 'description']);
    expect(result.rows[0].raw).toEqual({ name: 'حاسوب', description: 'جهاز, احترافي' });
  });

  it('parses UTF-8 BOM, CRLF, LF, empty fields, and trailing empty columns', () => {
    const result = parse('\uFEFFname,empty,last\r\nمنتج,,\r\nآخر,قيمة,\n');

    expect(result.totalRows).toBe(2);
    expect(result.rows[0].raw).toEqual({ name: 'منتج', empty: '', last: '' });
    expect(result.rows[1].normalized).toEqual({ name: 'آخر', empty: 'قيمة', last: null });
  });

  it.each([
    ['comma', 'name,price\nA,10\n', ','],
    ['semicolon', 'name;price\nA;10\n', ';'],
    ['tab', 'name\tprice\nA\t10\n', '\t'],
  ])('detects %s delimiter', (_label, source, expected) => {
    expect(parse(source as string).delimiter).toBe(expected);
  });

  it('preserves raw values while trimming normalized values', () => {
    const result = parse('name,price\n  منتج  ,"  1,200.50  "\n');

    expect(result.rows[0].raw.name).toBe('  منتج  ');
    expect(result.rows[0].normalized.name).toBe('منتج');
    expect(result.rows[0].raw.price).toBe('  1,200.50  ');
    expect(result.rows[0].normalized.price).toBe('1,200.50');
  });

  it('reports malformed quoting', () => {
    expect(() => parseCsvBuffer(Buffer.from('name,price\n"broken,10\n'), { delimiter: ',' }))
      .toThrow('CSV_PARSE_FAILED');
  });

  it('rejects duplicate headers, empty files, and missing headers', () => {
    expect(() => parse('name,name\nA,B\n')).toThrow('CSV_DUPLICATE_HEADERS');
    expect(() => parseCsvBuffer(Buffer.alloc(0))).toThrow('CSV_FILE_EMPTY');
    expect(() => parse(',\nA,B\n')).toThrow('CSV_HEADER_MISSING');
  });

  it('rejects unsupported extension and excessive width', () => {
    expect(() => parseCsvBuffer(Buffer.from('a,b\n1,2\n'), { filename: 'items.xlsx' }))
      .toThrow('CSV_EXTENSION_NOT_ALLOWED');
    expect(() => parseCsvBuffer(Buffer.from('a,b,c\n1,2,3\n'), { maxColumns: 2 }))
      .toThrow('CSV_TOO_MANY_COLUMNS');
  });

  it('keeps CSV injection-like values as plain data', () => {
    const result = parse('name\n=1+1\n', ',');

    expect(result.rows[0].raw.name).toBe('=1+1');
    expect(escapeCsvFormulaInjection(result.rows[0].raw.name)).toBe("'=1+1");
  });

  it('normalizes only unambiguous numeric values', () => {
    expect(normalizeDecimal('1200').value).toBe(1200);
    expect(normalizeDecimal('1200.50').value).toBe(1200.5);
    expect(normalizeDecimal('1,200.50').value).toBe(1200.5);
    expect(normalizeDecimal('1,200').error).toBe('AMBIGUOUS_OR_INVALID_NUMBER');
    expect(normalizeDecimal('1.200').error).toBe('AMBIGUOUS_OR_INVALID_NUMBER');
    expect(normalizeDecimal('١٢٠٠').value).toBe(1200);
  });

  it('keeps generic barcode handling conservative and supports opt-in asterisk stripping', () => {
    expect(normalizeBarcode('*5500884*')).toBe('*5500884*');
    expect(normalizeBarcode('*5500884*', { stripSurroundingAsterisks: true })).toBe('5500884');
  });

  it('parses the real Rakiza sample when supplied as a test fixture', () => {
    const fixture = process.env.RAKIZA_CSV_FIXTURE;
    if (!fixture || !existsSync(fixture)) return;

    const result = parseCsvBuffer(readFileSync(fixture), { filename: 'PriceList.csv' });
    expect(result.encoding).toBe('UTF-8');
    expect(result.delimiter).toBe(',');
    expect(result.headers).toHaveLength(24);
    expect(result.totalRows).toBe(346);
    expect(result.rows.every((row) => row.parseErrors.length === 0)).toBe(true);
    expect(result.rows[0].raw.tbItemCode).toBe('*5500934*');
  });
});
