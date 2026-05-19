export default function KpiCard({ label, value, meta, delta, deltaTone = 'neutral' }) {
  const deltaClass =
    deltaTone === 'positive'
      ? 'rg-kpi-delta rg-kpi-delta--positive'
      : deltaTone === 'gold'
      ? 'rg-kpi-delta rg-kpi-delta--gold'
      : 'rg-kpi-delta'

  return (
    <article className="rg-kpi-card">
      <div className="rg-kpi-label">{label}</div>
      <div className="rg-kpi-value">{value}</div>
      <div className="rg-kpi-meta">{meta}</div>
      {delta ? <div className={deltaClass}>{delta}</div> : null}
    </article>
  )
}
