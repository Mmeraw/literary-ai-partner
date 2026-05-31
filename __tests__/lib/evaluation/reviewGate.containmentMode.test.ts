import {
  STORY_LEDGER_APPROVAL_ENABLED,
  STORY_LEDGER_CONTAINMENT_MESSAGE,
  isReviewGateApprovalAllowed,
} from '../../../lib/evaluation/reviewGate/containmentMode';

describe('review gate containment mode', () => {
  it('keeps approval disabled by default', () => {
    expect(STORY_LEDGER_APPROVAL_ENABLED).toBe(false);
  });

  it('allows reject disposition while containment is active', () => {
    expect(isReviewGateApprovalAllowed('rejected')).toBe(true);
  });

  it('blocks accepted dispositions while containment is active', () => {
    expect(isReviewGateApprovalAllowed('accepted_without_changes')).toBe(false);
    expect(isReviewGateApprovalAllowed('accepted_with_edits')).toBe(false);
  });

  it('has an explicit operator-facing containment message', () => {
    expect(STORY_LEDGER_CONTAINMENT_MESSAGE).toMatch(/diagnostic-only/i);
    expect(STORY_LEDGER_CONTAINMENT_MESSAGE).toMatch(/disabled/i);
  });
});
