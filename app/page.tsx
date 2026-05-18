export default function Home() {
  return (
    <section
      style={{
        minHeight: 'calc(100vh - 72px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
      }}
    >
      <div style={{ maxWidth: 760, width: '100%' }}>
        <p
          style={{
            margin: '0 0 12px',
            fontSize: '0.85rem',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'rgba(245, 241, 232, 0.65)',
          }}
        >
          RevisionGrade
        </p>

        <h1
          style={{
            margin: '0 0 16px',
            fontSize: 'clamp(2.5rem, 6vw, 5rem)',
            lineHeight: 1.02,
          }}
        >
          PhD-calibrated literary evaluation for serious writers.
        </h1>

        <p
          style={{
            margin: '0 0 28px',
            maxWidth: 620,
            fontSize: '1.05rem',
            lineHeight: 1.7,
            color: 'rgba(245, 241, 232, 0.82)',
          }}
        >
          Evaluate manuscripts, surface revision priorities, and move from diagnostic clarity
          to stronger drafts with a unified editorial workflow.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <a
            href="/evaluate"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 48,
              padding: '0 18px',
              borderRadius: 999,
              background: '#f5f1e8',
              color: '#111111',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Start Evaluation
          </a>

          <a
            href="/pricing"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 48,
              padding: '0 18px',
              borderRadius: 999,
              border: '1px solid rgba(245, 241, 232, 0.18)',
              color: '#f5f1e8',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            View Pricing
          </a>
        </div>
      </div>
    </section>
  )
}