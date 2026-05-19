export default function DashboardHeader() {
  return (
    <header className="rg-dash-header">
      <div className="rg-dash-eyebrow">Dashboard · Submission readiness</div>
      <h1 className="rg-dash-title">
        Track revision progress toward submission readiness.
      </h1>
      <p className="rg-dash-subtitle">
        Review recent evaluations, open reports, and see which manuscripts are
        approaching the 8.0 curation threshold.
      </p>

      <div className="rg-dash-context">
        <div className="rg-dash-context-card">
          <div className="rg-dash-context-label">Readiness rule</div>
          <div className="rg-dash-context-value">8.0 / 10</div>
          <div className="rg-dash-context-note">
            Crossing 8.0 marks curation-ready status.
          </div>
        </div>
        <div className="rg-dash-context-card">
          <div className="rg-dash-context-label">Visible rows</div>
          <div className="rg-dash-context-value">Latest 15</div>
          <div className="rg-dash-context-note">
            Older evaluations load via deeper history.
          </div>
        </div>
        <div className="rg-dash-context-card">
          <div className="rg-dash-context-label">Current focus</div>
          <div className="rg-dash-context-value">Evaluation history</div>
          <div className="rg-dash-context-note">
            Charts and insights ship in a later release.
          </div>
        </div>
      </div>
    </header>
  )
}
