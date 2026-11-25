import { useState, type DragEvent } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileUp,
  Lock,
} from 'lucide-react';
import {
  REQUIRED_COLUMNS,
  type AuditResult,
  type SampleDatasetInfo,
} from '../types/audit';

interface UploadSchemaViewProps {
  samples: SampleDatasetInfo[];
  audit: AuditResult | null;
  loading: boolean;
  error: string | null;
  onUploadFile: (file: File) => void;
  onLoadSample: (sampleId: string) => void;
  onProceedToFindings: () => void;
}

export function UploadSchemaView({
  samples,
  audit,
  loading,
  error,
  onUploadFile,
  onLoadSample,
  onProceedToFindings,
}: UploadSchemaViewProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onUploadFile(file);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
          Retail Transaction CSV Audit
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 max-w-2xl leading-relaxed">
          Upload a retail sales CSV export to check headers, detect missing values, duplicates, arithmetic mismatches, date errors, and statistical bulk-quantity outliers. Original file bytes are preserved unchanged.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-900"
        >
          <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Unable to process CSV file</p>
            <p className="mt-0.5 text-red-800">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              01. Upload Retail CSV File
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Expected columns: transaction_id, product_name, quantity, unit_price, total_amount, date
            </p>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`mt-4 border border-dashed rounded-lg p-8 text-center transition-colors duration-150 ${
              isDragging
                ? 'border-blue-600 bg-blue-50/60'
                : 'border-slate-300 bg-slate-50/60 hover:border-slate-400'
            }`}
          >
            <FileUp className="w-8 h-8 mx-auto text-slate-400" />
            <p className="mt-3 text-sm font-medium text-slate-900">
              Drop a retail transaction CSV here, or browse from your computer
            </p>
            <p className="mt-1 text-xs text-slate-500">
              UTF-8 CSV up to 5 MB · Exact source bytes and row numbers preserved
            </p>
            <label className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer transition-colors duration-150 whitespace-nowrap">
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUploadFile(file);
                  e.target.value = '';
                }}
              />
              <span>{loading ? 'Analyzing CSV...' : 'Select CSV File'}</span>
            </label>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Sample Retail Exports
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Load a curated POS dataset to inspect validation rules and Gemini explanations.
            </p>

            <div className="mt-4 divide-y divide-slate-200 border-t border-slate-200">
              {samples.map((sample) => (
                <div key={sample.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {sample.name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
                      {sample.description}
                    </p>
                    <p className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
                      {sample.fileName} · {sample.rowCount} rows
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => onLoadSample(sample.id)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-blue-700 disabled:opacity-50"
                  >
                    Load
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {audit && (
        <>
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Lock className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>Original CSV Preserved Read-Only</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {audit.fileSizeBytes.toLocaleString()} bytes
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">
                    SHA-256 {audit.sha256.slice(0, 12)}…
                  </span>
                </div>
                <h2 className="mt-1 font-display text-lg font-semibold text-slate-900">
                  02. Format & Header Validation — {audit.fileName}
                </h2>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <a
                  href={`/api/original/${audit.auditId}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Original CSV</span>
                </a>
                <button
                  type="button"
                  onClick={onProceedToFindings}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap"
                >
                  <span>Review {audit.summary.totalFindings} Findings</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xs font-semibold text-slate-700 mb-3">
                  Required Column Mapping (6 Standard Fields)
                </h3>
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-200">
                  {REQUIRED_COLUMNS.map((col) => {
                    const matched = audit.formatValidation.normalizedHeaderMap[col];
                    return (
                      <div
                        key={col}
                        className="px-3.5 py-2.5 flex items-center justify-between text-xs"
                      >
                        <span className="font-mono text-slate-800">{col}</span>
                        {matched ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>
                              {matched === col ? 'Matched' : `Mapped (${matched})`}
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-red-700 font-medium">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Missing</span>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-700 mb-3">
                  Format Diagnostics
                </h3>
                {audit.formatValidation.errors.length === 0 ? (
                  <div className="p-4 border border-emerald-200 bg-emerald-50/60 rounded-lg flex items-start gap-2.5 text-xs text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">All headers and row widths valid</p>
                      <p className="mt-0.5 text-emerald-800">
                        Detected {audit.headers.length} required headers across {audit.summary.totalDataRows} transaction rows with consistent column counts.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-200">
                    {audit.formatValidation.errors.map((err, idx) => (
                      <div
                        key={`${err.code}-${idx}`}
                        className="px-3.5 py-2.5 flex items-start gap-2.5 text-xs"
                      >
                        {err.code === 'UNEXPECTED_COLUMN' ||
                        err.code === 'HEADER_CASING_MISMATCH' ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                        )}
                        <span className="text-slate-700 leading-relaxed">
                          {err.message}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Uploaded Records Preview
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  Showing first {Math.min(10, audit.records.length)} of {audit.records.length} data rows · Source row numbers preserved from original CSV
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="py-2.5 px-4 font-semibold whitespace-nowrap">
                      Source Row
                    </th>
                    {audit.headers.map((header) => (
                      <th
                        key={header}
                        className="py-2.5 px-4 font-mono font-semibold whitespace-nowrap"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {audit.records.slice(0, 10).map((rec) => (
                    <tr
                      key={rec.sourceRow}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-2.5 px-4 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                        Row {rec.sourceRow}
                      </td>
                      {audit.headers.map((header, idx) => {
                        const val = rec.values[idx] ?? '';
                        const isNumericHeader = /qty|quantity|price|total|amount/i.test(
                          header
                        );
                        return (
                          <td
                            key={`${rec.sourceRow}-${idx}`}
                            className={`py-2.5 px-4 whitespace-nowrap ${
                              isNumericHeader ? 'font-mono tabular-nums' : ''
                            } ${val.trim() === '' ? 'text-red-600 italic' : 'text-slate-800'}`}
                          >
                            {val.trim() === '' ? '(blank)' : val}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
