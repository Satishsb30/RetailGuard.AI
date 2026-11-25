import crypto from 'node:crypto';
import type {
  AuditFinding,
  AuditResult,
  AuditSummary,
  FormatError,
  FormatValidationResult,
  ParsedCsvRecord,
  QuantityPlotPoint,
  QuantityStats,
  RequiredColumn,
} from '../src/types/audit.ts';
import { REQUIRED_COLUMNS } from '../src/types/audit.ts';
import { parseCsvBuffer } from './csvParser.ts';

interface ParsedDateResult {
  valid: boolean;
  formatStyle: 'ISO_YYYY_MM_DD' | 'US_MM_DD_YYYY' | 'SLASH_YYYY_MM_DD' | 'INVALID';
  isoDate?: string;
  reason?: string;
}

function parseStrictNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

function parseStrictDate(raw: string): ParsedDateResult {
  const trimmed = raw.trim();

  // ISO YYYY-MM-DD
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (!isValidCalendarDate(year, month, day)) {
      return {
        valid: false,
        formatStyle: 'INVALID',
        reason: `Calendar date ${trimmed} does not exist`,
      };
    }
    return {
      valid: true,
      formatStyle: 'ISO_YYYY_MM_DD',
      isoDate: trimmed,
    };
  }

  // Slash YYYY/MM/DD
  const slashIsoMatch = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(trimmed);
  if (slashIsoMatch) {
    const year = Number(slashIsoMatch[1]);
    const month = Number(slashIsoMatch[2]);
    const day = Number(slashIsoMatch[3]);
    if (!isValidCalendarDate(year, month, day)) {
      return {
        valid: false,
        formatStyle: 'INVALID',
        reason: `Calendar date ${trimmed} does not exist`,
      };
    }
    return {
      valid: true,
      formatStyle: 'SLASH_YYYY_MM_DD',
      isoDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    };
  }

  // US MM/DD/YYYY
  const usMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (usMatch) {
    const month = Number(usMatch[1]);
    const day = Number(usMatch[2]);
    const year = Number(usMatch[3]);
    if (!isValidCalendarDate(year, month, day)) {
      return {
        valid: false,
        formatStyle: 'INVALID',
        reason: `Calendar date ${trimmed} does not exist (MM/DD/YYYY check failed)`,
      };
    }
    return {
      valid: true,
      formatStyle: 'US_MM_DD_YYYY',
      isoDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    };
  }

  return {
    valid: false,
    formatStyle: 'INVALID',
    reason: `Unrecognized date format "${trimmed}" (expected YYYY-MM-DD)`,
  };
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

function computeQuantityStats(quantities: number[]): QuantityStats | null {
  if (quantities.length === 0) return null;
  const sorted = [...quantities].sort((a, b) => a - b);
  const validCount = sorted.length;
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = sum / validCount;
  const variance =
    sorted.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / validCount;
  const stdDev = Math.sqrt(variance);
  const median = quantile(sorted, 0.5);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const upperFence = q3 + 1.5 * iqr;
  const deviations = sorted.map((v) => Math.abs(v - median)).sort((a, b) => a - b);
  const mad = quantile(deviations, 0.5);
  const anomalyThreshold = Math.max(upperFence, median * 3, 20);

  return {
    validCount,
    mean: Number(mean.toFixed(2)),
    stdDev: Number(stdDev.toFixed(2)),
    median: Number(median.toFixed(2)),
    q1: Number(q1.toFixed(2)),
    q3: Number(q3.toFixed(2)),
    iqr: Number(iqr.toFixed(2)),
    upperFence: Number(upperFence.toFixed(2)),
    mad: Number(mad.toFixed(2)),
    anomalyThreshold: Number(anomalyThreshold.toFixed(2)),
  };
}

function validateFormat(
  headers: string[],
  records: ParsedCsvRecord[]
): FormatValidationResult {
  const errors: FormatError[] = [];
  if (headers.length === 0) {
    errors.push({
      code: 'EMPTY_FILE',
      message: 'The uploaded CSV file is empty or contains no header row.',
    });
    return {
      isValidStructure: false,
      canRunRecordAudit: false,
      detectedHeaders: [],
      normalizedHeaderMap: {},
      missingRequiredColumns: [...REQUIRED_COLUMNS],
      unexpectedColumns: [],
      errors,
    };
  }

  const normalizedHeaderMap: Record<string, string> = {};
  const lowerHeaderToActual = new Map<string, string>();

  for (const header of headers) {
    const lower = header.trim().toLowerCase();
    if (!lowerHeaderToActual.has(lower)) {
      lowerHeaderToActual.set(lower, header);
    }
  }

  const missingRequiredColumns: string[] = [];
  for (const req of REQUIRED_COLUMNS) {
    const matchedActual = lowerHeaderToActual.get(req);
    if (matchedActual) {
      normalizedHeaderMap[req] = matchedActual;
      if (matchedActual !== req) {
        errors.push({
          code: 'HEADER_CASING_MISMATCH',
          columnName: matchedActual,
          message: `Column "${matchedActual}" matches required "${req}" with different casing or spacing.`,
        });
      }
    } else {
      missingRequiredColumns.push(req);
      errors.push({
        code: 'MISSING_REQUIRED_COLUMN',
        columnName: req,
        message: `Required column "${req}" is missing from the CSV header row.`,
      });
    }
  }

  const requiredSet = new Set<string>(REQUIRED_COLUMNS);
  const unexpectedColumns: string[] = [];
  for (const header of headers) {
    if (!requiredSet.has(header.trim().toLowerCase())) {
      unexpectedColumns.push(header);
      errors.push({
        code: 'UNEXPECTED_COLUMN',
        columnName: header,
        message: `Unexpected column "${header}" is not part of the standard 6-column retail transaction schema.`,
      });
    }
  }

  for (const rec of records) {
    if (rec.columnCountMismatch) {
      errors.push({
        code: 'ROW_COLUMN_MISMATCH',
        sourceRow: rec.sourceRow,
        message: `Source row ${rec.sourceRow} has ${rec.values.length} fields, expected ${headers.length}.`,
      });
    }
  }

  const hasBlockingSchemaError =
    missingRequiredColumns.length === REQUIRED_COLUMNS.length || records.length === 0;

  return {
    isValidStructure:
      missingRequiredColumns.length === 0 &&
      unexpectedColumns.length === 0 &&
      errors.every((e) => e.code !== 'ROW_COLUMN_MISMATCH'),
    canRunRecordAudit: !hasBlockingSchemaError,
    detectedHeaders: headers,
    normalizedHeaderMap,
    missingRequiredColumns,
    unexpectedColumns,
    errors,
  };
}

export function runRetailAudit(
  fileBuffer: Buffer,
  fileName: string,
  auditIdOverride?: string
): AuditResult {
  const parsed = parseCsvBuffer(fileBuffer);
  const formatValidation = validateFormat(parsed.headers, parsed.records);
  const findings: AuditFinding[] = [];
  let findingSeq = 1;

  const nextId = () => `FND-${String(findingSeq++).padStart(3, '0')}`;

  const getField = (rec: ParsedCsvRecord, col: RequiredColumn): string => {
    const actualHeader = formatValidation.normalizedHeaderMap[col];
    if (!actualHeader) return '';
    return rec.rawFieldsByColumn[actualHeader] ?? '';
  };

  const hasCol = (col: RequiredColumn): boolean =>
    Boolean(formatValidation.normalizedHeaderMap[col]);

  // Add format findings for missing or unexpected columns
  for (const err of formatValidation.errors) {
    if (err.code === 'MISSING_REQUIRED_COLUMN') {
      findings.push({
        id: nextId(),
        issueName: 'Missing Required Column',
        category: 'Format Error',
        columnName: err.columnName ?? 'header',
        sourceRow: 1,
        transactionId: null,
        priority: 'High',
        cellValue: '(missing)',
        evidence: err.message,
        suggestedReview:
          'Verify the POS export template and re-export with all 6 required headers: transaction_id, product_name, quantity, unit_price, total_amount, date.',
      });
    } else if (err.code === 'UNEXPECTED_COLUMN') {
      findings.push({
        id: nextId(),
        issueName: 'Unexpected Column Header',
        category: 'Format Error',
        columnName: err.columnName ?? 'header',
        sourceRow: 1,
        transactionId: null,
        priority: 'Medium',
        cellValue: err.columnName ?? '',
        evidence: err.message,
        suggestedReview:
          'Confirm whether this extra column should be archived separately or ignored in downstream sales reporting.',
      });
    } else if (err.code === 'ROW_COLUMN_MISMATCH' && err.sourceRow) {
      findings.push({
        id: nextId(),
        issueName: 'Ragged CSV Row Width',
        category: 'Format Error',
        columnName: 'row_structure',
        sourceRow: err.sourceRow,
        transactionId: null,
        priority: 'High',
        cellValue: `${parsed.records.find((r) => r.sourceRow === err.sourceRow)?.values.length ?? 0} cols`,
        evidence: err.message,
        suggestedReview:
          'Inspect unescaped commas or missing delimiters on this row in the original CSV export.',
      });
    }
  }

  // Pre-pass: gather positive quantities for statistical anomaly rules and date formats
  const positiveQuantities: number[] = [];
  const dateStyleCounts = new Map<string, number>();

  for (const rec of parsed.records) {
    if (hasCol('quantity')) {
      const q = parseStrictNumber(getField(rec, 'quantity'));
      if (q !== null && q > 0) {
        positiveQuantities.push(q);
      }
    }
    if (hasCol('date')) {
      const rawDate = getField(rec, 'date');
      if (rawDate !== '') {
        const parsedDate = parseStrictDate(rawDate);
        if (parsedDate.valid) {
          dateStyleCounts.set(
            parsedDate.formatStyle,
            (dateStyleCounts.get(parsedDate.formatStyle) ?? 0) + 1
          );
        }
      }
    }
  }

  const quantityStats = computeQuantityStats(positiveQuantities);
  let dominantDateStyle: string | null = null;
  let dominantDateCount = 0;
  for (const [style, count] of dateStyleCounts.entries()) {
    if (count > dominantDateCount) {
      dominantDateCount = count;
      dominantDateStyle = style;
    }
  }

  const seenFullRows = new Map<string, number>();
  const seenTxnIds = new Map<string, number[]>();
  const plotPoints: QuantityPlotPoint[] = [];

  // Record-level validation
  for (const rec of parsed.records) {
    const rawTxnId = hasCol('transaction_id') ? getField(rec, 'transaction_id') : '';
    const txnId = rawTxnId !== '' ? rawTxnId : null;
    const productName = hasCol('product_name') ? getField(rec, 'product_name') : '';
    const rawQty = hasCol('quantity') ? getField(rec, 'quantity') : '';
    const rawPrice = hasCol('unit_price') ? getField(rec, 'unit_price') : '';
    const rawTotal = hasCol('total_amount') ? getField(rec, 'total_amount') : '';
    const rawDate = hasCol('date') ? getField(rec, 'date') : '';

    // 1. Exact duplicate row detection
    const rowSignature = rec.values.map((v) => v.trim()).join('\u0001');
    const firstSeenRow = seenFullRows.get(rowSignature);
    let isExactDuplicate = false;
    if (firstSeenRow !== undefined) {
      isExactDuplicate = true;
      findings.push({
        id: nextId(),
        issueName: 'Exact Duplicate Row',
        category: 'Duplicate Record',
        columnName: 'all_columns',
        sourceRow: rec.sourceRow,
        transactionId: txnId,
        priority: 'High',
        cellValue: txnId ?? `(row ${rec.sourceRow})`,
        evidence: `Row ${rec.sourceRow} is an exact byte-for-byte field duplicate of source row ${firstSeenRow}.`,
        suggestedReview: `Check POS batch logs to confirm whether row ${rec.sourceRow} is a double-export of row ${firstSeenRow} before excluding from totals.`,
      });
    } else {
      seenFullRows.set(rowSignature, rec.sourceRow);
    }

    // 2. Repeated transaction_id detection (when not already flagged as exact duplicate)
    if (hasCol('transaction_id')) {
      if (rawTxnId === '') {
        findings.push({
          id: nextId(),
          issueName: 'Missing Transaction ID',
          category: 'Missing Value',
          columnName: 'transaction_id',
          sourceRow: rec.sourceRow,
          transactionId: null,
          priority: 'High',
          cellValue: '(blank)',
          evidence: `Source row ${rec.sourceRow} has a blank transaction_id for product "${productName || 'unknown'}".`,
          suggestedReview:
            'Look up the receipt timestamp and register log to trace the missing transaction identifier.',
        });
      } else {
        const prevRows = seenTxnIds.get(rawTxnId) ?? [];
        if (prevRows.length > 0 && !isExactDuplicate) {
          findings.push({
            id: nextId(),
            issueName: 'Repeated Transaction ID',
            category: 'Duplicate Record',
            columnName: 'transaction_id',
            sourceRow: rec.sourceRow,
            transactionId: rawTxnId,
            priority: 'High',
            cellValue: rawTxnId,
            evidence: `Transaction ID "${rawTxnId}" on row ${rec.sourceRow} was previously used on source row ${prevRows.join(', ')} with different line-item details.`,
            suggestedReview:
              'Verify whether this is a multi-line order sharing an invoice ID or an ID collision across registers.',
          });
        }
        seenTxnIds.set(rawTxnId, [...prevRows, rec.sourceRow]);
      }
    }

    // 3. Missing product_name
    if (hasCol('product_name') && productName === '') {
      findings.push({
        id: nextId(),
        issueName: 'Missing Product Name',
        category: 'Missing Value',
        columnName: 'product_name',
        sourceRow: rec.sourceRow,
        transactionId: txnId,
        priority: 'High',
        cellValue: '(blank)',
        evidence: `Source row ${rec.sourceRow} has an empty product_name field.`,
        suggestedReview:
          'Cross-reference the SKU or receipt line item in the POS catalog to restore the missing product name in your working copy.',
      });
    }

    // 4. Quantity validation + statistical anomaly detection
    let parsedQty: number | null = null;
    let plotStatus: QuantityPlotPoint['status'] = 'Normal';

    if (hasCol('quantity')) {
      if (rawQty === '') {
        plotStatus = 'Invalid / Missing';
        findings.push({
          id: nextId(),
          issueName: 'Missing Quantity',
          category: 'Missing Value',
          columnName: 'quantity',
          sourceRow: rec.sourceRow,
          transactionId: txnId,
          priority: 'High',
          cellValue: '(blank)',
          evidence: `Source row ${rec.sourceRow} has a blank quantity for "${productName || 'unknown product'}".`,
          suggestedReview:
            'Review the original customer receipt or divide total_amount by unit_price to confirm the sold unit count.',
        });
      } else {
        parsedQty = parseStrictNumber(rawQty);
        if (parsedQty === null) {
          plotStatus = 'Invalid / Missing';
          findings.push({
            id: nextId(),
            issueName: 'Invalid Numeric Quantity',
            category: 'Invalid Value',
            columnName: 'quantity',
            sourceRow: rec.sourceRow,
            transactionId: txnId,
            priority: 'High',
            cellValue: rawQty,
            evidence: `Quantity value "${rawQty}" on source row ${rec.sourceRow} is not a valid number.`,
            suggestedReview:
              'Inspect the source export for text placeholders or formatting errors and verify the actual unit count.',
          });
        } else if (parsedQty < 0) {
          plotStatus = 'Negative / Zero';
          findings.push({
            id: nextId(),
            issueName: 'Negative Quantity',
            category: 'Negative Value',
            columnName: 'quantity',
            sourceRow: rec.sourceRow,
            transactionId: txnId,
            priority: 'High',
            cellValue: rawQty,
            evidence: `Source row ${rec.sourceRow} records a negative quantity (${parsedQty}).`,
            suggestedReview:
              'Confirm whether this row represents an unlabelled customer return/refund or a sign-entry mistake.',
          });
        } else if (parsedQty === 0) {
          plotStatus = 'Negative / Zero';
          findings.push({
            id: nextId(),
            issueName: 'Zero Quantity',
            category: 'Invalid Value',
            columnName: 'quantity',
            sourceRow: rec.sourceRow,
            transactionId: txnId,
            priority: 'Medium',
            cellValue: rawQty,
            evidence: `Source row ${rec.sourceRow} records quantity = 0.`,
            suggestedReview:
              'Check whether this was a voided/cancelled line item that should be separated from completed sales.',
          });
        } else {
          if (!Number.isInteger(parsedQty)) {
            findings.push({
              id: nextId(),
              issueName: 'Fractional Quantity',
              category: 'Invalid Value',
              columnName: 'quantity',
              sourceRow: rec.sourceRow,
              transactionId: txnId,
              priority: 'Medium',
              cellValue: rawQty,
              evidence: `Source row ${rec.sourceRow} has a decimal quantity (${parsedQty}) for a discrete retail SKU.`,
              suggestedReview:
                'Verify whether the product is sold by weight/length or if the quantity contains a typo.',
            });
          }

          if (
            quantityStats &&
            quantityStats.validCount >= 5 &&
            parsedQty > quantityStats.anomalyThreshold
          ) {
            plotStatus = 'Bulk Anomaly';
            const zScore =
              quantityStats.stdDev > 0
                ? ((parsedQty - quantityStats.mean) / quantityStats.stdDev).toFixed(2)
                : 'N/A';
            const medianRatio =
              quantityStats.median > 0
                ? (parsedQty / quantityStats.median).toFixed(1)
                : 'N/A';

            findings.push({
              id: nextId(),
              issueName: 'Unusual Bulk Quantity',
              category: 'Statistical Anomaly',
              columnName: 'quantity',
              sourceRow: rec.sourceRow,
              transactionId: txnId,
              priority: 'Medium',
              cellValue: rawQty,
              evidence: `Quantity ${parsedQty} exceeds statistical anomaly threshold (${quantityStats.anomalyThreshold}, IQR upper fence ${quantityStats.upperFence}). It is ${medianRatio}x the dataset median (${quantityStats.median}), Z-score: ${zScore}.`,
              suggestedReview:
                'Do not delete automatically—this may be a legitimate wholesale or bulk order. Confirm against purchase order, invoice, or store manager approval.',
            });
          }
        }
      }
    }

    // 5. Unit price validation
    let parsedPrice: number | null = null;
    if (hasCol('unit_price')) {
      if (rawPrice === '') {
        findings.push({
          id: nextId(),
          issueName: 'Missing Unit Price',
          category: 'Missing Value',
          columnName: 'unit_price',
          sourceRow: rec.sourceRow,
          transactionId: txnId,
          priority: 'High',
          cellValue: '(blank)',
          evidence: `Source row ${rec.sourceRow} has a blank unit_price.`,
          suggestedReview:
            'Look up the SKU catalog price effective on the transaction date before finalizing revenue reports.',
        });
      } else {
        parsedPrice = parseStrictNumber(rawPrice);
        if (parsedPrice === null) {
          findings.push({
            id: nextId(),
            issueName: 'Invalid Numeric Unit Price',
            category: 'Invalid Value',
            columnName: 'unit_price',
            sourceRow: rec.sourceRow,
            transactionId: txnId,
            priority: 'High',
            cellValue: rawPrice,
            evidence: `Unit price "${rawPrice}" on source row ${rec.sourceRow} cannot be parsed as a valid decimal number.`,
            suggestedReview:
              'Check the POS export for placeholder strings (such as N/A) or currency symbols and verify the catalog price.',
          });
        } else if (parsedPrice < 0) {
          findings.push({
            id: nextId(),
            issueName: 'Negative Unit Price',
            category: 'Negative Value',
            columnName: 'unit_price',
            sourceRow: rec.sourceRow,
            transactionId: txnId,
            priority: 'High',
            cellValue: rawPrice,
            evidence: `Source row ${rec.sourceRow} records a negative unit_price (${parsedPrice.toFixed(2)}).`,
            suggestedReview:
              'Verify if a discount or credit adjustment was erroneously entered in the unit_price column.',
          });
        } else if (parsedPrice === 0) {
          findings.push({
            id: nextId(),
            issueName: 'Zero Unit Price',
            category: 'Invalid Value',
            columnName: 'unit_price',
            sourceRow: rec.sourceRow,
            transactionId: txnId,
            priority: 'Medium',
            cellValue: rawPrice,
            evidence: `Source row ${rec.sourceRow} has unit_price = 0.00.`,
            suggestedReview:
              'Confirm whether this was an intentional promotional giveaway or a missing price entry.',
          });
        }
      }
    }

    // 6. Total amount validation & arithmetic check
    let parsedTotal: number | null = null;
    let expectedTotal: number | null = null;

    if (hasCol('total_amount')) {
      if (rawTotal === '') {
        findings.push({
          id: nextId(),
          issueName: 'Missing Total Amount',
          category: 'Missing Value',
          columnName: 'total_amount',
          sourceRow: rec.sourceRow,
          transactionId: txnId,
          priority: 'High',
          cellValue: '(blank)',
          evidence: `Source row ${rec.sourceRow} has a blank total_amount.`,
          suggestedReview:
            'Verify the settled payment amount against the POS card/cash tender summary.',
        });
      } else {
        parsedTotal = parseStrictNumber(rawTotal);
        if (parsedTotal === null) {
          findings.push({
            id: nextId(),
            issueName: 'Invalid Numeric Total Amount',
            category: 'Invalid Value',
            columnName: 'total_amount',
            sourceRow: rec.sourceRow,
            transactionId: txnId,
            priority: 'High',
            cellValue: rawTotal,
            evidence: `Total amount "${rawTotal}" on source row ${rec.sourceRow} is not a valid numeric value.`,
            suggestedReview:
              'Check the raw export for malformed characters and reconcile with payment settlement logs.',
          });
        } else if (parsedQty !== null && parsedPrice !== null) {
          expectedTotal = Number((parsedQty * parsedPrice).toFixed(2));
          const diff = Math.abs(parsedTotal - expectedTotal);
          if (diff > 0.02) {
            findings.push({
              id: nextId(),
              issueName: 'Total Amount Mismatch',
              category: 'Total Mismatch',
              columnName: 'total_amount',
              sourceRow: rec.sourceRow,
              transactionId: txnId,
              priority: 'High',
              cellValue: rawTotal,
              evidence: `Recorded total_amount (${parsedTotal.toFixed(2)}) does not match quantity (${parsedQty}) × unit_price (${parsedPrice.toFixed(2)}) = ${expectedTotal.toFixed(2)} (difference: ${diff.toFixed(2)}).`,
              suggestedReview:
                'Check whether an unrecorded discount, tax, or manual override occurred, or if quantity/price was miskeyed.',
            });
          }
        }
      }
    }

    // 7. Date validation
    if (hasCol('date')) {
      if (rawDate === '') {
        findings.push({
          id: nextId(),
          issueName: 'Missing Transaction Date',
          category: 'Missing Value',
          columnName: 'date',
          sourceRow: rec.sourceRow,
          transactionId: txnId,
          priority: 'High',
          cellValue: '(blank)',
          evidence: `Source row ${rec.sourceRow} is missing a transaction date.`,
          suggestedReview:
            'Locate the transaction timestamp in the POS journal to assign the correct accounting period.',
        });
      } else {
        const parsedDate = parseStrictDate(rawDate);
        if (!parsedDate.valid) {
          findings.push({
            id: nextId(),
            issueName: 'Invalid Transaction Date',
            category: 'Date Validation',
            columnName: 'date',
            sourceRow: rec.sourceRow,
            transactionId: txnId,
            priority: 'High',
            cellValue: rawDate,
            evidence: parsedDate.reason ?? `Invalid date "${rawDate}" on row ${rec.sourceRow}.`,
            suggestedReview:
              'Verify the receipt timestamp in the POS system before including this record in daily sales rollups.',
          });
        } else if (
          dominantDateStyle &&
          parsedDate.formatStyle !== dominantDateStyle
        ) {
          findings.push({
            id: nextId(),
            issueName: 'Inconsistent Date Format',
            category: 'Date Validation',
            columnName: 'date',
            sourceRow: rec.sourceRow,
            transactionId: txnId,
            priority: 'Medium',
            cellValue: rawDate,
            evidence: `Date "${rawDate}" uses ${parsedDate.formatStyle.replace(/_/g, ' ')} while the majority of the file uses ${dominantDateStyle.replace(/_/g, ' ')}.`,
            suggestedReview:
              'Confirm month/day order (MM/DD vs DD/MM) to prevent misdated reporting when importing into BI tools.',
          });
        }
      }
    }

    plotPoints.push({
      sourceRow: rec.sourceRow,
      transactionId: txnId ?? `Row ${rec.sourceRow}`,
      productName: productName || '(missing product)',
      quantity: parsedQty,
      rawQuantity: rawQty,
      unitPrice: parsedPrice,
      totalAmount: parsedTotal,
      expectedTotal,
      status: plotStatus,
    });
  }

  // Build summary
  const flaggedRowsSet = new Set(findings.map((f) => f.sourceRow));
  const highPriorityCount = findings.filter((f) => f.priority === 'High').length;
  const mediumPriorityCount = findings.filter((f) => f.priority === 'Medium').length;

  const findingsByCategory: Record<string, { high: number; medium: number }> = {};
  const findingsByColumn: Record<string, { high: number; medium: number }> = {};

  for (const f of findings) {
    if (!findingsByCategory[f.category]) {
      findingsByCategory[f.category] = { high: 0, medium: 0 };
    }
    if (!findingsByColumn[f.columnName]) {
      findingsByColumn[f.columnName] = { high: 0, medium: 0 };
    }
    if (f.priority === 'High') {
      findingsByCategory[f.category].high += 1;
      findingsByColumn[f.columnName].high += 1;
    } else {
      findingsByCategory[f.category].medium += 1;
      findingsByColumn[f.columnName].medium += 1;
    }
  }

  const summary: AuditSummary = {
    totalDataRows: parsed.records.length,
    flaggedRowsCount: flaggedRowsSet.size,
    cleanRowsCount: Math.max(0, parsed.records.length - flaggedRowsSet.size),
    totalFindings: findings.length,
    highPriorityCount,
    mediumPriorityCount,
    findingsByCategory,
    findingsByColumn,
    quantityStats,
  };

  return {
    auditId: auditIdOverride ?? crypto.randomUUID(),
    fileName,
    fileSizeBytes: parsed.fileSizeBytes,
    sha256: parsed.sha256,
    uploadedAt: new Date().toISOString(),
    preservedOriginalLineCount: parsed.totalPhysicalLines,
    headers: parsed.headers,
    formatValidation,
    records: parsed.records,
    findings,
    summary,
    plotPoints,
  };
}
