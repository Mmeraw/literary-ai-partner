'use client';

import { cn } from '@/lib/utils';
import CopyPasteRewriteCard from './CopyPasteRewriteCard';
import StrategyCard from './StrategyCard';
import WithheldSummary from './WithheldSummary';
import type { CopyPasteCandidateKey, WorkbenchCardViewModel } from './workbenchCardModels';

export type WorkbenchCardSurfaceActions = {
  selectedKey?: CopyPasteCandidateKey | null;
  onSelectCandidate?: (key: CopyPasteCandidateKey) => void;
  onAcceptCandidate?: (key: CopyPasteCandidateKey) => void;
  onKeepOriginal?: () => void;
  onCustomRewrite?: () => void;
  onCustomPlan?: () => void;
  onDefer?: () => void;
  onReject?: () => void;
  onRequestReanalysis?: () => void;
};

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rg-workbench-gold)]';

export default function WorkbenchCardSurface({
  viewModel,
  actions = {},
}: {
  viewModel: WorkbenchCardViewModel;
  actions?: WorkbenchCardSurfaceActions;
}) {
  switch (viewModel.cardType) {
    case 'copy_paste_rewrite':
      return (
        <CopyPasteRewriteCard
          viewModel={viewModel}
          selectedKey={actions.selectedKey}
          onSelect={actions.onSelectCandidate}
          onAccept={actions.onAcceptCandidate}
          onKeepOriginal={actions.onKeepOriginal}
          onCustomRewrite={actions.onCustomRewrite}
          onDefer={actions.onDefer}
          onReject={actions.onReject}
        />
      );

    case 'revision_strategy':
      return (
        <div className="space-y-4" data-testid="revision-strategy-surface">
          <StrategyCard viewModel={viewModel} />
          <div className="sticky bottom-0 mt-8 border-t border-[var(--rg-workbench-border)] bg-[color:var(--rg-workbench-bg)]/95 py-4 backdrop-blur">
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={actions.onCustomPlan} className={cn('h-10 rounded-md border border-[var(--rg-workbench-border)] px-4 text-sm text-[var(--rg-workbench-text-secondary)] transition hover:border-[var(--rg-workbench-border-strong)]', focusRing)}>
                Custom Plan / Notes
              </button>
              <button type="button" onClick={actions.onDefer} className={cn('h-10 rounded-md border border-[var(--rg-workbench-border)] px-4 text-sm text-[var(--rg-workbench-text-secondary)] transition hover:border-[var(--rg-workbench-border-strong)]', focusRing)}>
                Defer
              </button>
              <button type="button" onClick={actions.onRequestReanalysis} className={cn('h-10 rounded-md border border-[#7b4b1f] px-4 text-sm text-[var(--rg-workbench-gold)] transition hover:border-[var(--rg-workbench-gold)]', focusRing)}>
                Request Re-analysis
              </button>
              <button type="button" onClick={actions.onReject} className={cn('h-10 rounded-md border border-[#8f4141] px-4 text-sm text-[var(--rg-workbench-danger)] transition hover:border-[#c06a6a]', focusRing)}>
                Reject
              </button>
            </div>
          </div>
        </div>
      );

    case 'withheld':
      return <WithheldSummary viewModel={viewModel} onRequestReanalysis={actions.onRequestReanalysis} />;
  }
}
