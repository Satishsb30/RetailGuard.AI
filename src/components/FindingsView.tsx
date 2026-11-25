import { useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Search,
  Sparkles,
} from 'lucide-react';
import type {
  AuditFinding,
  AuditResult,
  FindingPriority,
  GeminiAuditBrief,
} from '../types/audit';

interface FindingsViewProps {
  audit: AuditResult;
  geminiBrief: GeminiAuditBrief | null;
  geminiLoading: boolean;
  geminiError: string | null;
  onGenerateGeminiBrief: () => void;
}

export function FindingsView({
  audit,
  geminiBrief,
  geminiLoading,
  geminiError,
  onGenerateGeminiBrief,
}: FindingsViewProps) {
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | FindingPriority>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(
    audit.findings[0]?.id ?? null
  );

  const categories = useMemo(() => {
    const set = new Set(audit.findings.map((f) => f.category));
    return ['ALL', ...Array.from(set)];
  }, [audit.findings]);

  const explanationMap = useMemo(() => {
    return new Map(
      (geminiBrief?.findingExplanations ?? []).map((item) => [item.findingId, item])
    );
  }, [geminiBrief]);

  const filteredFindings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return audit.findings.filter((f) => {
      if (priorityFilter !== 'ALL' && f.priority !== priorityFilter) return false;
      if (categoryFilter !== 'ALL' && f.category !== categoryFilter) return false;
      if (q) {
        const haystack = [
          f.id,
          f.issueName,
          f.columnName,
          f.transactionId ?? '',
          String(f.sourceRow),
          f.evidence,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [audit.findings, priorityFilter, categoryFilter, searchQuery]);

  const selectedFinding: AuditFinding | null = useMemo(() => {
    return (
      filteredFindings.find((f) => f.id === selectedFindingId) ??
      filteredFindings[0] ??
      null
    );
  }, [filteredFindings, selectedFindingId]);

  const selectedRecord = useMemo(() => {
    if (!selectedFinding) return null;
    return (
      audit.records.find((r) => r.sourceRow === selectedFinding.sourceRow) ?? null
    );
  }, [audit.records, selectedFinding]);

  const selectedAiExplanation = selectedFinding
    ? explanationMap.get(selectedFinding.id)
    : undefined;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Total Records</div>
          <div className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
            {audit.summary.totalDataRows}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            {audit.summary.cleanRowsCount} clean · {audit.summary.flaggedRowsCount} flagged
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">High Priority Findings</div>
          <div className="mt-1 font-display text-2xl font-bold text-red-700 tabular-nums">
            {audit.summary.highPriorityCount}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Immediate verification needed
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Medium Priority Findings</div>
          <div className="mt-1 font-display text-2xl font-bold text-amber-700 tabular-nums">
            {audit.summary.mediumPriorityCount}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Bulk quantities & format checks
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Statistical Quantity Fence</div>
          <div className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
            {audit.summary.quantityStats
              ? `>${audit.summary.quantityStats.anomalyThreshold}`
              : 'N/A'}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            {audit.summary.quantityStats
              ? `Median ${audit.summary.quantityStats.median} · IQR ${audit.summary.quantityStats.iqr}`
              : 'No valid quantities'}
          </div>
        </div>
      </div>

      {/* Gemini Plain-Language Assistant Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Gemini Plain-Language Explanations & Review Plan
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Translates technical validation flags into plain retail language with concrete manual verification steps.
            </p>
          </div>
          <button
            type="button"
            disabled={geminiLoading}
            onClick={onGenerateGeminiBrief}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            {geminiLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>
              {geminiLoading
                ? 'Generating Explanations...'
                : geminiBrief
                  ? 'Refresh Gemini Explanations'
                  : 'Explain Findings with Gemini'}
            </span>
          </button>
        </div>

        {geminiError && (
          <div
            role="alert"
            className="mt-4 p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          >
            <div>
              <p className="font-semibold">Gemini explanation request failed</p>
              <p className="mt-0.5 text-red-800">{geminiError}</p>
            </div>
            <button
              type="button"
              disabled={geminiLoading}
              onClick={onGenerateGeminiBrief}
              className="px-3 py-1.5 text-xs font-medium text-red-800 bg-white border border-red-300 hover:bg-red-100 rounded-md transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
            >
              Retry Request
            </button>
          </div>
        )}

        {geminiBrief && (
          <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
            <div className="text-xs text-slate-500 font-mono">
              Generated with {geminiBrief.model}
            </div>
            <p className="text-sm text-slate-800 leading-relaxed max-w-4xl">
              {geminiBrief.executiveSummary}
            </p>
            {geminiBrief.keyTakeaways.length > 0 && (
              <ul className="space-y-1.5 text-xs text-slate-600 list-disc pl-5">
                {geminiBrief.keyTakeaways.map((item, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {audit.findings.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-700 mx-auto" />
          <h3 className="mt-3 font-display text-base font-semibold text-slate-900">
            No Data Quality Findings Flagged
          </h3>
          <p className="mt-1 text-sm text-slate-600 max-w-md mx-auto">
            Every row in {audit.fileName} passed schema, duplicate, arithmetic, date, and statistical quantity validation.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
                {(['ALL', 'High', 'Medium'] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setPriorityFilter(level)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      priorityFilter === level
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {level === 'ALL'
                      ? `All (${audit.findings.length})`
                      : level === 'High'
                        ? `High (${audit.summary.highPriorityCount})`
                        : `Medium (${audit.summary.mediumPriorityCount})`}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <select
                  aria-label="Filter by issue category"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-700"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat === 'ALL' ? 'All Categories' : cat}
                    </option>
                  ))}
                </select>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Row, TXN ID, issue..."
                    className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-400 w-44 focus-visible:outline-2 focus-visible:outline-blue-700"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="py-2.5 px-3.5 font-semibold whitespace-nowrap">
                      Priority
                    </th>
                    <th className="py-2.5 px-3.5 font-semibold whitespace-nowrap">
                      Row
                    </th>
                    <th className="py-2.5 px-3.5 font-semibold whitespace-nowrap">
                      Transaction ID
                    </th>
                    <th className="py-2.5 px-3.5 font-semibold whitespace-nowrap">
                      Issue
                    </th>
                    <th className="py-2.5 px-3.5 font-semibold whitespace-nowrap">
                      Column
                    </th>
                    <th className="py-2.5 px-3.5 font-semibold whitespace-nowrap">
                      Observed
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredFindings.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-8 text-center text-slate-500 text-xs"
                      >
                        No findings match your active filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredFindings.map((finding) => {
                      const isSelected = selectedFinding?.id === finding.id;
                      return (
                        <tr
                          key={finding.id}
                          onClick={() => setSelectedFindingId(finding.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-2.5 px-3.5 whitespace-nowrap">
                            {finding.priority === 'High' ? (
                              <span className="inline-flex items-center gap-1.5 font-medium text-red-700">
                                <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                                <span>High</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span>Medium</span>
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                            {finding.sourceRow}
                          </td>
                          <td className="py-2.5 px-3.5 font-mono text-slate-800 whitespace-nowrap">
                            {finding.transactionId ?? '—'}
                          </td>
                          <td className="py-2.5 px-3.5 font-medium text-slate-900 whitespace-nowrap">
                            {finding.issueName}
                          </td>
                          <td className="py-2.5 px-3.5 font-mono text-slate-600 whitespace-nowrap">
                            {finding.columnName}
                          </td>
                          <td className="py-2.5 px-3.5 font-mono text-slate-700 max-w-[140px] truncate">
                            {finding.cellValue}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="xl:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-5">
            {selectedFinding ? (
              <>
                <div className="pb-4 border-b border-slate-200">
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                    <span>{selectedFinding.id}</span>
                    <span aria-hidden="true">·</span>
                    <span>Row {selectedFinding.sourceRow}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        selectedFinding.priority === 'High'
                          ? 'text-red-700 font-semibold'
                          : 'text-amber-700 font-semibold'
                      }
                    >
                      {selectedFinding.priority} Priority
                    </span>
                  </div>
                  <h3 className="mt-1 font-display text-base font-semibold text-slate-900">
                    {selectedFinding.issueName}
                  </h3>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <div className="font-semibold text-slate-700">Evidence</div>
                    <p className="mt-1 text-slate-700 leading-relaxed">
                      {selectedFinding.evidence}
                    </p>
                  </div>

                  <div>
                    <div className="font-semibold text-slate-700">
                      Recommended Manual Review
                    </div>
                    <p className="mt-1 text-slate-700 leading-relaxed">
                      {selectedFinding.suggestedReview}
                    </p>
                  </div>

                  {selectedAiExplanation && (
                    <div className="pt-3 border-t border-slate-200 space-y-2.5">
                      <div>
                        <div className="font-semibold text-blue-800">
                          Gemini Plain-Language Explanation
                        </div>
                        <p className="mt-1 text-slate-700 leading-relaxed">
                          {selectedAiExplanation.plainExplanation}
                        </p>
                      </div>
                      <div>
                        <div className="font-semibold text-blue-800">
                          Suggested Next Step
                        </div>
                        <p className="mt-1 text-slate-700 leading-relaxed">
                          {selectedAiExplanation.recommendedAction}
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedRecord && (
                    <div className="pt-3 border-t border-slate-200">
                      <div className="font-semibold text-slate-700 mb-2">
                        Original Source Row {selectedRecord.sourceRow} Context
                      </div>
                      <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                        {audit.headers.map((header, idx) => (
                          <div
                            key={header}
                            className="px-3 py-1.5 flex items-center justify-between gap-2"
                          >
                            <span className="font-mono text-slate-500 truncate">
                              {header}
                            </span>
                            <span
                              className={`font-mono text-right truncate max-w-[180px] ${
                                header.toLowerCase() ===
                                selectedFinding.columnName.toLowerCase()
                                  ? 'font-semibold text-red-700'
                                  : 'text-slate-800'
                              }`}
                            >
                              {selectedRecord.values[idx] || '(blank)'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500">
                Select a finding from the table to inspect evidence and source row context.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
