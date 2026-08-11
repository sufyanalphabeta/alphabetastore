export type CsvEncoding = 'UTF-8' | 'WINDOWS-1256';

export type CsvDelimiter = ',' | ';' | '\t';

export type CsvParserOptions = {
  filename?: string;
  mimeType?: string;
  maxFileSizeBytes?: number;
  maxColumns?: number;
  maxRecordSizeBytes?: number;
  delimiter?: CsvDelimiter;
};

export type ParsedCsvRow = {
  rowNumber: number;
  raw: Record<string, string>;
  normalized: Record<string, string | null>;
  parseErrors: string[];
};

export type ParsedCsv = {
  headers: string[];
  delimiter: CsvDelimiter;
  encoding: CsvEncoding;
  totalRows: number;
  rows: ParsedCsvRow[];
  fileWarnings: string[];
};
