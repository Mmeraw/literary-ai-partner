'use client';

import { cn } from '@/lib/utils';
import type { WithheldCardViewModel } from './workbenchCardModels';

type WithheldSummaryProps = {
  viewModel: WithheldCardViewModel;
  onRequestReanalysis?: () => void;
  onProvideContext?: () => void;
};

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rg-workbench-gold)]';

export default function WithheldSummary({
  viewModel,
  onRequestReanalysis,
  onProvideContext,
}: WithheldSummaryProps) {
  return (
    <article
      className="rounded-lg border border-[var(--rg-workbench-border)] bg-[var(--rg-workbench-surface)] px-5 py-5"
      data-testid="withheld-summary"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--rg-workbench-danger)]">Held item</p>
          <h3 className="mt-1 text-base font-semibold text-[var(--rg-workbench-text-primary)]">{viewModel.title}</h3>
        </div>
        <span className="rounded border border-[var(--rg-workbench-border)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--rg-workbench-text-muted)]">
          Not actionable yet
        </span>
      </div>

      {viewModel.evidenceAnchor && (
        <blockquote className="mt-4 border-l-2 border-[var(--rg-workbench-gold)] pl-4 font-serif text-sm leading-7 text-[var(--rg-workbench-text-primary)]">
          {viewModel.evidenceAnchor}
        </blockquote>
      )}

      <section className="mt-5 rounded-md border border-[#6d3232] bg-[#241010] px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#efb0b0]">Why this is held</p>
        <p className="mt-2 text-sm leading-6 text-[#e6c6c6]">{viewModel.holdReason}</p>
      </section>

      {viewModel.missingContext && viewModel.missingContext.length > 0 && (
        <section className="mt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--rg-workbench-text-secondary)]">Missing context</p>
          <ul className="mt-2 space-y-2 text-sm text-[var(--rg-workbench-text-primary)]">
            {viewModel.missingContext.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden="true" className="text-[var(--rg-workbench-text-muted)]">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-4 rounded-md border border-[var(--rg-workbench-border)] bg-[var(--rg-workbench-surface-raised)] px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--rg-workbench-text-secondary)]">How to recover it</p>
        <p className="mt-2 text-sm leading-6 text-[var(--rg-workbench-text-primary)]">{viewModel.recoveryAction}</p>
      </section>

      <div className="mt-5 flex flex-wrap gap-3 border-t border-[var(--rg-workbench-border)] pt-4">
        <button
          type="button"
          onClick={onRequestReanalysis}
          className={cn('h-10 rounded-md border border-[#7b4b1f] px-4 text-sm text-[var(--rg-workbench-gold)] transition hover:border-[var(--rg-workbench-gold)]', focusRing)}
        >
          Request Re-analysis
        </button>
        <button
          type="button"
          onClick={onProvideContext}
          className={cn('h-10 rounded-md border border-[var(--rg-workbench-border)] px-4 text-sm text-[var(--rg-workbench-text-secondary)] transition hover:border-[var(--rg-workbench-border-strong)]', focusRing)}
        >
          Provide More Context
        </button>
      </div>
    </article>
  );
}
