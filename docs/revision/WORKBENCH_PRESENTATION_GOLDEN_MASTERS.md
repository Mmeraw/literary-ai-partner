# Revise Workbench Presentation Golden Masters

## Purpose

This document defines the author-facing presentation states that must remain stable after the Copy-Paste, Strategy, and Withheld UI split. It protects presentation quality only; backend classification, admission, queue authority, and ledger semantics remain authoritative elsewhere.

## Required golden-master states

1. **Copy-paste / A selected**
   - A carries the Recommended badge.
   - A carries the Selected badge and strongest action treatment.
   - B and C remain equally readable and fully executable.
   - Exactly three Accept actions are present.

2. **Copy-paste / B selected**
   - A remains Recommended.
   - B alone is Selected.
   - Selection does not imply recommendation.

3. **Revision strategy**
   - One unified strategy plan.
   - Implementation sequence and optional approaches are subordinate.
   - No A/B/C labels or Accept actions.
   - Trusted Path is unavailable.

4. **Held Items Summary**
   - Hold reason, missing context, and recovery action are visible.
   - No candidate prose, Generate, Accept, or Trusted Path controls.

5. **Mixed queue**
   - Copy-paste and strategy cards appear in Active.
   - Withheld cards appear only in Held.
   - Card-type badges and counts agree with the visible lists.

6. **Queue complete**
   - Completion language is distinct from an empty queue.
   - Failed saves remain visible and retryable.
   - Final Review guidance is visible.

7. **Filtered-empty**
   - Clearly states that filters hid the remaining items.
   - Does not imply that the evaluation contains no opportunities.

8. **Save failure / retry**
   - Failure is announced in the live status region.
   - Retry identifies the affected opportunity.
   - Success replaces the failed state after canonical sync succeeds.

## Viewports

Capture and verify each applicable state at:

- Desktop: 1440 × 1000
- Narrow desktop/tablet landscape: 1024 × 768

## Accessibility checks

- Visible keyboard focus for every interactive element.
- Active queue row exposes `aria-current`.
- Candidate selector exposes a radio-group model with one selected option.
- Active/Held toggles expose pressed state.
- Save status uses a polite live region.
- No disabled control is used to imply an unavailable action.

## Production proof

Repository fixtures prove deterministic rendering contracts. A signed-in production session must separately verify:

- Accept A/B/C;
- Keep Original, Custom, Defer, and Reject;
- refresh/reopen persistence;
- Final Review parity;
- failed save → Retry → Saved.

Production screenshots must use author-safe fixture or real evaluation content and must not expose credentials, internal admission diagnostics, prompts, or model traces.
