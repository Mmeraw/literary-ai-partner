'use client';

import { cn } from '@/lib/utils';
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

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rg-workbench-gold)]';

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
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--rg-workbench-gold)]">Copy-paste rewrite</p>
          <h3 className="mt-1 text-base font-semibold text-[var(--rg-workbench-text-primary)]">Choose one executable revision</h3>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-[var(--rg-workbench-text-secondary)]">
            All three choices repair the same diagnosed issue. A is the governed recommendation; B changes cadence; C takes the bolder valid route.
          </p>
        </div>
        <span className="rounded border border-[#2a5a3f] bg-[#132a1e] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--rg-workbench-success)]">Trusted Path eligible</span>
      </header>

      <div className="rounded-lg border border-[var(--rg-workbench-border)] bg-[var(--rg-workbench-surface)] px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--rg-workbench-text-secondary)]">Original passage</p>
        <p className="mt-2 whitespace-pre-wrap font-serif text-sm leading-7 text-[var(--rg-workbench-text-primary)]">{viewModel.originalPassage}</p>
        <p className="mt-3 font-mono text-[10px] text-[var(--rg-workbench-text-muted)]">{viewModel.evidenceLocation}</p>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3" role="radiogroup" aria-label="Revision candidates">
        {viewModel.candidates.map((candidate) => {
          const selected = selectedKey === candidate.key;
          const recommended = candidate.key === 'A';
          return (
            <button
              key={candidate.key}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`Select option ${candidate.key}: ${candidate.label || candidateTone[candidate.key]}`}
              onClick={() => onSelect?.(candidate.key)}
              className={cn(
                'rounded-lg border p-5 text-left transition',
                focusRing,
                selected
                  ? 'border-[var(--rg-workbench-gold)] bg-[var(--rg-workbench-surface-selected)]'
                  : 'border-[var(--rg-workbench-border)] bg-[var(--rg-workbench-surface)] hover:border-[var(--rg-workbench-border-strong)]'
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--rg-workbench-gold)] text-sm font-bold text-[var(--rg-workbench-gold)]">
                  {candidate.key}
                </span>
                {selected && (
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--rg-workbench-gold-strong)]">Selected</span>
                )}
              </div>

              <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--rg-workbench-gold)]">
                {candidate.key} — {candidate.label || candidateTone[candidate.key]}
              </p>
              <p className="mt-1 text-[10px] leading-4 text-[var(--rg-workbench-text-muted)]">{candidateDescription[candidate.key]}</p>

              <p className="mt-4 flex-1 whitespace-pre-wrap text-sm leading-7 text-[var(--rg-workbench-text-primary)]">{candidate.text}</p>
              {candidate.rationale && <p className="mt-4 border-t border-[var(--rg-workbench-border)] pt-3 text-xs leading-5 text-[var(--rg-workbench-text-secondary)]">{candidate.rationale}</p>}

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onAccept?.(candidate.key);
                }}
                className={cn(
                  'mt-5 w-full rounded-md px-4 py-2.5 text-sm font-semibold transition',
                  focusRing,
                  selected
                    ? 'border border-[var(--rg-workbench-gold)] bg-[#7b5a1f] text-[var(--rg-workbench-text-primary)]'
                    : 'border border-[var(--rg-workbench-border)] bg-[var(--rg-workbench-surface-raised)] text-[var(--rg-workbench-text-secondary)] hover:border-[var(--rg-workbench-gold)] hover:text-[var(--rg-workbench-gold)]'
                )}
              >
                Accept {candidate.key}
              </button>

              {recommended && (
                <span className="mt-3 inline-block rounded-full border border-[#2a5a3f] bg-[#132a1e] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--rg-workbench-success)]">
                  Recommended
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 border-t border-[var(--rg-workbench-border)] pt-4" aria-label="Other revision actions">
        <button type="button" onClick={onKeepOriginal} className={cn('h-10 rounded-md border border-[var(--rg-workbench-border)] px-4 text-sm text-[var(--rg-workbench-text-secondary)] transition hover:border-[var(--rg-workbench-border-strong)]', focusRing)}>
          Keep Original
        </button>
        <button type="button" onClick={onCustomRewrite} className={cn('h-10 rounded-md border border-[var(--rg-workbench-border)] px-4 text-sm text-[var(--rg-workbench-text-secondary)] transition hover:border-[var(--rg-workbench-border-strong)]', focusRing)}>
          Custom Rewrite
        </button>
        <button type="button" onClick={onDefer} className={cn('h-10 rounded-md border border-[var(--rg-workbench-border)] px-4 text-sm text-[var(--rg-workbench-text-secondary)] transition hover:border-[var(--rg-workbench-border-strong)]', focusRing)}>
          Defer
        </button>
        <button type="button" onClick={onReject} className={cn('h-10 rounded-md border border-[#8f4141] px-4 text-sm text-[var(--rg-workbench-danger)] transition hover:border-[#c06a6a]', focusRing)}>
          Reject All
        </button>
      </div>
    </section>
  );
}
