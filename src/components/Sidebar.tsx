import type { ComponentType } from 'react';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  ShieldAlert,
  Table2,
  X,
} from 'lucide-react';
import type { AuditResult } from '../types/audit';

export type WorkspaceTab = 'upload' | 'findings' | 'charts' | 'ledger' | 'export';

interface SidebarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  audit: AuditResult | null;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  id: WorkspaceTab;
  label: string;
  step: string;
  icon: ComponentType<{ className?: string }>;
  requiresAudit?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'upload',
    label: 'Upload & Format',
    step: 'Steps 1–2',
    icon: FileSpreadsheet,
  },
  {
    id: 'findings',
    label: 'Findings & AI Review',
    step: 'Steps 3–4',
    icon: ShieldAlert,
    requiresAudit: true,
  },
  {
    id: 'charts',
    label: 'Plotly Analytics',
    step: 'Visuals',
    icon: BarChart3,
    requiresAudit: true,
  },
  {
    id: 'ledger',
    label: 'Source CSV Ledger',
    step: 'Read-Only',
    icon: Table2,
    requiresAudit: true,
  },
  {
    id: 'export',
    label: 'Export Report',
    step: 'Download',
    icon: Download,
    requiresAudit: true,
  },
];

export function Sidebar({
  activeTab,
  onSelectTab,
  audit,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const navContent = (
    <div className="flex h-full flex-col justify-between bg-white border-r border-slate-200">
      <div>
        <div className="flex items-center justify-between px-5 h-16 border-b border-slate-200">
          <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
            RetailGuard AI
          </span>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-2 text-slate-500 hover:text-slate-900 rounded-md focus-visible:outline-2 focus-visible:outline-blue-700"
            aria-label="Close navigation menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="p-3 space-y-1" aria-label="Audit workflow">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const disabled = Boolean(item.requiresAudit && !audit);
            const active = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-blue-700 ${
                  active
                    ? 'bg-blue-50 text-blue-800 font-semibold'
                    : disabled
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      active
                        ? 'text-blue-700'
                        : disabled
                          ? 'text-slate-300'
                          : 'text-slate-500'
                    }`}
                  />
                  <span className="text-sm truncate whitespace-nowrap">
                    {item.label}
                  </span>
                </span>
                <span
                  className={`text-xs tabular-nums shrink-0 ml-2 ${
                    active ? 'text-blue-700' : 'text-slate-400'
                  }`}
                >
                  {item.id === 'findings' && audit
                    ? `${audit.summary.totalFindings}`
                    : item.step}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-200 space-y-2.5">
        {audit ? (
          <>
            <div className="text-xs font-medium text-slate-900 truncate">
              {audit.fileName}
            </div>
            <div className="text-xs text-slate-500 tabular-nums space-y-1">
              <div className="flex justify-between">
                <span>Rows</span>
                <span className="font-mono text-slate-700">
                  {audit.summary.totalDataRows}
                </span>
              </div>
              <div className="flex justify-between">
                <span>High priority</span>
                <span className="font-mono font-medium text-red-700">
                  {audit.summary.highPriorityCount}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Medium priority</span>
                <span className="font-mono font-medium text-amber-700">
                  {audit.summary.mediumPriorityCount}
                </span>
              </div>
              <div className="flex justify-between">
                <span>SHA-256</span>
                <span className="font-mono text-slate-600">
                  {audit.sha256.slice(0, 8)}
                </span>
              </div>
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-500 leading-relaxed">
            Upload a retail sales CSV or load a sample export to begin auditing. Original bytes are preserved untouched.
          </p>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-[260px] shrink-0">{navContent}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative w-[260px] max-w-[85vw] h-full z-50">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
