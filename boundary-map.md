# A/B/C Candidate Persistence Boundary Map

Fixture: one `evaluation_result_v2` recommendation with distinct sentinel values
- `candidate_text_a` = `AAA_SENTINEL: Mara paused at the threshold until the room understood her choice.`
- `candidate_text_b` = `BBB_SENTINEL: For the moment, Mara held the door open and let the silence settle before she answered.`
- `candidate_text_c` = `CCC_SENTINEL: The answer stayed in Mara's hand before it reached her voice, quiet and deliberate.`

| Boundary | A | B | C | Notes |
|---|---|---|---|---|
| Source `evaluation_result_v2` | written | written | written | Recommendation row may contain all three. |
| `buildRevisionOpportunitiesFromEvaluationPayload` | preserved | preserved | preserved | `extractCriteriaRecommendations` passes all three to `ensureOpportunityCandidates` (if source row has them). |
| `buildCanonicalOpportunityLedger` | preserved | **lost** | **lost** | `RawOpportunity`/`CanonicalOpportunityLedgerItem` only store `candidate_text_a`; `mergeCluster` only emits `candidate_text_a`. |
| UED `canonicalOpportunityLedger.opportunities` | stored | not stored | not stored | Because `buildCanonicalOpportunityLedger` drops B/C before UED serialization. |
| `extractCanonicalRevisionOpportunities` | returned | absent | absent | Reads UED items; B/C absent from source. |
| `canonicalUedOpportunityToRevisionOpportunity` | passed | not read | not read | Only reads `candidate_text_a` from item; does not pass B/C to `ensureOpportunityCandidates`. |
| `ensureRevisionOpportunityLedgerArtifact` (UED path) | preserved | **lost** | **lost** | B/C never enter `opportunities` array. |
| Persisted `revision_opportunity_ledger_v1` payload | stored | **lost** | **lost** | `opportunities` array in JSONB content reflects the in-memory array. |
| `getWorkbenchQueue` final `WorkbenchOption` | visible | **lost/empty** | **lost/empty** | If UED path used, `opportunity.candidate_text_b/c` undefined/empty. |

## Key authority questions

1. `buildCanonicalOpportunityLedger` is the first loss point: it does not carry `candidate_text_b/c` into the canonical ledger item.
2. `canonicalUedOpportunityToRevisionOpportunity` is the second loss point: even if the UED item contained B/C, it would not pass them on.
3. `ensureRevisionOpportunityLedgerArtifact` currently rebuilds from the UED / `evaluation_result_v2` and does not treat the persisted `revision_opportunity_ledger_v1` artifact as an authority. A genuine "persisted reload" would require either:
   - `ensureRevisionOpportunityLedgerArtifact` to return an existing persisted ledger when the source hash is unchanged (or when `forceRebuild` is false), or
   - `getWorkbenchQueue` to read `revision_opportunity_ledger_v1` directly.
4. Legacy A-only data: if a persisted `revision_opportunity_ledger_v1` (or legacy UED) contains only `candidate_text_a`, the current `ensureOpportunityCandidates` sets B/C to `''` and marks `grounding_status` as `unsupported_blocked`. With no `OPENAI_API_KEY` present the LLM hydration block is skipped, so no auto-regeneration occurs. However, the `needsCandidates` check currently tests `!candidate_text_b || !candidate_text_c`; if an API key were present and preflight passed, it would trigger `hydrateLedgerCandidates` for A-only data.

## Proposed smallest corrections

- Add `candidate_text_b` and `candidate_text_c` to `RawOpportunity` and `CanonicalOpportunityLedgerItem` in `lib/evaluation/canonicalOpportunityLedger.ts`.
- Populate them in `collectRawOpportunities` and `mergeCluster`.
- Update `canonicalUedOpportunityToRevisionOpportunity` in `lib/revision/opportunityLedger.ts` to read and pass `candidate_text_b/c`.
- Update `opportunityToCriterionRecommendation` and `opportunityToActionItem` for completeness (report display uses A only, but harmless to include B/C).
- For legacy A-only: ensure the hydration trigger does not fire solely because B/C are missing. Tying this to provenance/source mode is preferable to a global condition.

## Characterization tests needed

- `buildRevisionOpportunitiesFromEvaluationPayload` preserves A/B/C sentinels.
- `buildCanonicalOpportunityLedger` preserves A/B/C sentinels.
- `extractCanonicalRevisionOpportunities` preserves A/B/C sentinels from a hand-constructed UED.
- `ensureRevisionOpportunityLedgerArtifact` persists and returns A/B/C sentinels when given a UED containing them.
- A genuine reload: after first call, mutate/delete the UED, second call reads persisted `revision_opportunity_ledger_v1` and returns the same A/B/C sentinels (requires a reload authority decision).
- `getWorkbenchQueue` returns `WorkbenchOption` `candidateText` values matching A/B/C sentinels.
- Legacy A-only UED: no LLM `hydrateLedgerCandidates` call, returned opportunities have empty/missing B/C and safe `grounding_status`.
