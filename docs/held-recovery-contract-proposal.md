# Held Recovery Contract — Design Proposal

**Status:** design proposal awaiting review  
**Scope:** recovery-contract schema and authority boundaries only. No executor, dispatcher, runtime wiring, persistence changes, queue mutations, or UI controls are included in this proposal.

This document builds on the approved `docs/held-recovery-producer-inventory.md` and the existing contract modules in `lib/revision/heldRecoverySources.ts`, `lib/revision/heldRecoveryReasons.ts`, `lib/revision/heldRecoveryState.ts`, and `lib/revision/heldRecoveryPlan.ts`.

## 1. Canonical producer and reason identities

A Held Recovery contract is identified by a stable pair:

```text
producer  – the module/phase that owns the diagnostic (e.g. 'lib/revision/anchorContract.ts')
code      – the normalized reason code from that producer (e.g. 'anchor_not_precise')
```

The existing `HELD_REASON_SOURCE_REGISTRY` already maps each `HeldReasonSource` to its owning module and field. The proposal is to add an explicit `producer` string to `HeldReasonInfo` so the recovery planner can emit a machine-actionable contract object rather than deriving producer ownership at runtime.

Proposed mapping from existing `HeldReasonSource` to producer module:

| `HeldReasonSource` | Producer module / file |
|---|---|
| `grounding` | `lib/revision/workbenchQueue.ts` (SLAE evidence matching) / `lib/revision/opportunityLedger.ts` |
| `preflight` | `lib/revision/opportunityLedger.ts` |
| `hydration` | `lib/revision/opportunityLedger.ts` |
| `res_blocker` | `lib/revision/workbenchQueue.ts` |
| `copy_paste_admission` | `lib/revision/reviseAdmissionGate.ts` (`runCopyPasteAdmissionGate`) |
| `strategy_admission` | `lib/revision/reviseAdmissionGate.ts` (`runStrategyAdmissionGate`) |
| `base_decision` | `lib/revision/recommendationExecutability.ts` (`evaluateRecommendationExecutability`) |
| `final_decision` | `lib/revision/workbenchQueueProjection.ts` (`classifyWorkbenchExecutabilityDetailedCore`) |
| `integrity` | `lib/evaluation/pipeline/recommendationIntegrityGate.ts` |
| `candidate_quality` | `lib/revision/candidateQuality.ts` |
| `voice_gate` | `lib/revision/voiceGate.ts` |
| `canon_gate` | `lib/revision/canonGate.ts` |

Reason normalization remains `normalizeHeldReasonCode` (lowercase, collapse non-alphanumerics to `_`, trim underscores). Unknown codes normalize to themselves and are handled by the fail-closed path.

## 2. Authoritative source for initiating recovery

Recovery must be initiated from the same canonical planning sources that `heldRecoveryPlan.collectCanonicalReasons` already consumes:

- `classification.copyPasteAdmissionReasons`
- `classification.strategyAdmissionReasons`
- `classification.baseDecision.reasons`
- `classification.finalDecision.reasons`
- `hydrationFailureReasons` / `resBlockerReasons` (split from `preflightReasons`)
- `preflightReasons`

Display-only fields must **not** drive recovery:

- `executabilityReasons` is a presentation copy of `finalDecision.reasons`.
- `groundingNote` is an admin/display annotation.
- `item.cardType` / `item.readiness` on `ClassifiedWorkbenchOpportunity` are stale mirrored fields; routing authority is `classification.finalDecision.cardType`.

The recovery contract must also record the `promotionTransitionReason` and the original `baseDecision.reasons` because `finalDecision.reasons` may be replaced (for example, by the `needs_targeting` promotion that currently produces an empty reason array).

## 3. Proposed contract schema

```typescript
export type RecoveryActionName =
  | 'resolve_anchor'
  | 'retrieve_context'
  | 'repair_diagnosis'
  | 'regenerate_candidates'
  | 'rerun_admission'
  | 'author_assisted_canon_review'
  | 'dismiss_or_save_as_note'
  | 'none'

export type RecoveryInputKey =
  | 'source_text'            // from quoteHighlight + quoteRest
  | 'manuscript_coordinates' // from anchor / manuscript_coordinates
  | 'evidence_anchor'          // resolved anchor snippet
  | 'manuscript_chunks'
  | 'symptom'
  | 'cause'
  | 'fix_direction'
  | 'reader_effect'
  | 'rationale'
  | 'existing_candidates_a_b_c' // the authoritative persisted A/B/C options
  | 'diagnostic_object'
  | 'full_opportunity'

export type HeldReasonContract = {
  producer: string
  code: string
  recoveryAction: RecoveryActionName
  requiredInputs: RecoveryInputKey[]
  deterministic: boolean
  llmAssisted: boolean
  automaticAllowed: boolean
  allowedAuthorActions: HeldAuthorAction[]
  allowedTerminalOutcomes: HeldTerminalOutcome[]
  isHardBlocker: boolean
}
```

`HeldReasonInfo` would be extended with an optional `contract?: HeldReasonContract`. For every inventory entry, the contract is either explicit or derived from `repairFamily` using the default mapping below, with per-code overrides for hard blockers and author-assisted cases.

## 4. Recovery family → action, inputs, and provenance

The existing `REPAIR_FAMILY_TEMPLATES` already defines an ordered repair pipeline per family. The contract layer adds a single canonical `recoveryAction` and `requiredInputs` for each family.

| Family | Default `recoveryAction` | `requiredInputs` | Provenance |
|---|---|---|---|
| `anchor` | `resolve_anchor` | `source_text`, `manuscript_coordinates`, `evidence_anchor` | `opportunityLedger.ts` / `anchorContract.ts` (`anchor`, `quoteHighlight+quoteRest`) |
| `context` | `retrieve_context` | `source_text`, `evidence_anchor`, `manuscript_chunks` | `opportunityLedger.ts` hydration (`findHydrationChunkForAnchor`) |
| `diagnosis` | `repair_diagnosis` | `symptom`, `cause`, `fix_direction`, `reader_effect`, `rationale` | `reviseAdmissionGate.ts` / `recommendationIntegrityGate.ts` |
| `candidates` | `regenerate_candidates` | `existing_candidates_a_b_c`, `source_text`, `evidence_anchor`, `rationale`, `diagnostic_object` | `candidateQuality.ts` / `candidateHydration.ts` |
| `strategy` | `rerun_admission` | `full_opportunity`, `source_text` | `reviseAdmissionGate.ts` |
| `none` | `none` | `[]` | terminal state; only author actions allowed |

Per-code overrides:

| Reason code | `repairFamily` | Override `recoveryAction` | Why |
|---|---|---|---|
| `canon_authority_blocked` | `none` | `author_assisted_canon_review` | Canon/authority conflict may be resolvable by an author but not automatically. |
| `hard_canon_conflict` | `none` | `author_assisted_canon_review` | Same; terminal if author cannot resolve. |
| `hard_context_block` | `none` | `none` | Terminal hard blocker. |
| `testimony_fabrication_risk` | `none` | `dismiss_or_save_as_note` | Intentionally non-recoverable; only author disposition. |
| `integrity_*` | `none` | `none` | Currently non-recoverable through automatic repair; author-assisted review may be added later per-code. |

## 5. Automatic vs author-assisted recovery

The existing `HeldReasonInfo.automaticRecoveryAllowed` and `allowedAuthorActions` already encode this distinction. The contract layer preserves it:

- If `automaticRecoveryAllowed === true` and `recoverable === true`, the recovery action may run automatically within its bounds.
- If `automaticRecoveryAllowed === false` or `recoverable === false`, the item remains held and one of the `allowedAuthorActions` must be chosen:
  - `provide_context` (author supplies missing input)
  - `request_reanalysis` (trigger a bounded re-evaluation)
  - `dismiss` (remove from held panel)
  - `save_as_note` (keep the finding but do not route to a revision queue)

## 6. Allowed terminal outcomes

`HeldReasonInfo.allowedTerminalOutcomes` already lists the post-recovery queues a reason can reach:

- `copy_paste_rewrite` — candidate is authoritative and ready for the copy-paste queue.
- `revision_strategy` — work requires strategy/author review before execution.
- `withheld` — remains held.

A hard blocker clears all terminal outcomes to `['withheld']`. An unknown canonical reason does the same.

## 7. Retry and regeneration bounds

Proposed bounds to be enforced by the executor when it is later implemented:

- `HELD_RECOVERY_MAX_RETRIES = 3` per `RecoveryAttempt`.
- Regeneration (`regenerate_candidates`) is allowed at most once per unique source-hash version of an opportunity.
- If the authoritative inputs (anchor, source text, diagnostic, rationale) have not changed since the last attempt, the executor must not regenerate; it must either reclassify or remain held.
- Regeneration must not regenerate `candidate_text_b` or `candidate_text_c` merely because they are absent. It must not overwrite a persisted A/B/C trio. New candidates are persisted only with a new source hash.

## 8. Unknown producer / reason handling (fail closed)

The existing `getHeldReasonInfo` and `buildRecoveryPlan` already implement the core fail-closed rule:

- Unknown canonical reasons set `isUnknown: true`, `recoverable: false`, `automaticRecoveryAllowed: false`.
- `buildRecoveryPlan` returns `unknownCanonicalReasons` and `recoverable: false`, restricting terminal outcomes to `withheld`.
- Unknown annotations are collected in `unknownAnnotations` but do not fail planning by themselves.

The recovery executor must mirror this:

```typescript
// proposed dispatcher contract, not implementation
default:
  return remainHeld({
    code: 'UNKNOWN_RECOVERY_CONTRACT',
    originalProducer: producer,
    originalCode: code,
    originalReasons: canonicalReasons,
  })
```

No generic anchor expansion, context retrieval, candidate generation, or strategy conversion may be used as a fallback for an unknown producer/code pair.

## 9. Audit record

The existing `RecoveryAttempt` type in `lib/revision/heldRecoveryState.ts` is the audit record. The proposal extends it to preserve the full recovery context:

```typescript
export type RecoveryAttempt = {
  idempotencyKey: string
  manuscriptVersionSha: string
  opportunityId: string
  trigger: 'request_reanalysis' | 'provide_more_context' | 'system' | 'author'
  repairPlan: HeldRecoveryStep[]
  attemptNumber: number
  maxAttempts: number
  status: HeldRecoveryState
  outcome: 'pending' | 'succeeded' | 'failed_retryable' | 'failed_terminal' | 'dismissed'
  terminalCardType: 'copy_paste_rewrite' | 'revision_strategy' | 'withheld' | null
  terminalTrustedPathStatus: 'eligible' | 'unavailable_author_review_required' | 'impossible' | null
  auditTrail: string[]
  createdAt: string
  updatedAt: string

  // Proposed additions
  originalBaseReasons: string[]          // baseDecision.reasons before any promotion
  originalFinalReasons: string[]         // finalDecision.reasons as routed
  promotionTransitionReason: string | null
  canonicalReasons: CanonicalHeldReasonOccurrence[]
  appliedRecoveryActions: RecoveryActionName[]
  sourceHashBefore: string
  sourceHashAfter: string | null
  unknownCanonicalReasons: string[]
  unknownAnnotations: string[]
}
```

## 10. Preserving original withheld reasons during `needs_targeting` promotion

The characterization tests proved that `readiness === 'needs_targeting'` can promote a `withheld` item to `revision_strategy` with an empty `finalDecision.reasons` array, discarding the original `evidence_missing` / `context_missing` / `diagnosis_unsupported` explanation.

The recovery contract must preserve those original reasons independently of the promoted `finalDecision`:

- `originalBaseReasons` stores `classification.baseDecision.reasons`.
- `originalFinalReasons` stores `classification.finalDecision.reasons` at the moment recovery is initiated.
- `promotionTransitionReason` stores the transition text.
- The recovery planner may still use `canonicalReasons` (from all planning sources) to choose the repair family, so the original cause is not lost.

This means `collectCanonicalReasons` should continue to collect from `baseDecision`, `finalDecision`, `copyPasteAdmissionReasons`, `strategyAdmissionReasons`, `hydration`, `preflight`, and `res_blocker`, while the `RecoveryAttempt` records the full provenance.

## 11. Recovery step order

The existing `REPAIR_STEP_ORDER` and `REPAIR_FAMILY_TEMPLATES` define the canonical order:

```text
expand_anchor → retrieve_context → re_ground → repair_diagnosis → regenerate_candidates → rerun_admission → reclassify
```

The contract layer proposes one additional meta-step:

- `preserve_original_reasons` — executed before any repair, it writes `originalBaseReasons` and `originalFinalReasons` into the audit record so later promotions cannot erase the initial diagnostic.

## 12. Non-goals for this proposal phase

The following are intentionally out of scope until the contract is approved:

- Implementation of `heldRecoveryExecutor.ts`.
- Implementation of a `switch (\`${producer}:${code}\`)` dispatcher.
- Any runtime code that mutates `WorkbenchOpportunity`, `ClassifiedWorkbenchOpportunity`, or the Workbench queue.
- Any persistence or database writes.
- Any UI recovery controls or API endpoints.
- Any wiring that calls the recovery engine from `getWorkbenchQueue`, `partitionClassifiedWorkbenchQueue`, or other production paths.

## 13. Open questions for review

1. Should `producer` be a file path, a stable short name (e.g. `anchor_grounding`), or both?
2. Should the `recoveryAction` field live directly on `HeldReasonInfo`, or should it be looked up from `repairFamily` with a per-code override table?
3. Is `regenerate_candidates` allowed to fall back to a strategy queue if regenerated candidates still fail quality, or must it remain held?
4. Should `needs_targeting` promotion be allowed to discard `finalDecision.reasons`, or should the promoted `revision_strategy` retain the original base reasons in its `reasons` array?
5. What is the canonical source-hash input set for an opportunity? (anchor + quoteHighlight + quoteRest + symptom + cause + fixDirection + readerEffect + rationale + options?)
6. Should `RecoveryAttempt` live in `lib/revision/heldRecoveryState.ts` or move to a persistence model once the executor is approved?
