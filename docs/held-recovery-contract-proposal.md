# Held Recovery Contract — Design Proposal

**Status:** design proposal awaiting review  
**Scope:** recovery-contract schema and authority boundaries only. No executor, dispatcher, runtime wiring, persistence changes, queue mutations, or UI controls are included in this proposal.

This document builds on the approved `docs/held-recovery-producer-inventory.md` and the existing contract modules in `lib/revision/heldRecoverySources.ts`, `lib/revision/heldRecoveryReasons.ts`, `lib/revision/heldRecoveryState.ts`, and `lib/revision/heldRecoveryPlan.ts`.

## 1. Canonical producer and reason identities

A Held Recovery contract is identified by a stable pair:

```text
producer  – a stable producer enum value (e.g. 'anchor_grounding')
code      – the normalized reason code emitted by that producer (e.g. 'anchor_not_precise')
```

The file or module that emitted a reason is descriptive metadata only. It must not be part of the canonical identity because files can be renamed, split, or consolidated without changing the contract.

### 1.1 Proposed `HeldReasonProducer` enum

```typescript
export type HeldReasonProducer =
  | 'grounding'
  | 'preflight'
  | 'hydration'
  | 'res_blocker'
  | 'copy_paste_admission'
  | 'strategy_admission'
  | 'integrity'
  | 'candidate_quality'
  | 'voice_gate'
  | 'canon_gate'
  | 'base_decision'
  | 'final_decision'
```

For provenance, each producer may carry a non-canonical `producerModule` string:

```typescript
export type HeldReasonContract = {
  producer: HeldReasonProducer
  producerModule?: string // e.g. 'lib/revision/anchorContract.ts'
  code: string
  // ...
}
```

### 1.2 Proposed `RecoveryAuthorityRole`

Each `HeldReasonSource` must be classified by authority role, not by file location:

```typescript
export type RecoveryAuthorityRole =
  | 'origin'              // owns the underlying diagnostic and selects the recovery action
  | 'decision_projection' // summarizes or transforms upstream diagnostics into a routing decision
  | 'annotation'            // display-only, never drives planning or routing
```

| `HeldReasonSource` | `RecoveryAuthorityRole` | `producerModule` (descriptive only) |
|---|---|---|
| `grounding` | `origin` | `lib/revision/workbenchQueue.ts` / `lib/revision/opportunityLedger.ts` |
| `preflight` | `origin` | `lib/revision/opportunityLedger.ts` |
| `hydration` | `origin` | `lib/revision/opportunityLedger.ts` |
| `res_blocker` | `origin` | `lib/revision/workbenchQueue.ts` |
| `copy_paste_admission` | `origin` | `lib/revision/reviseAdmissionGate.ts` |
| `strategy_admission` | `origin` | `lib/revision/reviseAdmissionGate.ts` |
| `integrity` | `origin` | `lib/evaluation/pipeline/recommendationIntegrityGate.ts` |
| `candidate_quality` | `origin` | `lib/revision/candidateQuality.ts` |
| `voice_gate` | `origin` | `lib/revision/voiceGate.ts` |
| `canon_gate` | `origin` | `lib/revision/canonGate.ts` |
| `base_decision` | `decision_projection` | `lib/revision/recommendationExecutability.ts` |
| `final_decision` | `decision_projection` | `lib/revision/workbenchQueueProjection.ts` |
| `executability` | `annotation` | `lib/revision/workbenchQueueProjection.ts` |
| `grounding_note` | `annotation` | `lib/revision/opportunityLedger.ts` |

### 1.3 Reason normalization

Reason normalization remains `normalizeHeldReasonCode` (lowercase, collapse non-alphanumerics to `_`, trim underscores). Unknown codes normalize to themselves and are handled by the fail-closed path.

## 2. Authoritative source for initiating recovery

Recovery actions must be selected by **origin producers only**. Decision projections and annotations may inform routing and audit, but they must not introduce independent recovery work when an origin producer already owns the same underlying condition.

For example:

```text
preflight ──► 'canon_authority_blocked' ──┐
                                          ▼
                           copy_paste_admission ──► 'canon_conflict' ──┐
                                                                        ▼
                                                         base_decision ──► 'canon_unclear'
                                                                        ▼
                                                            final_decision ──► 'withheld'
```

The recovery planner should bind to the origin producer (`preflight`/`canon_gate`) and code `canon_authority_blocked` rather than creating a new recovery contract for `base_decision:canon_unclear` or `final_decision:withheld`.

### 2.1 Decision-owned reasons

A small set of base/final decision codes represent genuinely decision-owned conditions with no upstream origin code. These are the only decision-projection reasons that may directly initiate a recovery action:

| Decision code | Source of projection | Default `recoveryAction` | Rationale |
|---|---|---|---|
| `passage_too_long` | `base_decision` / `final_decision` from `scope` + source-text length | `rerun_admission` | No upstream emits this exact code; it is derived from `passageLengthForExecutability`. |
| `copy_paste_admission_failed` | `base_decision` / `final_decision` | `rerun_admission` | Summary code emitted only when the copy-paste gate fails; the planner decomposes it into the underlying admission reasons when they are available. |
| `strategy_admission_failed` | `base_decision` / `final_decision` | `rerun_admission` | Same as above for the strategy gate. |

If a decision-projection code appears alongside an origin code for the same underlying issue, the origin producer wins and the decision-projection code is treated as audit context only.

### 2.2 Fields that may inform recovery planning

Origin reasons can be collected from the same fields `heldRecoveryPlan.collectCanonicalReasons` already consumes:

- `classification.copyPasteAdmissionReasons`
- `classification.strategyAdmissionReasons`
- `classification.baseDecision.reasons` (only for decision-owned codes)
- `classification.finalDecision.reasons` (only for decision-owned codes)
- `hydrationFailureReasons` / `resBlockerReasons`
- `preflightReasons`

The following fields are **not** authoritative for recovery planning:

- `executabilityReasons` — presentation copy of `finalDecision.reasons`.
- `groundingNote` — admin/display annotation.
- `item.cardType` / `item.readiness` — stale mirrored fields; routing authority is `classification.finalDecision.cardType`.

### 2.3 Audit preservation

The recovery contract must record:

- `originalBaseReasons` — `classification.baseDecision.reasons` at initiation.
- `originalFinalReasons` — `classification.finalDecision.reasons` at initiation.
- `promotionTransitionReason` — if `needsTargetingOverrideApplied` is true.

This preserves the original diagnostic even when `finalDecision.reasons` is replaced (for example, by the `needs_targeting` promotion that currently produces an empty reason array).

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
  producer: HeldReasonProducer
  producerModule?: string
  code: string
  authorityRole: RecoveryAuthorityRole
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

The existing `REPAIR_FAMILY_TEMPLATES` already defines an ordered repair pipeline per family. The contract layer adds a single canonical `recoveryAction` and `requiredInputs` for each family, sourced from the origin producer.

| Family | Default `recoveryAction` | `requiredInputs` | Origin producer / provenance |
|---|---|---|---|
| `anchor` | `resolve_anchor` | `source_text`, `manuscript_coordinates`, `evidence_anchor` | `grounding` / `preflight` / `hydration` / `anchorContract.ts` (`anchor`, `quoteHighlight+quoteRest`) |
| `context` | `retrieve_context` | `source_text`, `evidence_anchor`, `manuscript_chunks` | `hydration` / `preflight` (`findHydrationChunkForAnchor`) |
| `diagnosis` | `repair_diagnosis` | `symptom`, `cause`, `fix_direction`, `reader_effect`, `rationale` | `copy_paste_admission` / `strategy_admission` / `integrity` |
| `candidates` | `regenerate_candidates` | `existing_candidates_a_b_c`, `source_text`, `evidence_anchor`, `rationale`, `diagnostic_object` | `candidate_quality` / `voice_gate` / `canon_gate` |
| `strategy` | `rerun_admission` | `full_opportunity`, `source_text` | `strategy_admission` |
| `none` | `none` | `[]` | terminal state; only author actions allowed |

### 4.1 Per-code overrides

| Reason code | `repairFamily` | `recoveryAction` | Authority role | Why |
|---|---|---|---|---|
| `canon_authority_blocked` | `none` | `author_assisted_canon_review` | `origin` (`canon_gate` / `preflight`) | Canon/authority conflict may be resolvable by an author but not automatically. |
| `hard_canon_conflict` | `none` | `author_assisted_canon_review` | `origin` (`canon_gate` / `preflight`) | Same; terminal if author cannot resolve. |
| `hard_context_block` | `none` | `none` | `origin` (`preflight`) | Terminal hard blocker. |
| `testimony_fabrication_risk` | `none` | `dismiss_or_save_as_note` | `origin` (`candidate_quality`) | Intentionally non-recoverable; only author disposition. |
| `integrity_*` | `none` | `none` (or future `author_assisted_canon_review` per-code) | `origin` (`integrity`) | Currently non-recoverable through automatic repair. |
| `passage_too_long` | `strategy` | `rerun_admission` | `decision_projection` | Derived from `scope` + text length; no exact upstream code. |
| `copy_paste_admission_failed` | `candidates` / `diagnosis` | `rerun_admission` | `decision_projection` | Summary code; decompose into underlying admission reasons when present. |
| `strategy_admission_failed` | `diagnosis` | `rerun_admission` | `decision_projection` | Same as above for strategy gate. |

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
- The recovery planner continues to collect `canonicalReasons` from all origin sources, so the original cause is not lost even when `finalDecision.reasons` is empty.

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

1. Should `producer` values be a string enum (`HeldReasonProducer`) or remain as the existing `HeldReasonSource` strings?
2. Should the `recoveryAction` field live directly on `HeldReasonInfo`, or should it be looked up from `repairFamily` with a per-code override table?
3. Is `regenerate_candidates` allowed to fall back to a strategy queue if regenerated candidates still fail quality, or must it remain held?
4. Should `needs_targeting` promotion be allowed to discard `finalDecision.reasons`, or should the promoted `revision_strategy` retain the original base reasons in its `reasons` array?
5. What is the canonical source-hash input set for an opportunity? (anchor + quoteHighlight + quoteRest + symptom + cause + fixDirection + readerEffect + rationale + options?)
6. Should `RecoveryAttempt` live in `lib/revision/heldRecoveryState.ts` or move to a persistence model once the executor is approved?
