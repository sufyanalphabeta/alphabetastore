import { parse } from 'csv-parse/sync';
import iconv from 'iconv-lite';
import { TextDecoder } from 'util';

import { normalizeText } from '../normalization';
import {
  CsvDelimiter,
  CsvEncoding,
  CsvParserOptions,
  ParsedCsv,
} from './csv.types';

const DEFAULT_MAX_FILE_SIZE = 25 * 1024 * 1024;
const DEFAULT_MAX_COLUMNS = 200;
const DEFAULT_MAX_RECORD_SIZE = 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
]);
const DELIMITERS: CsvDelimiter[] = [',', ';', '\t'];

type DecodedCsv = {
  text: string;
  encoding: CsvEncoding;
  warnings: string[];
};

function assertCsvFile(buffer: Buffer, options: CsvParserOptions): void {
  if (!Buffer.isBuffer(buffer)) throw new Error('CSV_INPUT_MUST_BE_A_BUFFER');
  if (buffer.length === 0) throw new Error('CSV_FILE_EMPTY');

  const maxSize = options.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE;
  if (buffer.length > maxSize) throw new Error('CSV_FILE_TOO_LARGE');

  if (options.filename && !options.filename.toLowerCase().endsWith('.csv')) {
    throw new Error('CSV_EXTENSION_NOT_ALLOWED');
  }

  if (options.mimeType && !ALLOWED_MIME_TYPES.has(options.mimeType.toLowerCase())) {
    throw new Error('CSV_MIME_TYPE_NOT_ALLOWED');
  }
}

function decodeCsv(buffer: Buffer): DecodedCsv {
  const hasUtf8Bom = buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]));
  const utf8Buffer = hasUtf8Bom ? buffer.subarray(3) : buffer;

  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(utf8Buffer);
    return { text: text.replace(/^\uFEFF/u, ''), encoding: 'UTF-8', warnings: [] };
  } catch {
    return {
      text: iconv.decode(buffer, 'win1256'),
      encoding: 'WINDOWS-1256',
      warnings: ['UTF-8 decoding failed; Windows-1256 was used.'],
    };
  }
}

function parseRecords(text: string, delimiter: CsvDelimiter, maxRecordSize: number): string[][] {
  try {
    return parse(text, {
      bom: false,
      delimiter,
      escape: '"',
      relax_column_count: true,
      relax_quotes: false,
      skip_empty_lines: false,
      max_record_size: maxRecordSize,
      record_delimiter: ['\r\n', '\n', '\r'],
    }) as string[][];
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Malformed CSV';
    throw new Error(`CSV_PARSE_FAILED: ${message}`);
  }
}

function rowIsEmpty(row: string[]): boolean {
  return row.every((value) => normalizeText(value) == null);
}

function detectDelimiter(text: string, maxRecordSize: number): CsvDelimiter {
  const candidates = DELIMITERS.map((delimiter) => {
    try {
      const records = parseRecords(text, delimiter, maxRecordSize).filter((row) => !rowIsEmpty(row));
      const headerWidth = records[0]?.length ?? 0;
      const consistentRows = records.slice(1).filter((row) => row.length === headerWidth).length;
      const score = headerWidth > 1 ? consistentRows * 10 + headerWidth : 0;
      return { delimiter, score, headerWidth, valid: records.length > 0 };
    } catch {
      return { delimiter, score: -1, headerWidth: 0, valid: false };
    }
  }).filter((candidate) => candidate.valid && candidate.score >= 0);

  const bestScore = Math.max(...candidates.map((candidate) => candidate.score), -1);
  const best = candidates.filter((candidate) => candidate.score === bestScore);

  if (best.length !== 1 || bestScore <= 0) {
    throw new Error('CSV_DELIMITER_AMBIGUOUS_OR_NOT_FOUND');
  }

  return best[0].delimiter;
}

function normalizeHeaders(headerRow: string[], maxColumns: number): string[] {
  if (headerRow.length === 0 || rowIsEmpty(headerRow)) {
    throw new Error('CSV_HEADER_MISSING');
  }
  if (headerRow.length > maxColumns) throw new Error('CSV_TOO_MANY_COLUMNS');

  const headers = headerRow.map((header) => normalizeText(header));
  if (headers.some((header) => header == null)) throw new Error('CSV_HEADER_MISSING');

  const duplicates = new Set<string>();
  const seen = new Set<string>();
  for (const header of headers as string[]) {
    if (seen.has(header)) duplicates.add(header);
    seen.add(header);
  }
  if (duplicates.size > 0) throw new Error('CSV_DUPLICATE_HEADERS');

  return headers as string[];
}

export function parseCsvBuffer(buffer: Buffer, options: CsvParserOptions = {}): ParsedCsv {
  assertCsvFile(buffer, options);
  const maxColumns = options.maxColumns ?? DEFAULT_MAX_COLUMNS;
  const maxRecordSize = options.maxRecordSizeBytes ?? DEFAULT_MAX_RECORD_SIZE;
  const decoded = decodeCsv(buffer);
  const delimiter = options.delimiter ?? detectDelimiter(decoded.text, maxRecordSize);
  const records = parseRecords(decoded.text, delimiter, maxRecordSize);
  const headers = normalizeHeaders(records[0] ?? [], maxColumns);
  const rows = records.slice(1).filter((row) => !rowIsEmpty(row));

  return {
    headers,
    delimiter,
    encoding: decoded.encoding,
    totalRows: rows.length,
    rows: rows.map((values, index) => {
      const parseErrors: string[] = [];
      if (values.length !== headers.length) parseErrors.push('CSV_COLUMN_COUNT_MISMATCH');

      const raw: Record<string, string> = {};
      const normalized: Record<string, string | null> = {};
      headers.forEach((header, columnIndex) => {
        const value = values[columnIndex] ?? '';
        raw[header] = value;
        normalized[header] = normalizeText(value);
      });

      return {
        rowNumber: index + 2,
        raw,
        normalized,
        parseErrors,
      };
    }),
    fileWarnings: decoded.warnings,
  };
}
