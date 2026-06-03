/**
 * WAVE Governance & Canon Execution Summary
 *
 * Renders the WAVE execution trace in the evaluation report:
 * - Overall WAVE engine status (executed / skipped / failed)
 * - Pass convergence status
 * - Wave module execution table
 * - Gate failure diagnostics (when skipped)
 */

import type { WaveGovernanceData } from '@/lib/evaluation/waveGovernanceData';

type Props = {
  data: WaveGovernanceData;
  wordCount: number;
};

const STATUS_BADGE: Record<string, { label: string; bg: string; text: string; ring: string }> = {
  complete: { label: 'EXECUTED', bg: 'bg-emerald-100', text: 'text-emerald-800', ring: 'ring-emerald-400' },
  skipped:  { label: 'SKIPPED',  bg: 'bg-amber-100',   text: 'text-amber-800',   ring: 'ring-amber-400' },
  failed:   { label: 'FAILED',   bg: 'bg-red-100',     text: 'text-red-800',     ring: 'ring-red-400' },
  timeout:  { label: 'TIMEOUT',  bg: 'bg-red-100',     text: 'text-red-800',     ring: 'ring-red-400' },
  unknown:  { label: 'UNKNOWN',  bg: 'bg-gray-100',    text: 'text-gray-700',    ring: 'ring-gray-400' },
};

const RUN_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  completed: { label: 'Completed', cls: 'bg-emerald-100 text-emerald-800' },
  running:   { label: 'Running',   cls: 'bg-blue-100 text-blue-800' },
  pending:   { label: 'Pending',   cls: 'bg-gray-100 text-gray-700' },
  failed:    { label: 'Failed',    cls: 'bg-red-100 text-red-800' },
};

const CATEGORY_LABELS: Record<string, string> = {
  sceneConstruction: 'Scene Construction',
  voice: 'Voice',
  dialogue: 'Dialogue',
  pacing: 'Pacing',
  proseControl: 'Prose Control',
  continuity: 'Continuity',
  polish: 'Polish',
  scene: 'Scene',
  character: 'Character',
  narrativeDrive: 'Narrative Drive',
};

function formatCriterionKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export default function WaveGovernanceSummary({ data, wordCount }: Props) {
  const badge = STATUS_BADGE[data.planStatus] ?? STATUS_BADGE.unknown;

  return (
    <div className="space-y-6">
      {/* ── Canon Governance Summary ─────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">WAVE Engine</p>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${badge.bg} ${badge.text} ${badge.ring}`}>
            {badge.label}
          </span>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Modules Run</p>
          <p className="text-2xl font-bold text-gray-900">{data.modulesRun}</p>
          {data.modulesWithFindings > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">{data.modulesWithFindings} with findings</p>
          )}
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Word Count Gate</p>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
            wordCount >= 25000
              ? 'bg-emerald-100 text-emerald-800 ring-emerald-400'
              : 'bg-amber-100 text-amber-800 ring-amber-400'
          }`}>
            {wordCount >= 25000 ? 'PASS' : 'BELOW THRESHOLD'}
          </span>
          <p className="text-xs text-gray-500 mt-1">{wordCount.toLocaleString()} words (min 25,000)</p>
        </div>
      </div>

      {/* ── Gate Failure Detail (when skipped) ───────────────────── */}
      {data.planStatus === 'skipped' && data.reasonCodes.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
          <h4 className="text-sm font-semibold text-amber-900 mb-2">WAVE Gate — Not Met</h4>
          <ul className="list-disc list-inside text-sm text-amber-800 space-y-1">
            {data.reasonCodes.map((code, i) => (
              <li key={i}>{code}</li>
            ))}
          </ul>
          {data.lowestCriteria.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-amber-700 mb-1">Criteria below floor (6.0):</p>
              <div className="flex flex-wrap gap-2">
                {data.lowestCriteria.map((c, i) => (
                  <span key={i} className="inline-flex items-center rounded-full bg-red-100 text-red-800 border border-red-300 px-2.5 py-0.5 text-xs font-medium">
                    {formatCriterionKey(c.key)}: {c.score.toFixed(1)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Failed/Timeout Detail ────────────────────────────────── */}
      {(data.planStatus === 'failed' || data.planStatus === 'timeout') && (
        <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
          <h4 className="text-sm font-semibold text-red-900 mb-1">
            WAVE Execution {data.planStatus === 'timeout' ? 'Timed Out' : 'Failed'}
          </h4>
          {data.planReason && (
            <p className="text-sm text-red-800">{data.planReason}</p>
          )}
        </div>
      )}

      {/* ── Wave Plan Summary ────────────────────────────────────── */}
      {data.wavePlanSummary && (
        <div className="rounded-lg border border-gray-200 p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Wave Plan</h4>
          <div className="flex flex-wrap gap-3 text-sm">
            <div>
              <span className="text-gray-500">Derived Waves:</span>{' '}
              <span className="font-medium text-gray-900">{data.wavePlanSummary.derivedWaveIds.length}</span>
            </div>
            <div>
              <span className="text-gray-500">Plan Valid:</span>{' '}
              <span className={`font-medium ${data.wavePlanSummary.planValid ? 'text-emerald-700' : 'text-red-700'}`}>
                {data.wavePlanSummary.planValid ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
          {data.wavePlanSummary.violations.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-gray-500 mb-1">Violations:</p>
              <ul className="list-disc list-inside text-xs text-red-700 space-y-0.5">
                {data.wavePlanSummary.violations.map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Wave Module Execution Table ──────────────────────────── */}
      {data.waveRuns.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Wave Module Execution</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-2 pr-3 text-left font-semibold text-gray-600 uppercase tracking-wide">Wave</th>
                  <th className="py-2 pr-3 text-left font-semibold text-gray-600 uppercase tracking-wide">Name</th>
                  <th className="py-2 pr-3 text-left font-semibold text-gray-600 uppercase tracking-wide">Category</th>
                  <th className="py-2 pr-3 text-left font-semibold text-gray-600 uppercase tracking-wide">Status</th>
                  <th className="py-2 pr-3 text-right font-semibold text-gray-600 uppercase tracking-wide">Changes</th>
                  <th className="py-2 text-right font-semibold text-gray-600 uppercase tracking-wide">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.waveRuns.map((run) => {
                  const statusBadge = RUN_STATUS_BADGE[run.status] ?? RUN_STATUS_BADGE.pending;
                  return (
                    <tr key={run.waveNumber} className="hover:bg-gray-50/50">
                      <td className="py-2 pr-3 font-mono text-gray-900">W-{String(run.waveNumber).padStart(2, '0')}</td>
                      <td className="py-2 pr-3 text-gray-900">{run.waveName}</td>
                      <td className="py-2 pr-3 text-gray-600">{CATEGORY_LABELS[run.category] ?? run.category}</td>
                      <td className="py-2 pr-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadge.cls}`}>
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-gray-900">{run.changesCount}</td>
                      <td className="py-2 text-right font-mono text-gray-500">
                        {run.durationMs > 0 ? `${(run.durationMs / 1000).toFixed(1)}s` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Generation Timestamp ──────────────────────────────────── */}
      {data.generatedAt && (
        <p className="text-xs text-gray-400 text-right">
          WAVE report generated: {new Date(data.generatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
