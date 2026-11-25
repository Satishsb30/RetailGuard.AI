import { useMemo, useState } from 'react';
import { Lock, Search } from 'lucide-react';
import type { AuditFinding, AuditResult } from '../types/audit';

interface SourceLedgerViewProps {
  audit: AuditResult;
}

export function SourceLedgerView({ audit }: SourceLedgerViewProps) {
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [query, setQuery] = useState('');

  const findingsByRow = useMemo(() => {
    const map = new Map<number, AuditFinding[]>();
    for (const f of audit.findings) {
      const list = map.get(f.sourceRow) ?? [];
      list.push(f);
      map.set(f.sourceRow, list);
    }
    return map;
  }, [audit.findings]);

  const visibleRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    return audit.records.filter((rec) => {
      const rowFindings = findingsByRow.get(rec.sourceRow) ?? [];
      if (onlyFlagged && rowFindings.length === 0) return false;
      if (q) {
        const text = `row ${rec.sourceRow} ${rec.values.join(' ')}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [audit.records, findingsByRow, onlyFlagged, query]);

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Lock className="w-3.5 h-3.5 text-emerald-700" />
            <span>Read-Only Original Source View</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">SHA-256 {audit.sha256.slice(0, 12)}…</span>
          </div>
          <h1 className="mt-1 font-display text-xl font-bold text-slate-900">
            Source CSV Ledger
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setOnlyFlagged(false)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                !onlyFlagged
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Rows ({audit.records.length})
            </button>
            <button
              type="button"
              onClick={() => setOnlyFlagged(true)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                onlyFlagged
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Flagged ({audit.summary.flaggedRowsCount})
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ledger..."
              className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-400 w-44 focus-visible:outline-2 focus-visible:outline-blue-700"
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="py-2.5 px-3.5 font-semibold whitespace-nowrap">
                  Row
                </th>
                <th className="py-2.5 px-3.5 font-semibold whitespace-nowrap">
                  Audit Status
                </th>
                {audit.headers.map((header) => (
                  <th
                    key={header}
                    className="py-2.5 px-3.5 font-mono font-semibold whitespace-nowrap"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visibleRecords.map((rec) => {
                const rowFindings = findingsByRow.get(rec.sourceRow) ?? [];
                const hasHigh = rowFindings.some((f) => f.priority === 'High');
                const hasMed = rowFindings.some((f) => f.priority === 'Medium');

                return (
                  <tr
                    key={rec.sourceRow}
                    className={
                      hasHigh
                        ? 'bg-red-50/40'
                        : hasMed
                          ? 'bg-amber-50/40'
                          : 'hover:bg-slate-50'
                    }
                  >
                    <td className="py-2.5 px-3.5 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {rec.sourceRow}
                    </td>
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      {rowFindings.length === 0 ? (
                        <span className="text-emerald-700 font-medium">Verified</span>
                      ) : (
                        <span
                          className={`font-medium ${
                            hasHigh ? 'text-red-700' : 'text-amber-700'
                          }`}
                          title={rowFindings.map((f) => f.issueName).join(', ')}
                        >
                          {rowFindings.map((f) => f.issueName).join(' · ')}
                        </span>
                      )}
                    </td>
                    {audit.headers.map((header, idx) => {
                      const val = rec.values[idx] ?? '';
                      const cellFlag = rowFindings.find(
                        (f) =>
                          f.columnName.toLowerCase() === header.toLowerCase() ||
                          f.columnName === 'all_columns'
                      );
                      const isNumericHeader = /qty|quantity|price|total|amount/i.test(
                        header
                      );

                      return (
                        <td
                          key={`${rec.sourceRow}-${idx}`}
                          className={`py-2.5 px-3.5 whitespace-nowrap ${
                            isNumericHeader ? 'font-mono tabular-nums' : ''
                          } ${
                            cellFlag
                              ? cellFlag.priority === 'High'
                                ? 'font-semibold text-red-800 bg-red-100/50'
                                : 'font-semibold text-amber-800 bg-amber-100/60'
                              : val.trim() === ''
                                ? 'text-slate-400 italic'
                                : 'text-slate-800'
                          }`}
                        >
                          {val.trim() === '' ? '(blank)' : val}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
