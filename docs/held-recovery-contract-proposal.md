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

For provenance, each producer may carry a non-canonical `producerModule` string.

### 1.2 Proposed `RecoveryAuthorityRole`

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

The recovery planner binds to the origin producer (`preflight`/`canon_gate`) and code `canon_authority_blocked` rather than creating a new recovery contract for `base_decision:canon_unclear` or `final_decision:withheld`.

### 2.1 Decision-owned reasons

A small set of base/final decision codes represent genuinely decision-owned conditions with no upstream origin code. These are the only decision-projection reasons that may directly initiate a recovery action:

| Decision code | Source of projection | Default `RecoveryExecutionAction` | Authority role | Rationale |
|---|---|---|---|---|
| `passage_too_long` | `base_decision` / `final_decision` from `scope` + source-text length | `rerun_admission` | `decision_projection` | No upstream emits this exact code; it is derived from `passageLengthForExecutability`. |
| `copy_paste_admission_failed` | `base_decision` / `final_decision` | `rerun_admission` | `decision_projection` | Summary code emitted only when the copy-paste gate fails; the planner decomposes it into underlying admission reasons when they are present. |
| `strategy_admission_failed` | `base_decision` / `final_decision` | `rerun_admission` | `decision_projection` | Same as above for the strategy gate. |

If a decision-projection code appears alongside an origin code for the same underlying issue, the origin producer wins and the decision-projection code is treated as audit context only.

### 2.2 Non-authoritative fields

The following fields are **not** authoritative for recovery planning:

- `executabilityReasons` — presentation copy of `finalDecision.reasons`.
- `groundingNote` — admin/display annotation.
- `item.cardType` / `item.readiness` — stale mirrored fields; routing authority is `classification.finalDecision.cardType`.

## 3. Contract schema: execution only

Policy (recoverability, automatic permission, author actions, terminal outcomes, hard-blocker status) stays in `HeldReasonInfo`. The recovery contract describes only what the executor must do.

```typescript
export type RecoveryExecutionAction =
  | 'resolve_anchor'
  | 'retrieve_context'
  | 'repair_diagnosis'
  | 'create_versioned_candidate_set'
  | 'none'

export type RecoveryValidationStep =
  | 'rerun_admission'
  | 'reclassify'

export type RecoveryExecutionMode =
  | 'deterministic'
  | 'llm_assisted'
  | 'author_assisted'
  | 'none'

export type RecoveryInputSource =
  | 'canonical_opportunity'
  | 'persisted_ledger'
  | 'classification'
  | 'author_submission'
  | 'manuscript_artifact'

export type RecoveryInputValidation =
  | 'non_empty'
  | 'valid_anchor'
  | 'complete_diagnostic'
  | 'complete_candidate_set'
  | 'source_hash_match'

export type RecoveryInputRequirement = {
  key: string
  source: RecoveryInputSource
  required: boolean
  validation: RecoveryInputValidation
  notes?: string
}

export type HeldReasonRecoveryContract = {
  producer: HeldReasonProducer
  producerModule?: string
  code: string
  authorityRole: RecoveryAuthorityRole
  recoveryAction: RecoveryExecutionAction
  validationStep: RecoveryValidationStep | null
  requiredInputs: RecoveryInputRequirement[]
  executionMode: RecoveryExecutionMode
}
```

`HeldReasonInfo` is extended with `recoveryContract?: HeldReasonRecoveryContract`. The contract is either explicit or derived from `repairFamily` using the default mapping below, with per-code overrides for decision-owned codes and author-assisted cases.

## 4. Execution action → inputs and provenance

The existing `REPAIR_FAMILY_TEMPLATES` defines the ordered repair pipeline. The contract layer adds a single `RecoveryExecutionAction` and structured `requiredInputs` for each family.

| Family | Default action | Validation step | `executionMode` | `requiredInputs` |
|---|---|---|---|---|
| `anchor` | `resolve_anchor` | `rerun_admission` | `deterministic` | `source_text` (`canonical_opportunity`, `non_empty`), `manuscript_coordinates` (`canonical_opportunity`, `valid_anchor`), `evidence_anchor` (`manuscript_artifact`, `valid_anchor`) |
| `context` | `retrieve_context` | `rerun_admission` | `deterministic` | `source_text` (`canonical_opportunity`, `non_empty`), `evidence_anchor` (`manuscript_artifact`, `valid_anchor`), `manuscript_chunks` (`manuscript_artifact`, `non_empty`) |
| `diagnosis` | `repair_diagnosis` | `rerun_admission` | `llm_assisted` | `symptom` (`canonical_opportunity`, `complete_diagnostic`), `cause` (`canonical_opportunity`, `complete_diagnostic`), `fix_direction` (`canonical_opportunity`, `complete_diagnostic`), `reader_effect` (`canonical_opportunity`, `complete_diagnostic`), `rationale` (`canonical_opportunity`, optional) |
| `candidates` | `create_versioned_candidate_set` | `rerun_admission` | `llm_assisted` | `existing_candidates_a_b_c` (`persisted_ledger`, `complete_candidate_set`, `required: false`), `source_text` (`canonical_opportunity`, `non_empty`), `evidence_anchor` (`manuscript_artifact`, `valid_anchor`), `rationale` (`canonical_opportunity`), `diagnostic_object` (`classification`) |
| `strategy` | `none` | `rerun_admission` | `none` | `full_opportunity` (`classification`, `source_hash_match`) |
| `none` | `none` | `reclassify` or `null` | `none` | `[]` |

### 4.1 Per-code overrides

| Reason code | `repairFamily` | `recoveryAction` | `validationStep` | `executionMode` | Why |
|---|---|---|---|---|---|
| `canon_authority_blocked` | `none` | `none` | `null` | `author_assisted` | Canon/authority conflict is an author disposition, not an executor action. |
| `hard_canon_conflict` | `none` | `none` | `null` | `author_assisted` | Same; terminal if author cannot resolve. |
| `hard_context_block` | `none` | `none` | `null` | `none` | Terminal hard blocker. |
| `testimony_fabrication_risk` | `none` | `none` | `null` | `none` | Intentionally non-recoverable. |
| `integrity_*` | `none` | `none` | `null` | `author_assisted` | Currently non-recoverable through automatic repair. |
| `passage_too_long` | `strategy` | `none` | `rerun_admission` | `none` | Strategy-routing decision with no automated repair; validation after scope/passage change. |
| `copy_paste_admission_failed` | `candidates` / `diagnosis` | `none` | `rerun_admission` | `deterministic` | Decision-owned summary; decompose into underlying admission reasons. If decomposition is empty, `rerun_admission` validates only after author/LLM-provided context. |
| `strategy_admission_failed` | `diagnosis` | `none` | `rerun_admission` | `deterministic` | Same as above. |

## 5. Author dispositions

Author dispositions are separate from executor actions. The executor never executes a disposition; it records the author's choice and transitions the attempt.

```typescript
export type RequiredAuthorDisposition =
  | 'provide_context'
  | 'request_reanalysis'
  | 'dismiss'
  | 'save_as_note'
  | 'author_assisted_canon_review'
```

The link to `HeldReasonInfo`:

- `HeldReasonInfo.automaticRecoveryAllowed` still gates whether the executor may run automatically.
- `HeldReasonInfo.allowedAuthorActions` still lists the dispositions available to the author.
- `HeldReasonInfo.recoverable`, `allowedTerminalOutcomes`, and `isHardBlocker` still define the policy outcome.
- `HeldReasonRecoveryContract` describes only the `executionMode` (`deterministic`, `llm_assisted`, `author_assisted`, `none`) and the `recoveryAction`, if any.

## 6. Allowed terminal outcomes

`HeldReasonInfo.allowedTerminalOutcomes` defines the post-recovery queues a reason can reach:

- `copy_paste_rewrite` — candidate is authoritative and ready for the copy-paste queue.
- `revision_strategy` — work requires strategy/author review before execution.
- `withheld` — remains held.

A hard blocker clears all terminal outcomes to `['withheld']`. An unknown canonical reason does the same.

## 7. Versioned candidate-set regeneration

The action `create_versioned_candidate_set` replaces the loose idea of "regeneration". It is defined as:

- **Always creates a new versioned candidate set**; it never mutates an authoritative persisted set.
- **The previous A/B/C set is retained for audit** and is the default source if regeneration fails.
- **No partial "fill in B/C" behaviour**: either the full A/B/C set is produced and passes quality, or the attempt fails and the previous set remains authoritative.
- **`existing_candidates_a_b_c` is an optional input**. If a complete persisted set exists, it is preserved unchanged as the prior version. If none exists, creation of the first complete versioned set is allowed only for reason codes whose approved policy explicitly permits it.
- **Missing `candidate_text_b` or `candidate_text_c` alone must not authorize regeneration.** Regeneration is triggered only by a material change in authoritative inputs or by an explicitly authorized origin reason, not by absence.
- **Regeneration is allowed at most once per unique `opportunityVersion` + `candidateSetVersion` + diagnostic/rationale fingerprint.**
- If authoritative inputs have not changed since the last attempt, the executor must not regenerate; it must either reclassify using the existing set or remain held.
- New candidates are persisted only with a new source hash and only after passing the same admission gates that produced the held state.

This preserves the candidate A/B/C authority from PR #1323: canonical deduplication uses one authoritative `RawOpportunity`, and downstream projection uses exactly the persisted candidates.

## 8. Retry identity and bounds

### 8.1 Retry identity

A recovery attempt is identified by:

```typescript
export type RecoveryAttemptKey = {
  opportunityVersion: string      // canonical source hash from the repository's opportunity build logic
  candidateSetVersion: string | null  // canonical hash of the authoritative persisted A/B/C set
  producer: HeldReasonProducer
  code: string
  recoveryAction: RecoveryExecutionAction
  recoveryInputFingerprint: string // action-specific fingerprint, not a new canonical identity
}
```

Identity authority is layered:

- `opportunityVersion` is the canonical source hash produced by the existing opportunity-ledger build logic (e.g. `sourceHashFor` in `lib/revision/opportunityLedger.ts`). It must not be redefined by the recovery executor.
- `candidateSetVersion` is the canonical hash of the authoritative persisted `candidate_text_a/b/c` or `options` trio, computed with the same stable-hash function used elsewhere (e.g. `sourceHashFor` / `stableStringify`). It must not be redefined by the recovery executor.
- `recoveryInputFingerprint` is action-specific and used only to detect whether the inputs consumed by this particular action have changed since the last attempt. It is not a canonical opportunity or candidate identity.

Action-specific fingerprints include:

- `resolve_anchor`: `anchor` + `quoteHighlight` + `quoteRest`
- `retrieve_context`: `anchor` + `quoteHighlight` + `quoteRest`
- `repair_diagnosis`: `symptom` + `cause` + `fixDirection` + `readerEffect` + `rationale`
- `create_versioned_candidate_set`: `opportunityVersion` + `candidateSetVersion` + `diagnostic_object` + `rationale`
- `rerun_admission`: `opportunityVersion` + `candidateSetVersion`

A new attempt is created when the canonical `opportunityVersion` or `candidateSetVersion` changes, **not** when a retry counter increments. The action-specific fingerprint decides whether the same action should run again on the same canonical version.

### 8.2 Retry bounds

- `HELD_RECOVERY_MAX_RETRIES = 3` per `RecoveryAttemptKey`.
- `rerun_admission` is a validation/finalization step; it must not be retried independently. It runs once after a prior recovery action has materially changed the authoritative inputs, and only if the source hash has changed.
- If an action produces the same output on the same inputs, the executor must not count it as a new attempt; it must either remain held or move to terminal state.

## 9. Unknown producer / reason handling (fail closed)

The existing `getHeldReasonInfo` and `buildRecoveryPlan` already implement the core fail-closed rule:

- Unknown canonical reasons set `isUnknown: true`, `recoverable: false`, `automaticRecoveryAllowed: false`.
- `buildRecoveryPlan` returns `unknownCanonicalReasons` and `recoverable: false`, restricting terminal outcomes to `withheld`.

The executor contract must mirror this:

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

No generic anchor expansion, context retrieval, candidate generation, or strategy conversion may be used as a fallback for an unknown `producer:code` pair.

## 10. Audit: structured events and snapshot

Before an attempt enters a runnable state, the executor must create an immutable `RecoveryAttemptSnapshot`.

```typescript
export type RecoveryAttemptSnapshot = {
  idempotencyKey: string
  manuscriptVersionSha: string
  opportunityId: string
  trigger: 'request_reanalysis' | 'provide_more_context' | 'system' | 'author'
  canonicalReasons: CanonicalHeldReasonOccurrence[]
  originalBaseReasons: string[]
  originalFinalReasons: string[]
  promotionTransitionReason: string | null
  sourceHashBefore: string
}
```

The audit trail is a structured event log, not free-form strings:

```typescript
export type RecoveryAuditEvent = {
  at: string
  event:
    | 'snapshot_created'
    | 'action_started'
    | 'action_succeeded'
    | 'action_failed'
    | 'reclassified'
    | 'remained_held'
    | 'dismissed'
  action?: RecoveryExecutionAction
  disposition?: RequiredAuthorDisposition
  producer?: HeldReasonProducer
  code?: string
  sourceHashBefore?: string
  sourceHashAfter?: string
  details?: Record<string, unknown>
}
```

`RecoveryAttempt` would hold `events: RecoveryAuditEvent[]` instead of `auditTrail: string[]`.

## 11. Preserving original withheld reasons during `needs_targeting` promotion

The characterization tests proved that `readiness === 'needs_targeting'` can promote a `withheld` item to `revision_strategy` with an empty `finalDecision.reasons` array, discarding the original `evidence_missing` / `context_missing` / `diagnosis_unsupported` explanation.

The `RecoveryAttemptSnapshot` preserves those original reasons independently of the promoted `finalDecision`:

- `originalBaseReasons` stores `classification.baseDecision.reasons`.
- `originalFinalReasons` stores `classification.finalDecision.reasons` at the moment recovery is initiated.
- `promotionTransitionReason` stores the transition text.
- `canonicalReasons` continues to be collected from all origin sources, so the original cause is not lost even when `finalDecision.reasons` is empty.

## 12. `rerun_admission` as post-repair validation

`rerun_admission` is not a `RecoveryExecutionAction`; it is a `RecoveryValidationStep` in `HeldReasonRecoveryContract.validationStep`. It is a validation/finalization step that:

- Runs only after a prior `RecoveryExecutionAction` has materially changed the authoritative inputs (or after an author/LLM action such as `provide_context` or `repair_diagnosis`).
- Does not consume a retry by itself.
- Re-runs `classifyWorkbenchExecutabilityDetailed` with the repaired inputs.
- Produces the new terminal classification.
- If no canonical `opportunityVersion` or `candidateSetVersion` has changed since the previous classification, it must not run; the executor must use the existing classification or remain held.
- Decision-owned summary codes (`copy_paste_admission_failed`, `strategy_admission_failed`, `passage_too_long`) do not select `rerun_admission` as an independent repair; the validation step fires only after the underlying origin reason has been repaired or after an authorized context change.

## 13. Contract invariants

The following invariants must hold for any implementation derived from this contract:

1. **Single policy authority.** `HeldReasonInfo` is the only source for `recoverable`, `automaticRecoveryAllowed`, `allowedAuthorActions`, `allowedTerminalOutcomes`, and `isHardBlocker`.
2. **Origin-producer authority.** A `RecoveryExecutionAction` is selected only by an origin `HeldReasonProducer`. Decision-projection and annotation sources inform audit and routing but do not initiate independent recovery.
3. **No decision-summary repair.** `copy_paste_admission_failed`, `strategy_admission_failed`, and `passage_too_long` do not select their own repair action; they either decompose into origin reasons or remain in strategy/withheld until an upstream input changes.
4. **Canonical identity reuse.** `opportunityVersion` and `candidateSetVersion` are computed by existing repository helpers, not redefined by the recovery executor. `recoveryInputFingerprint` is action-specific and subordinate.
5. **Versioned candidates.** `create_versioned_candidate_set` always creates a new complete A/B/C version; it never mutates the persisted set or fills in missing B/C.
6. **Missing B/C does not authorize regeneration.** Regeneration requires a material input change or an explicitly authorized origin reason.
7. **Fail-closed unknowns.** An unknown `producer:code` remains held with `UNKNOWN_RECOVERY_CONTRACT`; no generic fallback is permitted.
8. **Audit before execution.** A `RecoveryAttemptSnapshot` is created before any runnable recovery step, and the audit trail is a structured `RecoveryAuditEvent[]`.
9. **Promotion provenance preserved.** `originalBaseReasons`, `originalFinalReasons`, and `promotionTransitionReason` are preserved independently of `finalDecision.reasons`.
10. **Validation does not retry.** `rerun_admission` runs once per changed canonical version and does not consume a retry.

## 14. Non-goals for this proposal phase

The following are intentionally out of scope until the contract is approved:

- Implementation of `heldRecoveryExecutor.ts`.
- Implementation of a `switch (\`${producer}:${code}\`)` dispatcher.
- Any runtime code that mutates `WorkbenchOpportunity`, `ClassifiedWorkbenchOpportunity`, or the Workbench queue.
- Any persistence or database writes.
- Any UI recovery controls or API endpoints.
- Any wiring that calls the recovery engine from `getWorkbenchQueue`, `partitionClassifiedWorkbenchQueue`, or other production paths.

## 15. Open questions for review

1. Should the canonical source-hash input set for candidates include the full `diagnostic` object or only the top-level diagnostic fields?
2. Is `create_versioned_candidate_set` the right action name, or should it be `regenerate_candidates` with explicit version semantics in the contract?
3. Should the executor emit `action_failed` once per attempt or once per retry?
4. Should `passage_too_long` eventually map to a real `RecoveryExecutionAction` such as `split_passage_or_reduce_scope`, or remain a non-recoverative strategy-routing decision?
5. Which existing repository helper should be the canonical source of `opportunityVersion` for recovery attempts?
