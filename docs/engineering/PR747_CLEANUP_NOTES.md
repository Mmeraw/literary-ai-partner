# PR #747 Cleanup Notes

PR #747 was merged after a fast CI rescue cycle. The merge was valid, but the branch accumulated collateral cleanup while unblocking Review Gate handoff.

This cleanup PR is intentionally non-runtime:

- It removes stale PR-body wording that described `processor.real-gate.test.ts` as an unrelated known failure after the fixture was actually repaired.
- It records that Phase 3 test fixtures now need `accepted_story_ledger_v1` with a governance rail and layer decisions.
- It improves reliability-page copy without listing criteria aliases that trigger canon-audit checks.

No pipeline behavior, scoring, provider calls, WAVE runtime, Review Gate logic, or database contracts are changed here.
