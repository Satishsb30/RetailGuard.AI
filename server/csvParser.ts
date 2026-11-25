import crypto from 'node:crypto';
import type { ParsedCsvRecord } from '../src/types/audit.ts';

export interface ParsedCsvDocument {
  sha256: string;
  fileSizeBytes: number;
  totalPhysicalLines: number;
  headers: string[];
  records: ParsedCsvRecord[];
}

/**
 * Parses raw CSV bytes according to RFC-4180 while preserving exact source row numbers
 * and never mutating the original byte buffer.
 */
export function parseCsvBuffer(buffer: Buffer): ParsedCsvDocument {
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const fileSizeBytes = buffer.byteLength;

  // Decode UTF-8 and strip optional UTF-8 BOM only for string parsing (original buffer remains untouched)
  let text = buffer.toString('utf8');
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  if (text.trim().length === 0) {
    return {
      sha256,
      fileSizeBytes,
      totalPhysicalLines: 0,
      headers: [],
      records: [],
    };
  }

  const rows: { sourceRow: number; values: string[] }[] = [];
  let currentField = '';
  let currentRow: string[] = [];
  let inQuotes = false;
  let currentLineNumber = 1;
  let rowStartLine = 1;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"') {
        if (next === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === '\n') {
          currentLineNumber++;
        } else if (ch === '\r') {
          if (next === '\n') {
            currentField += '\r';
            i++;
          }
          currentLineNumber++;
        }
        currentField += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      currentRow.push(currentField);
      currentField = '';
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && next === '\n') {
        i++;
      }
      currentRow.push(currentField);
      // Skip completely empty trailing lines unless it's the only row
      const isCompletelyEmpty =
        currentRow.length === 1 && currentRow[0].trim() === '';
      if (!isCompletelyEmpty) {
        rows.push({ sourceRow: rowStartLine, values: currentRow });
      }
      currentField = '';
      currentRow = [];
      currentLineNumber++;
      rowStartLine = currentLineNumber;
    } else {
      currentField += ch;
    }
  }

  // Push final row if non-empty
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    const isCompletelyEmpty =
      currentRow.length === 1 && currentRow[0].trim() === '';
    if (!isCompletelyEmpty) {
      rows.push({ sourceRow: rowStartLine, values: currentRow });
    }
  }

  if (rows.length === 0) {
    return {
      sha256,
      fileSizeBytes,
      totalPhysicalLines: currentLineNumber,
      headers: [],
      records: [],
    };
  }

  const headers = rows[0].values.map((h) => h.trim());
  const records: ParsedCsvRecord[] = [];

  for (let r = 1; r < rows.length; r++) {
    const { sourceRow, values } = rows[r];
    const rawFieldsByColumn: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const headerName = headers[c] || `column_${c + 1}`;
      rawFieldsByColumn[headerName] = (values[c] ?? '').trim();
    }
    records.push({
      sourceRow,
      values,
      rawFieldsByColumn,
      columnCountMismatch: values.length !== headers.length,
    });
  }

  return {
    sha256,
    fileSizeBytes,
    totalPhysicalLines: rows[rows.length - 1].sourceRow,
    headers,
    records,
  };
}
