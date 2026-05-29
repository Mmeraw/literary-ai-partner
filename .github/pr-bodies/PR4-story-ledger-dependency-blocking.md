## Summary

Implement PR4 dependency blocking so Story Ledger layers that depend on `canonical_identity_layer` cannot present as clean when Canonical Identity is degraded, ambiguous, blocked, or carrying known identity blockers.

- detect inherited identity risk from existing reducer/quality signals
- propagate degraded/blocked dependency metadata to dependent Story Ledger layers
- render explicit inherited-risk warnings in the Story Ledger UI
- carry dependency warning metadata forward into accepted-ledger handoff
- preserve admin QA visibility without converting degraded data into clean canon

## Scope

**Touches:**
- `lib/evaluation/phase1a/storyLayerDependencyHealth.ts`
- `lib/evaluation/phase1a/buildStoryLayerFromLedger.ts`
- `lib/evaluation/phase1a/buildLedgerQualityReport.ts`
- `lib/evaluation/phase1a/storyLayerArtifactWriters.ts`
- `app/api/jobs/[jobId]/review-gate/route.ts`
- `app/evaluate/[jobId]/ledger/page.tsx`
- `components/ledger/StoryLedgerLayers.tsx`
- `lib/evaluation/processor.ts`
- `__tests__/lib/evaluation/phase1a/storyLayerDependencyHealth.test.ts`
- `__tests__/components/ledger/storyLayerDependencyWarning.test.tsx`
- `__tests__/lib/ledger/storyLedgerVisibility.test.ts`
- `__tests__/evaluation/phase1a.storyLayerArtifactWriters.test.ts`

**Does NOT touch:**
- Magwitch alias/revelation merge
- relationship canonical-ID keying
- pronoun-family UI semantics
- timeline/location normalization
- threat/pressure architecture
- full Source Integrity dashboard
- Review Gate provenance
- Revise UI / Workbench V2

## Branch Freshness (Never Behind)

Branch-Behind-Base: 0

## Tests Updated

Added / updated focused regression coverage for:
- dependency propagation from `canonical_identity_layer`
- same-name ambiguity and active identity blockers
- admin visibility exception without truth/status override
- Story Ledger UI inherited-risk warning rendering
- artifact writer compatibility with dependency metadata

Validation run:
- `NODE_PATH=/workspaces/literary-ai-partner/node_modules /workspaces/literary-ai-partner/node_modules/.bin/jest --config /workspaces/lap-pr4-dependency-blocking/jest.config.js --runInBand --no-coverage __tests__/lib/evaluation/phase1a/storyLayerDependencyHealth.test.ts __tests__/components/ledger/storyLayerDependencyWarning.test.tsx __tests__/lib/ledger/storyLedgerVisibility.test.ts __tests__/evaluation/phase1a.storyLayerArtifactWriters.test.ts`
- Result: PASS, 4 suites, 15 tests, 0 failures

Admin exception tests:
- Non-admin author: degraded dependent layers are not presented as clean; blocked/withheld behavior applies normally.
- Admin account `tsavobc@hotmail.com`: degraded/blocked dependent layers may be visible, but each affected layer still shows degraded/blocked status and inherited identity-risk warnings.
- No leakage: admin-only visibility does not change persisted layer health and does not affect non-admin payloads.

## Risks & Anomalies

- Main risk is over-triggering inherited identity risk from existing blocker signals; the implementation is intentionally conservative and only uses existing reducer/state-conflict/name-state signals.
- Admin visibility is a QA/debugging exception only. It does not convert degraded/blocked data into clean canon and does not alter persisted layer truth.
- Accepted-ledger route shape already carries forward raw layers; this PR adds dependency warning metadata without changing downstream job status or phase semantics.

## Evaluation Process Change Declaration

Process Change: no

- [x] No new evaluation phase, job status, or contract identifier introduced.
- [x] No scoring, prompt, or phase-order semantics changed.
- [x] No Revise admission/UI behavior changed.
- [x] This PR only propagates existing Canonical Identity risk into dependent Story Ledger layer health.

## Contract Integrity

- `#823` server-side Story Ledger visibility gate remains server-side and authoritative.
- `#820` identity hygiene remains the source of blocker signals reused here.
- `#821` Revise admission synthesis remains unchanged.
- `#817` nine-layer contract remains intact via `STORY_LAYER_KEYS` / `STORY_LAYER_COUNT`.
- Merge bar preserved: no dependent Story Ledger layer may present itself as clean when Canonical Identity is degraded, ambiguous, failed, missing, or carrying known identity blockers.
- Admin visibility exception: `tsavobc@hotmail.com` may view degraded or blocked dependent layers for QA/debugging, but those layers remain degraded/blocked, carry inherited identity-risk warnings, and do not alter non-admin payloads.

## Behavioral Quality

- Clean Canonical Identity allows dependent layers to remain clean if their own content passes.
- Missing Canonical Identity blocks dependent layers from clean status.
- Same-name ambiguity and name-state blocker signals degrade dependent layers through inherited identity risk.
- UI now shows explicit inherited identity-risk warnings for affected layers instead of letting them read as clean.
- Accepted-ledger handoff carries dependency warning metadata forward with the persisted Story Ledger payload.

## Latency Evidence

Selected pass:
- [x] Pass 1
- [ ] Pass 2
- [ ] Pass 3

Baseline (Pre-change)
| Run | pass1_ms | total_ms | criteria_count_by_state | Notes |
|---|---:|---:|---|---|
| Run 1 | 0 (N/A — dependency metadata only) | 0 (N/A) | N/A | No evaluation pipeline timing changed. |
| Run 2 | 0 (N/A — dependency metadata only) | 0 (N/A) | N/A | Pre-change layers could inherit identity risk without explicit dependency status. |

Post-change Runs
| Run | pass1_ms | total_ms | criteria_count_by_state | Notes |
|---|---:|---:|---|---|
| Run 1 | 0 (N/A — dependency metadata only) | 0 (N/A) | N/A | Focused PR4 regression suite passed. |
| Run 2 | 0 (N/A — dependency metadata only) | 0 (N/A) | N/A | Touched files diagnostics-clean. |

Quality gate / anomaly disclosure:
- No QG_ scoring logic changed in this PR.
- This PR strengthens quality gate truthfulness by preventing dependent layers from reading as clean when Canonical Identity is degraded.

Final principle:
- This change is not reducing intelligence; it preserves quality truth by propagating existing identity risk instead of letting dependent Story Ledger layers appear cleaner than the canon supports.

No-Pipeline-Impact: true — dependency health propagation only; no runtime pipeline expansion.
