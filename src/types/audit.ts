export type FindingPriority = 'High' | 'Medium';

export type RequiredColumn =
  | 'transaction_id'
  | 'product_name'
  | 'quantity'
  | 'unit_price'
  | 'total_amount'
  | 'date';

export const REQUIRED_COLUMNS: readonly RequiredColumn[] = [
  'transaction_id',
  'product_name',
  'quantity',
  'unit_price',
  'total_amount',
  'date',
] as const;

export interface ParsedCsvRecord {
  sourceRow: number; // 1-based CSV line number (Header is Row 1, first data record is Row 2)
  values: string[];
  rawFieldsByColumn: Record<string, string>;
  columnCountMismatch: boolean;
}

export interface FormatError {
  code:
    | 'EMPTY_FILE'
    | 'NO_HEADERS'
    | 'MISSING_REQUIRED_COLUMN'
    | 'UNEXPECTED_COLUMN'
    | 'HEADER_CASING_MISMATCH'
    | 'ROW_COLUMN_MISMATCH';
  message: string;
  columnName?: string;
  sourceRow?: number;
}

export interface FormatValidationResult {
  isValidStructure: boolean;
  canRunRecordAudit: boolean;
  detectedHeaders: string[];
  normalizedHeaderMap: Record<string, string>; // requiredColumn -> actual header name found
  missingRequiredColumns: string[];
  unexpectedColumns: string[];
  errors: FormatError[];
}

export interface AuditFinding {
  id: string;
  issueName: string;
  category:
    | 'Missing Value'
    | 'Duplicate Record'
    | 'Invalid Value'
    | 'Negative Value'
    | 'Statistical Anomaly'
    | 'Total Mismatch'
    | 'Date Validation'
    | 'Format Error';
  columnName: string;
  sourceRow: number;
  transactionId: string | null;
  priority: FindingPriority;
  cellValue: string;
  evidence: string;
  suggestedReview: string;
}

export interface QuantityStats {
  validCount: number;
  mean: number;
  stdDev: number;
  median: number;
  q1: number;
  q3: number;
  iqr: number;
  upperFence: number;
  mad: number;
  anomalyThreshold: number;
}

export interface QuantityPlotPoint {
  sourceRow: number;
  transactionId: string;
  productName: string;
  quantity: number | null;
  rawQuantity: string;
  unitPrice: number | null;
  totalAmount: number | null;
  expectedTotal: number | null;
  status: 'Normal' | 'Bulk Anomaly' | 'Negative / Zero' | 'Invalid / Missing';
}

export interface AuditSummary {
  totalDataRows: number;
  flaggedRowsCount: number;
  cleanRowsCount: number;
  totalFindings: number;
  highPriorityCount: number;
  mediumPriorityCount: number;
  findingsByCategory: Record<string, { high: number; medium: number }>;
  findingsByColumn: Record<string, { high: number; medium: number }>;
  quantityStats: QuantityStats | null;
}

export interface AuditResult {
  auditId: string;
  fileName: string;
  fileSizeBytes: number;
  sha256: string;
  uploadedAt: string;
  preservedOriginalLineCount: number;
  headers: string[];
  formatValidation: FormatValidationResult;
  records: ParsedCsvRecord[];
  findings: AuditFinding[];
  summary: AuditSummary;
  plotPoints: QuantityPlotPoint[];
}

export interface GeminiFindingExplanation {
  findingId: string;
  plainExplanation: string;
  recommendedAction: string;
}

export interface GeminiAuditBrief {
  generatedAt: string;
  model: string;
  executiveSummary: string;
  keyTakeaways: string[];
  findingExplanations: GeminiFindingExplanation[];
}

export interface SampleDatasetInfo {
  id: string;
  name: string;
  fileName: string;
  description: string;
  rowCount: number;
}
