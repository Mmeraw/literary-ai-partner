export const STORY_LEDGER_APPROVAL_ENABLED = false;

export const STORY_LEDGER_CONTAINMENT_MESSAGE =
  'Story Ledger approval is temporarily disabled while semantic containment safeguards are being implemented. This ledger is diagnostic-only and cannot unlock accepted ledger state.';

export function isReviewGateApprovalAllowed(disposition: string): boolean {
  if (disposition === 'rejected') {
    return true;
  }

  return STORY_LEDGER_APPROVAL_ENABLED;
}
