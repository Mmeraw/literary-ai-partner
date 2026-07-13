'use client';

import React from 'react';
import type { CopyPasteCandidateKey, CopyPasteCardViewModel } from './workbenchCardModels';

type CopyPasteRewriteCardProps = {
  viewModel: CopyPasteCardViewModel;
  selectedKey?: CopyPasteCandidateKey | null;
  onSelect?: (key: CopyPasteCandidateKey) => void;
  onAccept?: (key: CopyPasteCandidateKey) => void;
  onKeepOriginal?: () => void;
  onCustomRewrite?: () => void;
  onDefer?: () => void;
  onReject?: () => void;
};

const candidateTone: Record<CopyPasteCandidateKey, string> = {
  A: 'Recommended repair',
  B: 'Rhythm variant',
  C: 'Bolder rendering shift',
};

const candidateDescription: Record<CopyPasteCandidateKey, string> = {
  A: 'Best governed repair for this passage',
  B: 'Same diagnosis with a different cadence',
  C: 'Stronger valid shift in rendering',
};

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1C160E]';

export default function CopyPasteRewriteCard({
  viewModel,
  selectedKey = null,
  onSelect,
  onAccept,
  onKeepOriginal,
  onCustomRewrite,
  onDefer,
  onReject,
}: CopyPasteRewriteCardProps) {
  return (
    <section className="space-y-5" data-testid="copy-paste-rewrite-card" aria-label="Copy-paste revision choices">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200/75">Copy-paste rewrite</p>
          <h3 className="mt-1 text-base font-semibold text-stone-100">Choose one executable revision</h3>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-stone-400">All three choices repair the same diagnosed issue. A is the governed recommendation; B changes cadence; C takes the bolder valid route.</p>
        </div>
        <span className="rounded border border-emerald-700/60 bg-emerald-950/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200">Trusted Path eligible</span>
      </header>

      <div className="rounded-lg border border-stone-700 bg-stone-950/40 px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">Original passage</p>
        <p className="mt-2 whitespace-pre-wrap font-serif text-sm leading-7 text-stone-200">{viewModel.originalPassage}</p>
        <p className="mt-3 font-mono text-[10px] text-stone-500">{viewModel.evidenceLocation}</p>
      </div>

      <div className="grid items-stretch gap-3 xl:grid-cols-3" role="radiogroup" aria-label="Revision candidates">
        {viewModel.candidates.map((candidate) => {
          const selected = selectedKey === candidate.key;
          const recommended = candidate.key === 'A';
          return (
            <article
              key={candidate.key}
              className={`flex min-h-[360px] flex-col rounded-xl border p-4 transition ${selected ? 'border-amber-500 bg-amber-950/25 shadow-[0_0_0_1px_rgba(245,158,11,0.25)]' : recommended ? 'border-emerald-800/70 bg-emerald-950/10' : 'border-stone-700 bg-stone-950/30 hover:border-stone-600'}`}
              data-selected={selected ? 'true' : 'false'}
            >
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`Select option ${candidate.key}: ${candidate.label || candidateTone[candidate.key]}`}
                className={`flex flex-1 flex-col text-left ${focusRing}`}
                onClick={() => onSelect?.(candidate.key)}
              >
                <div className="flex min-h-10 flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-300">{candidate.key} — {candidate.label || candidateTone[candidate.key]}</p>
                    <p className="mt-1 text-[10px] leading-4 text-stone-500">{candidateDescription[candidate.key]}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {recommended && <span className="rounded-full border border-emerald-700/60 bg-emerald-950/30 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-emerald-200">Recommended</span>}
                    {selected && <span className="rounded-full border border-amber-600/70 bg-amber-900/30 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-amber-100">Selected</span>}
                  </div>
                </div>
                <p className="mt-4 flex-1 whitespace-pre-wrap text-sm leading-7 text-stone-200">{candidate.text}</p>
                {candidate.rationale && <p className="mt-4 border-t border-stone-800 pt-3 text-xs leading-5 text-stone-400">{candidate.rationale}</p>}
              </button>
              <button
                type="button"
                onClick={() => onAccept?.(candidate.key)}
                className={`mt-4 rounded px-3 py-2.5 text-sm font-semibold transition ${focusRing} ${selected ? 'border border-amber-500 bg-amber-700/35 text-amber-50' : 'border border-stone-700 bg-stone-900/40 text-stone-200 hover:border-amber-700 hover:text-amber-100'}`}
              >
                Accept {candidate.key}
              </button>
            </article>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-stone-800 pt-4" aria-label="Other revision actions">
        <button type="button" onClick={onKeepOriginal} className={`rounded border border-stone-700 px-3 py-2 text-xs text-stone-300 ${focusRing}`}>Keep Original</button>
        <button type="button" onClick={onCustomRewrite} className={`rounded border border-stone-700 px-3 py-2 text-xs text-stone-300 ${focusRing}`}>Custom Rewrite</button>
        <button type="button" onClick={onDefer} className={`rounded border border-stone-700 px-3 py-2 text-xs text-stone-300 ${focusRing}`}>Defer</button>
        <button type="button" onClick={onReject} className={`rounded border border-red-900/70 px-3 py-2 text-xs text-red-300 ${focusRing}`}>Reject All</button>
      </div>
    </section>
  );
}
