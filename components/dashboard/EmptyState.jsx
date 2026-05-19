import Link from 'next/link'

export default function EmptyState({ title, body, ctaHref, ctaLabel }) {
  return (
    <section className="rg-empty-state">
      <h2>{title}</h2>
      <p>{body}</p>
      {ctaHref && ctaLabel ? (
        <Link href={ctaHref} className="rg-empty-cta">
          {ctaLabel}
        </Link>
      ) : null}
    </section>
  )
}
