// ── Evaluation purpose detection ─────────────────────────────────────────────
import HardResetRestartButton from '@/components/evaluation/HardResetRestartButton'
import { formatScoreForDisplay } from '@/lib/ui/score-formatting'

// Determines whether an evaluation is a normal author manuscript, a calibration
// run, or a published/reference work. This controls which status vocabulary the
// dashboard uses so we never show "Not agent ready" for a famous novel.
//
// NOTE: The permanent fix is an upload-form purpose selector (author_manuscript,
// published_reference, public_domain_calibration, test_file). Until then, we
// detect from title patterns.

// Explicit calibration / test markers
const CALIBRATION_PATTERNS = [
  /\(TEST FILE\)/i,
  /\bCALIBRATION\b/i,
  /\bBENCHMARK\b/i,
  /\bREFERENCE\s+EVAL/i,
  /\bPUBLIC[- ]DOMAIN\b/i,
  /\bTEST\s+RUN\b/i,
]

/**
 * Determine the evaluation purpose from the manuscript title.
 * Returns 'calibration', 'published_reference', or 'author_manuscript'.
 */
function detectEvaluationPurpose(title) {
  if (CALIBRATION_PATTERNS.some((re) => re.test(title))) return 'calibration'
  return 'author_manuscript'
}

// ── Status labels ────────────────────────────────────────────────────────────

const COMPLETED_STATUSES = ['market_ready', 'near_ready', 'improving', 'below_standard', 'complete']

function statusLabel(status, purpose) {
  if (purpose === 'calibration') {
    if (COMPLETED_STATUSES.includes(status)) return 'Calibration complete'
    if (status === 'running') return 'Calibration in progress'
    if (status === 'queued') return 'Calibration queued'
    if (status === 'failed') return 'Calibration failed'
    if (status === 'stale') return 'Calibration stalled'
    if (status === 'cancelled') return 'Cancelled'
    return 'Calibration complete'
  }

  if (purpose === 'published_reference') {
    if (COMPLETED_STATUSES.includes(status)) return 'Reference eval complete'
    if (status === 'running') return 'Reference eval in progress'
    if (status === 'queued') return 'Queued'
    if (status === 'failed') return 'Evaluation failed'
    if (status === 'stale') return 'Stalled'
    if (status === 'cancelled') return 'Cancelled'
    return 'Reference eval complete'
  }

  // author_manuscript
  switch (status) {
    case 'market_ready':
      return 'Agent ready'
    case 'near_ready':
      return 'Near ready'
    case 'improving':
      return 'Improving'
    case 'running':
      return 'In progress'
    case 'queued':
      return 'Queued'
    case 'stale':
      return 'Stalled'
    case 'cancelled':
      return 'Cancelled'
    case 'failed':
      return 'Evaluation failed'
    case 'below_standard':
    case 'complete':
      return 'Not agent ready'
    default:
      return 'Not agent ready'
  }
}

// ── Status tooltip text ──────────────────────────────────────────────────────

function statusTooltip(status, purpose) {
  if (purpose === 'calibration') {
    if (COMPLETED_STATUSES.includes(status))
      return 'This is a calibration or test run. Agent-readiness labels are not applied to benchmark evaluations.'
    if (status === 'running' || status === 'queued')
      return 'Calibration evaluation is still in progress.'
    if (status === 'failed')
      return 'This calibration run encountered an error.'
    return 'Calibration run.'
  }

  if (purpose === 'published_reference') {
    if (COMPLETED_STATUSES.includes(status))
      return 'This appears to be a published or reference work. Scores reflect alignment with modern submission-readiness criteria, not literary merit, cultural importance, or sales success.'
    if (status === 'running' || status === 'queued')
      return 'Reference evaluation is still in progress.'
    if (status === 'failed')
      return 'This reference evaluation encountered an error.'
    return 'Published-work reference evaluation.'
  }

  // author_manuscript
  switch (status) {
    case 'market_ready':
      return 'This manuscript has reached the 90/100 agent-readiness threshold.'
    case 'near_ready':
      return 'Score is approaching the 90/100 agent-readiness threshold.'
    case 'improving':
      return 'This evaluation completed. The manuscript is making progress but has not yet reached the readiness threshold.'
    case 'below_standard':
    case 'complete':
      return 'This evaluation completed, but the manuscript has not reached the 90/100 agent-readiness threshold.'
    case 'running':
    case 'queued':
      return 'Evaluation is still in progress.'
    case 'stale':
      return 'This evaluation appears to have stalled. Try re-running.'
    case 'failed':
      return 'This evaluation encountered an error and could not complete.'
    case 'cancelled':
      return 'This evaluation was cancelled.'
    default:
      return ''
  }
}

// ── Badge component ──────────────────────────────────────────────────────────

function StatusBadge({ status, purpose }) {
  const classMap = {
    market_ready: 'rg-status rg-status--ready',
    near_ready: 'rg-status rg-status--near',
    improving: 'rg-status rg-status--improving',
    running: 'rg-status rg-status--running',
    queued: 'rg-status rg-status--queued',
    stale: 'rg-status rg-status--stale',
    cancelled: 'rg-status rg-status--cancelled',
    failed: 'rg-status rg-status--failed',
  }

  let cls
  if ((purpose === 'calibration' || purpose === 'published_reference') &&
      !['running', 'queued', 'failed', 'stale', 'cancelled'].includes(status)) {
    cls = purpose === 'calibration' ? 'rg-status rg-status--calibration' : 'rg-status rg-status--reference'
  } else if (status === 'below_standard' || status === 'complete') {
    cls = 'rg-status rg-status--not-ready'
  } else {
    cls = classMap[status] || 'rg-status rg-status--not-ready'
  }

  return (
    <span className={cls} title={statusTooltip(status, purpose)}>
      {statusLabel(status, purpose)}
    </span>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatScore(value) {
  return formatScoreForDisplay(typeof value === 'number' ? value * 10 : value)
}

function agentReadinessHref(row) {
  const params = new URLSearchParams({
    manuscriptId: row.manuscriptId,
    evaluationJobId: row.jobId,
  })
  return `/agent-readiness?${params.toString()}`
}

function isAgentReadinessEligible(row) {
  return row.status !== 'running' && row.status !== 'queued' && row.status !== 'stale' && row.status !== 'cancelled' && row.status !== 'failed'
}

function isRestartEligible(row) {
  return row.status === 'failed' || row.status === 'stale'
}

// ── Table ─────────────────────────────────────────────────────────────────────

export default function EvaluationHistoryTable({ rows }) {
  return (
    <section className="rg-history-card" aria-label="Recent evaluations">
      <div className="rg-history-head">
        <div>
          <h2 className="rg-history-title">Recent evaluations</h2>
          <p className="rg-history-copy">Showing the {rows.length} most recent evaluations.</p>
        </div>
      </div>

      <div className="rg-history-table-wrap">
        <table className="rg-history-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Manuscript</th>
              <th>Type</th>
              <th>Overall</th>
              <th>Ready</th>
              <th>Status</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const purpose = detectEvaluationPurpose(row.manuscriptTitle)
              const isNonAuthor = purpose !== 'author_manuscript'
              return (
                <tr key={row.id}>
                  <td data-label="Date">{formatDate(row.createdAt)}</td>
                  <td data-label="Manuscript">
                    <a href={row.reportHref} className="rg-history-title-cell rg-history-title-link">{row.manuscriptTitle}</a>
                    {row.manuscriptSubtitle && <div className="rg-history-subtitle-cell">{row.manuscriptSubtitle}</div>}
                  </td>
                  <td data-label="Type">{row.evaluationType}</td>
                  <td data-label="Overall">{formatScore(row.overallScore)}</td>
                  <td data-label="Ready">{formatScore(row.readinessScore)}</td>
                  <td data-label="Status">
                    <StatusBadge status={row.status} purpose={purpose} />
                  </td>
                  <td data-label="Open">
                    <a className="rg-history-open" href={row.reportHref}>
                      {row.status === 'running' || row.status === 'queued'
                        ? 'View progress'
                        : row.status === 'failed' || row.status === 'stale' || row.status === 'cancelled'
                        ? 'View details'
                        : 'Open report'}
                    </a>
                    {isRestartEligible(row) && (
                      <div style={{ display: 'block', marginTop: '0.5rem' }}>
                        <HardResetRestartButton jobId={row.jobId} compact label="Restart" />
                      </div>
                    )}
                    {!isNonAuthor && isAgentReadinessEligible(row) && (
                      <a className="rg-history-open" href={agentReadinessHref(row)} style={{ display: 'block', marginTop: '0.5rem' }}>
                        Build Agent Readiness Package
                      </a>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
