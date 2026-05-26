export default function DashboardHeader() {
  return (
    <header className="rg-dash-header">
      <div className="rg-dash-eyebrow">Dashboard · Manuscript progress</div>
      <h1 className="rg-dash-title">
        See where each manuscript stands and what to do next.
      </h1>
      <p className="rg-dash-subtitle">
        Track readiness movement, recent evaluations, and the next best action for your current manuscript. Revision activity is not the same as measured improvement; follow-up evaluations confirm movement.
      </p>

      <div className="rg-dash-context">
        <div className="rg-dash-context-card">
          <div className="rg-dash-context-label">Readiness rule</div>
          <div className="rg-dash-context-value">8.0 / 10</div>
          <div className="rg-dash-context-note">
            Marks manuscript readiness review eligibility, not a guarantee of market response.
          </div>
        </div>
        <div className="rg-dash-context-card">
          <div className="rg-dash-context-label">Progress doctrine</div>
          <div className="rg-dash-context-value">Measure</div>
          <div className="rg-dash-context-note">
            Accepted revisions become improvement only when a later evaluation confirms movement.
          </div>
        </div>
        <div className="rg-dash-context-card">
          <div className="rg-dash-context-label">Next layer</div>
          <div className="rg-dash-context-value">Revise</div>
          <div className="rg-dash-context-note">
            Use reports to repair, then re-evaluate to track score and issue reduction.
          </div>
        </div>
      </div>
    </header>
  )
}
