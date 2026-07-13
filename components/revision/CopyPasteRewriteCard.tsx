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
    <section className="space-y-5" data-testid="copy-paste-rewrite-card">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200/75">
            Copy-paste rewrite
          </p>
          <h3 className="mt-1 text-base font-semibold text-stone-100">Choose one executable revision</h3>
        </div>
        <span className="rounded border border-emerald-700/60 bg-emerald-950/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
          Trusted Path eligible
        </span>
      </header>

      <div className="rounded border border-stone-700 bg-stone-950/40 px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">Original passage</p>
        <p className="mt-2 whitespace-pre-wrap font-serif text-sm leading-7 text-stone-200">
          {viewModel.originalPassage}
        </p>
        <p className="mt-3 font-mono text-[10px] text-stone-500">{viewModel.evidenceLocation}</p>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        {viewModel.candidates.map((candidate) => {
          const selected = selectedKey === candidate.key;
          return (
            <article
              key={candidate.key}
              className="flex min-h-full flex-col rounded border p-4"
              style={{
                borderColor: selected ? 'rgb(217 119 6)' : 'rgb(68 64 60)',
                background: selected ? 'rgba(120, 53, 15, 0.18)' : 'rgba(28, 25, 23, 0.55)',
              }}
            >
              <button type="button" className="flex-1 text-left" onClick={() => onSelect?.(candidate.key)}>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-300">
                  {candidate.key} — {candidate.label || candidateTone[candidate.key]}
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-200">{candidate.text}</p>
                {candidate.rationale && (
                  <p className="mt-3 text-xs leading-5 text-stone-400">{candidate.rationale}</p>
                )}
              </button>
              <button
                type="button"
                onClick={() => onAccept?.(candidate.key)}
                className="mt-4 rounded border border-amber-700 bg-amber-900/30 px-3 py-2 text-sm font-semibold text-amber-100"
              >
                Accept {candidate.key}
              </button>
            </article>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-stone-800 pt-4">
        <button type="button" onClick={onKeepOriginal} className="rounded border border-stone-700 px-3 py-2 text-xs text-stone-300">
          Keep Original
        </button>
        <button type="button" onClick={onCustomRewrite} className="rounded border border-stone-700 px-3 py-2 text-xs text-stone-300">
          Custom Rewrite
        </button>
        <button type="button" onClick={onDefer} className="rounded border border-stone-700 px-3 py-2 text-xs text-stone-300">
          Defer
        </button>
        <button type="button" onClick={onReject} className="rounded border border-red-900/70 px-3 py-2 text-xs text-red-300">
          Reject All
        </button>
      </div>
    </section>
  );
}
