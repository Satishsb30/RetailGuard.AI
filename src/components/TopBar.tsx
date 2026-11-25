import { Menu, Upload } from 'lucide-react';
import type { WorkspaceTab } from './Sidebar';

interface TopBarProps {
  activeTab: WorkspaceTab;
  fileName: string | null;
  onOpenMobileMenu: () => void;
  onTriggerUpload: () => void;
}

const TAB_LABELS: Record<WorkspaceTab, string> = {
  upload: 'CSV Upload & Format Validation',
  findings: 'Audit Findings & Gemini Review',
  charts: 'Plotly Visual Analytics',
  ledger: 'Read-Only Source CSV Ledger',
  export: 'Downloadable Quality Reports',
};

export function TopBar({
  activeTab,
  fileName,
  onOpenMobileMenu,
  onTriggerUpload,
}: TopBarProps) {
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-8 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-md focus-visible:outline-2 focus-visible:outline-blue-700"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-sm min-w-0"
        >
          <span className="font-display font-semibold text-slate-900 whitespace-nowrap shrink-0">
            RetailGuard AI
          </span>
          <span className="text-slate-300 shrink-0" aria-hidden="true">
            /
          </span>
          <span className="text-slate-600 truncate">
            {TAB_LABELS[activeTab]}
          </span>
          {fileName && (
            <>
              <span
                className="hidden md:inline text-slate-300 shrink-0"
                aria-hidden="true"
              >
                /
              </span>
              <span className="hidden md:inline font-mono text-xs text-slate-500 truncate max-w-[220px]">
                {fileName}
              </span>
            </>
          )}
        </nav>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onTriggerUpload}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          <Upload className="w-4 h-4 shrink-0" />
          <span>Upload CSV</span>
        </button>
      </div>
    </header>
  );
}
