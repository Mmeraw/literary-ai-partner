// ── Calibration / benchmark detection ────────────────────────────────────────
// Public-domain calibration runs should not show agent-readiness labels.
const CALIBRATION_PATTERNS = [
  /\(TEST FILE\)/i,
  /\bCALIBRATION\b/i,
  /\bBENCHMARK\b/i,
  /\bREFERENCE\s+EVAL/i,
  /\bPUBLIC[- ]DOMAIN\b/i,
]

function isCalibrationRun(title) {
  return CALIBRATION_PATTERNS.some((re) => re.test(title))
}

// ── Status labels ────────────────────────────────────────────────────────────

function statusLabel(status, isCalibration) {
  if (isCalibration) {
    switch (status) {
      case 'market_ready':
      case 'near_ready':
      case 'improving':
      case 'below_standard':
      case 'complete':
        return 'Calibration complete'
      case 'running':
        return 'Calibration in progress'
      case 'queued':
        return 'Calibration queued'
      case 'failed':
        return 'Calibration failed'
      case 'stale':
        return 'Calibration stalled'
      case 'cancelled':
        return 'Cancelled'
      default:
        return 'Calibration complete'
    }
  }

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

function statusTooltip(status, isCalibration) {
  if (isCalibration) {
    switch (status) {
      case 'market_ready':
      case 'near_ready':
      case 'improving':
      case 'below_standard':
      case 'complete':
        return 'This is a public-domain calibration run. Agent-readiness labels are not applied to published benchmark works.'
      case 'running':
      case 'queued':
        return 'Calibration evaluation is still in progress.'
      case 'failed':
        return 'This calibration run encountered an error.'
      default:
        return 'Calibration run.'
    }
  }

  switch (status) {
    case 'market_ready':
      return 'This manuscript has reached the 8.0 agent-readiness threshold.'
    case 'near_ready':
      return 'Score is approaching the 8.0 agent-readiness threshold.'
    case 'improving':
      return 'This evaluation completed. The manuscript is making progress but has not yet reached the readiness threshold.'
    case 'below_standard':
    case 'complete':
      return 'This evaluation completed, but the manuscript has not reached the 8.0 agent-readiness threshold.'
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

function StatusBadge({ status, isCalibration }) {
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

  const calibrationCls = 'rg-status rg-status--calibration'
  const completedCls = 'rg-status rg-status--not-ready'

  let cls
  if (isCalibration && !['running', 'queued', 'failed', 'stale', 'cancelled'].includes(status)) {
    cls = calibrationCls
  } else if (status === 'below_standard' || status === 'complete') {
    cls = completedCls
  } else {
    cls = classMap[status] || completedCls
  }

  return (
    <span className={cls} title={statusTooltip(status, isCalibration)}>
      {statusLabel(status, isCalibration)}
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
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : '—'
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
              const calibration = isCalibrationRun(row.manuscriptTitle)
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
                    <StatusBadge status={row.status} isCalibration={calibration} />
                  </td>
                  <td data-label="Open">
                    <a className="rg-history-open" href={row.reportHref}>
                      {row.status === 'running' || row.status === 'queued'
                        ? 'View progress'
                        : row.status === 'failed' || row.status === 'stale' || row.status === 'cancelled'
                        ? 'View details'
                        : 'Open report'}
                    </a>
                    {!calibration && isAgentReadinessEligible(row) && (
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
