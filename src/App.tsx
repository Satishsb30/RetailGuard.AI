import { useEffect, useRef, useState } from 'react';
import type {
  AuditResult,
  GeminiAuditBrief,
  SampleDatasetInfo,
} from './types/audit';
import { Sidebar, type WorkspaceTab } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { UploadSchemaView } from './components/UploadSchemaView';
import { FindingsView } from './components/FindingsView';
import { PlotlyChartsView } from './components/PlotlyChartsView';
import { SourceLedgerView } from './components/SourceLedgerView';
import { ExportReportView } from './components/ExportReportView';

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('upload');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [samples, setSamples] = useState<SampleDatasetInfo[]>([]);
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [geminiBrief, setGeminiBrief] = useState<GeminiAuditBrief | null>(null);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiError, setGeminiError] = useState<string | null>(null);

  const topBarFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch('/api/samples')
      .then((res) => res.json())
      .then((data: { samples?: SampleDatasetInfo[] }) => {
        if (Array.isArray(data.samples)) {
          setSamples(data.samples);
        }
      })
      .catch(() => {
        // Non-blocking sample list load
      });
  }, []);

  const handleUploadFile = async (file: File) => {
    setLoading(true);
    setUploadError(null);
    setGeminiBrief(null);
    setGeminiError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze uploaded CSV.');
      }
      setAudit(data as AuditResult);
      setActiveTab('upload');
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Unexpected upload error.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSample = async (sampleId: string) => {
    setLoading(true);
    setUploadError(null);
    setGeminiBrief(null);
    setGeminiError(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sampleId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load sample dataset.');
      }
      setAudit(data as AuditResult);
      setActiveTab('upload');
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Failed to load sample dataset.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateGeminiBrief = async () => {
    if (!audit) return;
    setGeminiLoading(true);
    setGeminiError(null);

    try {
      const response = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auditId: audit.auditId,
          auditResult: audit,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error || 'Failed to generate plain-language Gemini explanations.'
        );
      }
      setGeminiBrief(data as GeminiAuditBrief);
    } catch (err) {
      setGeminiError(
        err instanceof Error ? err.message : 'Gemini explanation request failed.'
      );
    } finally {
      setGeminiLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <input
        ref={topBarFileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUploadFile(file);
          e.target.value = '';
        }}
      />

      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        audit={audit}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          activeTab={activeTab}
          fileName={audit?.fileName ?? null}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onTriggerUpload={() => topBarFileInputRef.current?.click()}
        />

        <main className="flex-1 p-5 sm:p-8 overflow-x-hidden">
          {activeTab === 'upload' && (
            <UploadSchemaView
              samples={samples}
              audit={audit}
              loading={loading}
              error={uploadError}
              onUploadFile={handleUploadFile}
              onLoadSample={handleLoadSample}
              onProceedToFindings={() => setActiveTab('findings')}
            />
          )}

          {activeTab === 'findings' && audit && (
            <FindingsView
              audit={audit}
              geminiBrief={geminiBrief}
              geminiLoading={geminiLoading}
              geminiError={geminiError}
              onGenerateGeminiBrief={handleGenerateGeminiBrief}
            />
          )}

          {activeTab === 'charts' && audit && (
            <PlotlyChartsView audit={audit} />
          )}

          {activeTab === 'ledger' && audit && (
            <SourceLedgerView audit={audit} />
          )}

          {activeTab === 'export' && audit && (
            <ExportReportView audit={audit} geminiBrief={geminiBrief} />
          )}
        </main>
      </div>
    </div>
  );
}
