'use client';

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
          <div className="flex flex-wrap gap-2 border-t border-stone-800 pt-4">
            <button type="button" onClick={actions.onCustomPlan} className="rounded border border-stone-700 px-3 py-2 text-xs text-stone-300">
              Custom Plan / Notes
            </button>
            <button type="button" onClick={actions.onDefer} className="rounded border border-stone-700 px-3 py-2 text-xs text-stone-300">
              Defer
            </button>
            <button type="button" onClick={actions.onRequestReanalysis} className="rounded border border-amber-800/70 px-3 py-2 text-xs text-amber-200">
              Request Re-analysis
            </button>
            <button type="button" onClick={actions.onReject} className="rounded border border-red-900/70 px-3 py-2 text-xs text-red-300">
              Reject
            </button>
          </div>
        </div>
      );

    case 'withheld':
      return <WithheldSummary viewModel={viewModel} onRequestReanalysis={actions.onRequestReanalysis} />;
  }
}
