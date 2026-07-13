import React from 'react';
import type { WithheldCardViewModel } from './workbenchCardModels';

type WithheldSummaryProps = {
  viewModel: WithheldCardViewModel;
  onRequestReanalysis?: () => void;
  onProvideContext?: () => void;
};

export default function WithheldSummary({
  viewModel,
  onRequestReanalysis,
  onProvideContext,
}: WithheldSummaryProps) {
  return (
    <article
      className="rounded border border-stone-700 bg-stone-950/45 px-5 py-5"
      data-testid="withheld-summary"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">Held item</p>
          <h3 className="mt-1 text-base font-semibold text-stone-100">{viewModel.title}</h3>
        </div>
        <span className="rounded border border-stone-700 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">
          Not actionable yet
        </span>
      </div>

      {viewModel.evidenceAnchor && (
        <blockquote className="mt-4 border-l-2 border-stone-600 pl-4 font-serif text-sm leading-7 text-stone-300">
          {viewModel.evidenceAnchor}
        </blockquote>
      )}

      <section className="mt-5 rounded border border-red-900/40 bg-red-950/15 px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-red-300">Why this was held</p>
        <p className="mt-2 text-sm leading-6 text-stone-200">{viewModel.holdReason}</p>
      </section>

      {viewModel.missingContext && viewModel.missingContext.length > 0 && (
        <section className="mt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">Missing context</p>
          <ul className="mt-2 space-y-2 text-sm text-stone-300">
            {viewModel.missingContext.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden="true" className="text-stone-500">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-4 rounded border border-stone-700 bg-stone-900/40 px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">How to recover it</p>
        <p className="mt-2 text-sm leading-6 text-stone-200">{viewModel.recoveryAction}</p>
      </section>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-stone-800 pt-4">
        <button
          type="button"
          onClick={onRequestReanalysis}
          className="rounded border border-stone-600 px-3 py-2 text-xs font-semibold text-stone-200"
        >
          Request Re-analysis
        </button>
        <button
          type="button"
          onClick={onProvideContext}
          className="rounded border border-stone-700 px-3 py-2 text-xs text-stone-300"
        >
          Provide More Context
        </button>
      </div>
    </article>
  );
}
