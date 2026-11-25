import { useEffect, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';
import type { AuditResult } from '../types/audit';

interface PlotlyChartsViewProps {
  audit: AuditResult;
}

export function PlotlyChartsView({ audit }: PlotlyChartsViewProps) {
  const qtyChartRef = useRef<HTMLDivElement | null>(null);
  const categoryChartRef = useRef<HTMLDivElement | null>(null);
  const totalChartRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = qtyChartRef.current;
    if (!el) return;

    const normalPts = audit.plotPoints.filter(
      (p) => p.status === 'Normal' && p.quantity !== null
    );
    const bulkPts = audit.plotPoints.filter(
      (p) => p.status === 'Bulk Anomaly' && p.quantity !== null
    );
    const negPts = audit.plotPoints.filter(
      (p) => p.status === 'Negative / Zero' && p.quantity !== null
    );

    const traces: unknown[] = [
      {
        x: normalPts.map((p) => p.sourceRow),
        y: normalPts.map((p) => p.quantity),
        text: normalPts.map(
          (p) => `Row ${p.sourceRow} · ${p.transactionId}<br>${p.productName}<br>Qty: ${p.quantity}`
        ),
        hoverinfo: 'text',
        mode: 'markers',
        type: 'scatter',
        name: 'Normal Quantity',
        marker: { color: '#1D4ED8', size: 8, opacity: 0.85 },
      },
      {
        x: bulkPts.map((p) => p.sourceRow),
        y: bulkPts.map((p) => p.quantity),
        text: bulkPts.map(
          (p) =>
            `Row ${p.sourceRow} · ${p.transactionId}<br>${p.productName}<br>Bulk Qty: ${p.quantity} (Review)`
        ),
        hoverinfo: 'text',
        mode: 'markers',
        type: 'scatter',
        name: 'Bulk Anomaly (Medium)',
        marker: {
          color: '#D97706',
          size: 13,
          symbol: 'diamond',
          line: { color: '#92400E', width: 1.5 },
        },
      },
      {
        x: negPts.map((p) => p.sourceRow),
        y: negPts.map((p) => p.quantity),
        text: negPts.map(
          (p) =>
            `Row ${p.sourceRow} · ${p.transactionId}<br>${p.productName}<br>Qty: ${p.quantity} (Flagged)`
        ),
        hoverinfo: 'text',
        mode: 'markers',
        type: 'scatter',
        name: 'Negative / Zero (High)',
        marker: { color: '#DC2626', size: 11, symbol: 'x' },
      },
    ];

    const shapes: unknown[] = [];
    const annotations: unknown[] = [];
    if (audit.summary.quantityStats) {
      const thresh = audit.summary.quantityStats.anomalyThreshold;
      shapes.push({
        type: 'line',
        xref: 'paper',
        x0: 0,
        x1: 1,
        yref: 'y',
        y0: thresh,
        y1: thresh,
        line: { color: '#D97706', width: 1.5, dash: 'dash' },
      });
      annotations.push({
        xref: 'paper',
        x: 0.01,
        yref: 'y',
        y: thresh,
        text: `Bulk Threshold (${thresh})`,
        showarrow: false,
        yshift: 10,
        font: { size: 11, color: '#92400E', family: 'IBM Plex Mono, monospace' },
      });
    }

    Plotly.react(
      el,
      traces,
      {
        margin: { t: 24, r: 20, b: 44, l: 54 },
        font: { family: 'Public Sans, sans-serif', size: 12, color: '#334155' },
        paper_bgcolor: '#FFFFFF',
        plot_bgcolor: '#FFFFFF',
        xaxis: {
          title: 'Source CSV Row Number',
          gridcolor: '#F1F5F9',
          zeroline: false,
        },
        yaxis: {
          title: 'Transaction Quantity',
          gridcolor: '#F1F5F9',
          zerolinecolor: '#CBD5E1',
        },
        legend: { orientation: 'h', y: 1.12, x: 0 },
        shapes,
        annotations,
      },
      { responsive: true, displaylogo: false }
    );

    const handleResize = () => {
      if (qtyChartRef.current) Plotly.Plots.resize(qtyChartRef.current);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      Plotly.purge(el);
    };
  }, [audit]);

  useEffect(() => {
    const el = categoryChartRef.current;
    if (!el) return;

    const categories = Object.keys(audit.summary.findingsByCategory);
    const highCounts = categories.map(
      (c) => audit.summary.findingsByCategory[c].high
    );
    const medCounts = categories.map(
      (c) => audit.summary.findingsByCategory[c].medium
    );

    const traces =
      categories.length === 0
        ? []
        : [
            {
              x: categories,
              y: highCounts,
              name: 'High Priority',
              type: 'bar',
              marker: { color: '#DC2626' },
            },
            {
              x: categories,
              y: medCounts,
              name: 'Medium Priority',
              type: 'bar',
              marker: { color: '#D97706' },
            },
          ];

    Plotly.react(
      el,
      traces,
      {
        barmode: 'stack',
        margin: { t: 24, r: 20, b: 70, l: 48 },
        font: { family: 'Public Sans, sans-serif', size: 12, color: '#334155' },
        paper_bgcolor: '#FFFFFF',
        plot_bgcolor: '#FFFFFF',
        xaxis: { gridcolor: '#F1F5F9', tickangle: -18 },
        yaxis: { title: 'Flagged Findings', gridcolor: '#F1F5F9', dtick: 1 },
        legend: { orientation: 'h', y: 1.12, x: 0 },
      },
      { responsive: true, displaylogo: false }
    );

    const handleResize = () => {
      if (categoryChartRef.current) Plotly.Plots.resize(categoryChartRef.current);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      Plotly.purge(el);
    };
  }, [audit]);

  useEffect(() => {
    const el = totalChartRef.current;
    if (!el) return;

    const mismatches = audit.plotPoints.filter(
      (p) =>
        p.totalAmount !== null &&
        p.expectedTotal !== null &&
        Math.abs(p.totalAmount - p.expectedTotal) > 0.02
    );

    const labels = mismatches.map((p) => `Row ${p.sourceRow} (${p.transactionId})`);
    const traces =
      mismatches.length === 0
        ? []
        : [
            {
              x: labels,
              y: mismatches.map((p) => p.totalAmount),
              name: 'Recorded Total',
              type: 'bar',
              marker: { color: '#DC2626' },
            },
            {
              x: labels,
              y: mismatches.map((p) => p.expectedTotal),
              name: 'Expected (Qty × Price)',
              type: 'bar',
              marker: { color: '#1D4ED8' },
            },
          ];

    Plotly.react(
      el,
      traces,
      {
        barmode: 'group',
        margin: { t: 24, r: 20, b: 56, l: 54 },
        font: { family: 'Public Sans, sans-serif', size: 12, color: '#334155' },
        paper_bgcolor: '#FFFFFF',
        plot_bgcolor: '#FFFFFF',
        xaxis: { gridcolor: '#F1F5F9' },
        yaxis: { title: 'Amount ($)', gridcolor: '#F1F5F9' },
        legend: { orientation: 'h', y: 1.12, x: 0 },
      },
      { responsive: true, displaylogo: false }
    );

    const handleResize = () => {
      if (totalChartRef.current) Plotly.Plots.resize(totalChartRef.current);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      Plotly.purge(el);
    };
  }, [audit]);

  const mismatchCount = audit.plotPoints.filter(
    (p) =>
      p.totalAmount !== null &&
      p.expectedTotal !== null &&
      Math.abs(p.totalAmount - p.expectedTotal) > 0.02
  ).length;

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="font-display text-xl font-bold text-slate-900">
          Plotly Anomaly & Distribution Analytics
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Interactive Plotly visualizations inspecting quantity outliers, priority distribution, and arithmetic discrepancies across {audit.fileName}.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
          <div className="mb-3">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Quantity Distribution & Bulk Anomaly Detection
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              {audit.summary.quantityStats
                ? `Median ${audit.summary.quantityStats.median} · Q3 ${audit.summary.quantityStats.q3} · IQR Upper Fence ${audit.summary.quantityStats.upperFence} · Threshold ${audit.summary.quantityStats.anomalyThreshold}`
                : 'No numeric quantity distribution available'}
            </p>
          </div>
          <div ref={qtyChartRef} className="w-full h-[340px]" />
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5">
          <div className="mb-3">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Findings by Issue Category & Priority
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              {audit.summary.highPriorityCount} High · {audit.summary.mediumPriorityCount} Medium
            </p>
          </div>
          {audit.summary.totalFindings === 0 ? (
            <div className="h-[340px] flex items-center justify-center text-xs text-slate-500">
              Zero findings in this dataset — all checks nominal.
            </div>
          ) : (
            <div ref={categoryChartRef} className="w-full h-[340px]" />
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="mb-3">
          <h2 className="font-display text-sm font-semibold text-slate-900">
            Total Amount vs Expected (Quantity × Unit Price) on Mismatched Rows
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Compares recorded settlement totals against arithmetic line-item calculations.
          </p>
        </div>
        {mismatchCount === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-xs text-slate-500">
            No total_amount arithmetic discrepancies detected in rows with numeric quantity and unit_price.
          </div>
        ) : (
          <div ref={totalChartRef} className="w-full h-[280px]" />
        )}
      </div>
    </div>
  );
}
