import type { AuditResult, GeminiAuditBrief } from '../types/audit';

/**
 * Neutralizes spreadsheet formula injection (CWE-1236) on generated audit report CSV cells
 * without affecting the untouched original CSV download served by the backend.
 */
function escapeReportCsvCell(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function buildFindingsReportCsv(
  audit: AuditResult,
  brief: GeminiAuditBrief | null
): string {
  const explanationMap = new Map(
    (brief?.findingExplanations ?? []).map((item) => [item.findingId, item])
  );

  const headers = [
    'finding_id',
    'priority',
    'issue_name',
    'category',
    'column_name',
    'source_row',
    'transaction_id',
    'observed_value',
    'evidence',
    'suggested_review',
    'gemini_plain_explanation',
    'gemini_recommended_action',
  ];

  const rows = audit.findings.map((f) => {
    const ai = explanationMap.get(f.id);
    return [
      f.id,
      f.priority,
      f.issueName,
      f.category,
      f.columnName,
      f.sourceRow,
      f.transactionId ?? '',
      f.cellValue,
      f.evidence,
      f.suggestedReview,
      ai?.plainExplanation ?? '',
      ai?.recommendedAction ?? '',
    ]
      .map(escapeReportCsvCell)
      .join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export function buildAuditMarkdownReport(
  audit: AuditResult,
  brief: GeminiAuditBrief | null
): string {
  const lines: string[] = [
    `# RetailGuard AI — Data Quality Audit Report`,
    ``,
    `- **Source File:** ${audit.fileName}`,
    `- **Original File Size:** ${audit.fileSizeBytes.toLocaleString()} bytes`,
    `- **Original SHA-256 Checksum:** \`${audit.sha256}\``,
    `- **Audit Timestamp:** ${audit.uploadedAt}`,
    `- **Data Preservation Guarantee:** Original uploaded CSV bytes were preserved unchanged; zero records were modified or deleted.`,
    ``,
    `## Summary Metrics`,
    ``,
    `| Metric | Value |`,
    `| --- | ---: |`,
    `| Total Data Rows | ${audit.summary.totalDataRows} |`,
    `| Clean Rows | ${audit.summary.cleanRowsCount} |`,
    `| Flagged Rows | ${audit.summary.flaggedRowsCount} |`,
    `| Total Findings | ${audit.summary.totalFindings} |`,
    `| High Priority Findings | ${audit.summary.highPriorityCount} |`,
    `| Medium Priority Findings | ${audit.summary.mediumPriorityCount} |`,
    ``,
  ];

  if (audit.summary.quantityStats) {
    const q = audit.summary.quantityStats;
    lines.push(
      `## Statistical Quantity Distribution`,
      ``,
      `- **Valid Positive Quantity Records:** ${q.validCount}`,
      `- **Median:** ${q.median} · **Mean:** ${q.mean} · **Std Dev:** ${q.stdDev}`,
      `- **Q1 / Q3 / IQR:** ${q.q1} / ${q.q3} / ${q.iqr}`,
      `- **IQR Upper Fence:** ${q.upperFence} · **Bulk Anomaly Threshold:** ${q.anomalyThreshold}`,
      ``
    );
  }

  if (brief) {
    lines.push(
      `## Gemini Plain-Language Executive Summary`,
      ``,
      brief.executiveSummary,
      ``
    );
    if (brief.keyTakeaways.length > 0) {
      lines.push(`### Key Takeaways`, ``);
      for (const t of brief.keyTakeaways) {
        lines.push(`- ${t}`);
      }
      lines.push(``);
    }
  }

  const explanationMap = new Map(
    (brief?.findingExplanations ?? []).map((item) => [item.findingId, item])
  );

  lines.push(`## Prioritized Findings`, ``);
  if (audit.findings.length === 0) {
    lines.push(`No data quality issues were flagged in this dataset.`);
  } else {
    for (const f of audit.findings) {
      const ai = explanationMap.get(f.id);
      lines.push(
        `### ${f.id} — ${f.issueName} (${f.priority} Priority)`,
        `- **Source Row:** ${f.sourceRow} · **Column:** \`${f.columnName}\` · **Transaction ID:** ${f.transactionId ?? 'N/A'}`,
        `- **Observed Value:** \`${f.cellValue}\``,
        `- **Evidence:** ${f.evidence}`,
        `- **Suggested Review:** ${f.suggestedReview}`
      );
      if (ai) {
        lines.push(
          `- **Plain-Language Explanation:** ${ai.plainExplanation}`,
          `- **Recommended Verification Action:** ${ai.recommendedAction}`
        );
      }
      lines.push(``);
    }
  }

  return lines.join('\n');
}

export function buildAuditJsonReport(
  audit: AuditResult,
  brief: GeminiAuditBrief | null
): string {
  return JSON.stringify(
    {
      reportGeneratedAt: new Date().toISOString(),
      sourcePreservation: {
        fileName: audit.fileName,
        fileSizeBytes: audit.fileSizeBytes,
        sha256: audit.sha256,
        originalRecordsModified: false,
      },
      formatValidation: audit.formatValidation,
      summary: audit.summary,
      geminiBrief: brief,
      findings: audit.findings,
    },
    null,
    2
  );
}

export function triggerTextDownload(
  content: string,
  fileName: string,
  mimeType: string
) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
