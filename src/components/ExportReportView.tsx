import { useMemo } from 'react';
import { Download, FileCode2, FileSpreadsheet, FileText, Lock } from 'lucide-react';
import type { AuditResult, GeminiAuditBrief } from '../types/audit';
import {
  buildAuditJsonReport,
  buildAuditMarkdownReport,
  buildFindingsReportCsv,
  triggerTextDownload,
} from '../utils/reportExport';

interface ExportReportViewProps {
  audit: AuditResult;
  geminiBrief: GeminiAuditBrief | null;
}

export function ExportReportView({ audit, geminiBrief }: ExportReportViewProps) {
  const baseName = audit.fileName.replace(/\.csv$/i, '');

  const markdownPreview = useMemo(
    () => buildAuditMarkdownReport(audit, geminiBrief),
    [audit, geminiBrief]
  );

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="font-display text-xl font-bold text-slate-900">
          Downloadable Data Quality Reports
        </h1>
        <p className="mt-1 text-xs text-slate-500 max-w-2xl leading-relaxed">
          Export prioritized findings, statistical evidence, and Gemini plain-language recommendations, or download the exact original CSV file byte-for-byte unchanged.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <FileSpreadsheet className="w-5 h-5 text-blue-700" />
            <h2 className="mt-3 font-display text-sm font-semibold text-slate-900">
              Findings CSV Report
            </h2>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              Spreadsheet-ready table of every High and Medium finding with source row, evidence, and Gemini review notes.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              triggerTextDownload(
                buildFindingsReportCsv(audit, geminiBrief),
                `${baseName}_quality_findings.csv`,
                'text/csv;charset=utf-8'
              )
            }
            className="mt-4 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <FileText className="w-5 h-5 text-slate-700" />
            <h2 className="mt-3 font-display text-sm font-semibold text-slate-900">
              Markdown Audit Brief
            </h2>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              Human-readable review dossier summarizing metrics, statistical fences, and manual verification actions.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              triggerTextDownload(
                markdownPreview,
                `${baseName}_audit_report.md`,
                'text/markdown;charset=utf-8'
              )
            }
            className="mt-4 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Markdown</span>
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <FileCode2 className="w-5 h-5 text-slate-700" />
            <h2 className="mt-3 font-display text-sm font-semibold text-slate-900">
              Structured JSON Audit
            </h2>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              Machine-readable audit payload with schema validation, checksums, and findings for downstream BI pipelines.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              triggerTextDownload(
                buildAuditJsonReport(audit, geminiBrief),
                `${baseName}_audit_report.json`,
                'application/json;charset=utf-8'
              )
            }
            className="mt-4 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download JSON</span>
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <Lock className="w-5 h-5 text-emerald-700" />
            <h2 className="mt-3 font-display text-sm font-semibold text-slate-900">
              Preserved Original CSV
            </h2>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              Exact untouched source bytes ({audit.fileSizeBytes.toLocaleString()} B · SHA-256 {audit.sha256.slice(0, 8)}…).
            </p>
          </div>
          <a
            href={`/api/original/${audit.auditId}`}
            className="mt-4 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Original</span>
          </a>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-slate-900">
            Audit Report Preview
          </h2>
          <span className="text-xs text-slate-500 font-mono">
            {geminiBrief ? 'Includes Gemini Explanations' : 'Rule & Statistical Summary'}
          </span>
        </div>
        <pre className="p-5 text-xs font-mono text-slate-700 whitespace-pre-wrap overflow-x-auto max-h-[420px] leading-relaxed bg-slate-50/50">
          {markdownPreview}
        </pre>
      </div>
    </div>
  );
}
