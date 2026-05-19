function statusLabel(status) {
  switch (status) {
    case 'market_ready':
      return 'Curation-ready'
    case 'near_ready':
      return 'Near ready'
    case 'improving':
      return 'Improving'
    case 'running':
      return 'Running'
    case 'failed':
      return 'Failed'
    default:
      return 'Below standard'
  }
}

function StatusBadge({ status }) {
  const cls =
    status === 'market_ready'
      ? 'rg-status rg-status--ready'
      : status === 'near_ready'
      ? 'rg-status rg-status--near'
      : status === 'running'
      ? 'rg-status rg-status--running'
      : status === 'failed'
      ? 'rg-status rg-status--failed'
      : 'rg-status rg-status--improving'

  return <span className={cls}>{statusLabel(status)}</span>
}

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
            {rows.map((row) => (
              <tr key={row.id}>
                <td data-label="Date">{formatDate(row.createdAt)}</td>
                <td data-label="Manuscript">
                  <div className="rg-history-title-cell">{row.manuscriptTitle}</div>
                  <div className="rg-history-subtitle-cell">{row.manuscriptSubtitle}</div>
                </td>
                <td data-label="Type">{row.evaluationType}</td>
                <td data-label="Overall">{formatScore(row.overallScore)}</td>
                <td data-label="Ready">{formatScore(row.readinessScore)}</td>
                <td data-label="Status">
                  <StatusBadge status={row.status} />
                </td>
                <td data-label="Open">
                  <a className="rg-history-open" href={row.reportHref}>
                    Open report
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
