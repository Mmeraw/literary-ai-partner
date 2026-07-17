# A/B/C Candidate Persistence Boundary Map

Fixture: one `evaluation_result_v2` recommendation with distinct sentinel values
- `candidate_text_a` = `AAA_SENTINEL_ALPHA: Mara paused at the threshold until the room understood her choice.`
- `candidate_text_b` = `BBB_SENTINEL_BRAVO: For the moment, Mara held the door open and let the silence settle before she answered.`
- `candidate_text_c` = `CCC_SENTINEL_CHARLIE: The answer stayed in Maras hand before it reached her voice, quiet and deliberate.`

| Boundary | A | B | C | Notes |
|---|---|---|---|---|
| Source `evaluation_result_v2` | preserved | preserved | preserved | Recommendation row contains all three. |
| `buildRevisionOpportunitiesFromEvaluationPayload` | preserved | preserved | preserved | `extractCriteriaRecommendations` passes all three to `ensureOpportunityCandidates`. |
| `buildCanonicalOpportunityLedger` | preserved | preserved | preserved | `RawOpportunity`/`CanonicalOpportunityLedgerItem` now carry `candidate_text_b/c`; `mergeCluster` preserves them. |
| UED `canonicalOpportunityLedger.opportunities` | stored | stored | stored | All three survive canonical ledger serialization. |
| `extractCanonicalRevisionOpportunities` | returned | returned | returned | Reads UED items and returns the full objects. |
| `canonicalUedOpportunityToRevisionOpportunity` | passed | passed | passed | Now maps `candidate_text_a/b/c` into the `RevisionOpportunity`. |
| `ensureRevisionOpportunityLedgerArtifact` (UED path) | persisted | persisted | persisted | Writes `revision_opportunity_ledger_v1` JSONB with A/B/C. |
| Persisted `revision_opportunity_ledger_v1` payload | stored | stored | stored | `opportunities` array in JSONB content reflects A/B/C. |
| Reload persisted ledger | returned | returned | returned | `ensureRevisionOpportunityLedgerArtifact` treats the persisted artifact as authoritative when the input source hash matches. |
| `getWorkbenchQueue` final `WorkbenchOption` | visible | visible | visible | `WorkbenchOption` options expose A/B/C in `candidateText`/`text`. |

## Authority contract

1. `revision_opportunity_ledger_v1` is the canonical persisted artifact produced by `ensureRevisionOpportunityLedgerArtifact`.
2. After successful persistence, the ledger is authoritative. A second call with the same `inputSourceHash` and no `forceRebuild` returns the persisted `opportunities` without rebuilding from UED/evaluation payload.
3. If the source inputs change (hash mismatch) and rebuildable source exists, the ledger is rebuilt and persisted; stale projections are discarded.
4. Legacy A-only persisted artifacts continue to load safely: `candidate_text_b` and `candidate_text_c` remain `undefined`, and the Workbench card renders as a strategy or withheld card without LLM regeneration.
5. Candidate text is never regenerated, copied, or inferred during projection. Every downstream surface displays exactly the values from the persisted ledger.

## Implementation corrections made

- `lib/evaluation/canonicalOpportunityLedger.ts`
  - Extended `RawCriterionRecommendation` with optional `cause` and `fix_direction`.
  - Extended `RawOpportunity` and `CanonicalOpportunityLedgerItem` with `candidate_text_b` and `candidate_text_c`.
  - `collectRawOpportunities` now copies A/B/C and falls back to `cause`/`fix_direction` when `mechanism`/`specific_fix` are absent.
  - `mergeCluster` preserves A/B/C using `candidateTextFromCluster`.
- `lib/evaluation/shortFormReportDocument.ts`
  - Extended `ShortFormCriterionRecommendation` with optional `candidate_text_a/b/c` so report conversions do not drop them.
- `lib/revision/opportunityLedger.ts`
  - `canonicalUedOpportunityToRevisionOpportunity` now passes B/C into `ensureOpportunityCandidates`.
  - `ensureOpportunityCandidates` hydration trigger now fires only when `candidate_text_a` is missing, so legacy A-only data does not auto-regenerate B/C.
  - `ensureRevisionOpportunityLedgerArtifact` computes an input-only `inputSourceHash` and treats a matching persisted ledger as authoritative, returning existing opportunities without rebuilding.
- `__tests__/lib/revision/candidateABCAuthority.test.ts`
  - Added 7 characterization tests covering extraction, ledger construction, ledger persistence, reload authority, Workbench projection, and legacy A-only compatibility.

## Test results

- `npx tsc --noEmit` passes.
- `npx eslint <changed files>` passes (no errors; pre-existing warnings only).
- `git diff --check` passes.
- `npx jest --runInBand lib/revision/__tests__ __tests__/lib/revision` passes.
