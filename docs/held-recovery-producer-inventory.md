# Held Recovery Producer Inventory

This document inventories every production path that can place a revision opportunity
into `withheldUnsupported`, `needsTargeting`, or a non-ready `readiness` state. The goal is
to establish what is **actually emitted** before designing a recovery dispatcher.

The layers are kept separate:

1. **Upstream diagnostic producers** — emit status values, preflight/hydration reasons,
   candidate-quality reasons, integrity violations, grounding notes, etc.
2. **Classification producer** — `classifyWorkbenchExecutabilityDetailed` consumes the
   upstream fields and produces a `finalDecision.cardType` plus `finalDecision.reasons`.
3. **Partition consumer** — `partitionClassifiedWorkbenchQueue` consumes only
   `finalDecision.cardType` and separates `opportunities` / `needsTargeting` /
   `withheldUnsupported`.
4. **Current recovery behavior** — what the repository currently does when a held
   reason is present (explicit repair, implicit fallback, UI-only guidance, none, or
   intentionally nonrecoverable).

## 1. Upstream diagnostic producers

| Producer | File / function | Input condition | Raw emitted status / code | Machine-readable? | Display-only field | Current recovery behavior |
|---|---|---|---|---|---|---|
| Grounding / evidence fidelity | `lib/revision/workbenchQueue.ts` (`getWorkbenchQueue`) | evidence excerpt missing or unmatched | `groundingStatus: 'uncertain_after_relook_reportable'` / `'uncertain_after_relook_blocked'` / `'unsupported_blocked'`; `groundingNote` | `groundingStatus` is canonical enum | `groundingNote` is annotation only | no explicit repair; card may become `needs_targeting` if `adminRepairLabel` present, else `withheldUnsupported` |
| Anchor build | `lib/revision/anchorContract.ts` (`buildAnchorForSnippet`) | snippet not found, ambiguous, or truncated | `anchor_status: 'ambiguous'` / `'missing'` | yes (structured return) | internal `reason` string | no downstream repair currently; failure forces `needs_targeting` or `withheldUnsupported` |
| Preflight gate | `lib/revision/opportunityLedger.ts` (`applyReviseQueuePreflight`, `blockOpportunityByPreflight`) | anchor/context/canon/quality checks fail | `LEDGER_PREFLIGHT_REASON` codes, `preflightStatus: 'passed'` / `'limited_context'` / `'blocked'` | yes (reason constants and status enum) | `preflightNote` | blocked opportunities are held; some trigger candidate regeneration in `candidateHydration.ts` |
| Hydration | `lib/revision/opportunityLedger.ts` (hydration loop using `candidateHydration.ts`) | candidate A/B/C missing or candidate quality failed | `LEDGER_HYDRATION_REASON` codes, `hydrationFailureReasons` | yes | none | LLM batch generation; failures are recorded in `HydrationFailureRecordV1` |
| Candidate quality (admission) | `lib/revision/candidateQuality.ts` (`evaluateCardCandidateQuality`) | candidate fails quality heuristics | `ADMISSION_CANDIDATE_QUALITY_REASON` codes | yes | none | `copyPasteAdmissionPassed` false; downstream `evaluateRecommendationExecutability` may route to strategy or withheld |
| Candidate quality (ledger) | `lib/revision/candidateQuality.ts` (`evaluateCandidateQuality`) | ledger candidates fail quality | `LEDGER_CANDIDATE_QUALITY_REASON` codes, `LEDGER_CARD_QUALITY_FAILED` | yes | none | `opportunityLedger.ts` marks card for preflight / regeneration |
| Candidate compliance | `lib/revision/opportunityLedger.ts` (`evaluateCardQuality` / candidate compliance checks) | candidates noncompliant, low-diversity, or testimony risk | `LEDGER_CANDIDATE_COMPLIANCE_REASON` codes | yes | none | `testimony_fabrication_risk` is terminal; other codes may trigger regeneration |
| Copy-paste admission | `lib/revision/reviseAdmissionGate.ts` (`runCopyPasteAdmissionGate`) | candidates/diagnostics/context/voice/canon fail | `COPY_PASTE_ADMISSION_REASON_CODES` | yes | none | consumed by `evaluateRecommendationExecutability`; may produce `revision_strategy` or `withheld` |
| Strategy admission | `lib/revision/reviseAdmissionGate.ts` (`runStrategyAdmissionGate`) | strategy-level defensibility fails | `STRATEGY_ADMISSION_REASON_CODES` | yes | none | consumed by `evaluateRecommendationExecutability`; terminal `withheld` or `revision_strategy` |
| Diagnostic contract | `lib/revision/reviseAdmissionGate.ts` (`diagnosticContractReasons`) | symptom/cause/fix/reader effect too short or missing | `DIAGNOSTIC_CONTRACT_REASON` codes | yes | none | embedded in admission reasons; downstream may repair diagnosis or regenerate candidates |
| Voice gate | `lib/revision/voiceGate.ts` (`runVoiceGate`) | POV/tense/forbidden pattern mismatch | `VOICE_GATE_REASON` codes | yes | none | candidate flagged; if in strategy admission may lead to `revision_strategy` or withheld |
| Canon gate | `lib/revision/canonGate.ts` (`runCanonGate`) | unsupported fact or canon drift | `CANON_GATE_REASON` codes | yes | none | candidate flagged; may lead to strategy or withheld |
| Integrity gate | `lib/evaluation/pipeline/recommendationIntegrityGate.ts` (`runRecommendationIntegrityGate`) | recommendation field integrity violation | `INTEGRITY_VIOLATION_CODES` (prefixed `integrity_` in recovery inventory) | yes | detail strings | mapped to `integrity_*` reasons in recovery inventory; `repairFamily: 'diagnosis'`, `automaticRecoveryAllowed: false` |
| Telemetry / RES | `lib/revision/opportunityLedger.ts` (`resolveReviseContextQuality`, `blockOpportunityByPreflight`) | context or grounding completely unsupported | `LEDGER_TELEMETRY_REASON` codes (`blocked_preflight`, `grounding_unsupported`) | yes | none | no explicit recovery; held |

## 2. Classification producer

| Function | File | Inputs consumed | Outputs | Authority |
|---|---|---|---|---|
| `classifyWorkbenchExecutabilityDetailed` | `lib/revision/workbenchQueueProjection.ts` | `WorkbenchOpportunity` fields: `quoteHighlight`, `quoteRest`, `groundingStatus`, `contextQuality`, `preflightStatus`, `preflightReasons`, `hydrationFailureReasons`, `anchor`, `scope`, `mode`, `revisionOperation`, `options` | `WorkbenchExecutabilityClassification` with `finalDecision.cardType`, `finalDecision.trustedPathStatus`, `finalDecision.reasons`, plus `baseDecision`, admission gate results, and `executabilityReasons` | **Sole routing authority** for partition |
| `evaluateRecommendationExecutability` | `lib/revision/recommendationExecutability.ts` | Boolean inputs derived from `classifyWorkbenchExecutabilityDetailed` | `RecommendationExecutabilityDecision` (`cardType`, `trustedPathStatus`, `reasons` using `BASE_DECISION_REASON` codes) | Used to compute `baseDecision` and `finalDecision` but is not itself the partition authority |

`finalDecision.cardType` may be `copy_paste_rewrite`, `revision_strategy`, or `withheld`.
`executabilityReasons` is a **presentation copy** of `finalDecision.reasons` and must not be
used for routing or recovery planning (see `HELD_REASON_SOURCE_REGISTRY` entry for
`executability`).

## 3. Partition consumer

| Function | File | Routing input | Output buckets | Behavior |
|---|---|---|---|---|
| `partitionClassifiedWorkbenchQueue` | `lib/revision/workbenchQueueProjection.ts` | `finalDecision.cardType` on each `ClassifiedWorkbenchOpportunity` | `opportunities` (ready copy-paste), `needsTargeting` (strategy/needs-targeting), `withheldUnsupported` (withheld or unclassified) | `opportunities` if `cardType === 'copy_paste_rewrite'`; `needsTargeting` if `cardType === 'revision_strategy'`; `withheldUnsupported` if `cardType === 'withheld'` or the opportunity id is not in the active set. Display reasons cannot override this. |

`buildClassifiedWorkbenchOpportunity` copies `finalDecision` onto the opportunity as
`cardType`, `trustedPathStatus`, and `executabilityReasons`. This is purely a
projection layer; the partition still re-checks `finalDecision.cardType`.

## 4. Current recovery behavior matrix

| Held/withheld trigger | Upstream code / status | Recovery action currently encoded? | Current behavior | Required inputs (if recovery existed) | Success condition | Recoverable? | Evidence / test |
|---|---|---|---|---|---|---|---|
| Missing / truncated / ambiguous anchor | `LEDGER_PREFLIGHT_REASON.TRUNCATED_ANCHOR`, `LEDGER_HYDRATION_REASON.ANCHOR_TRUNCATED`, `BASE_DECISION_REASON.EVIDENCE_MISSING`, `BASE_DECISION_REASON.ANCHOR_NOT_PRECISE` | partly — `anchorContract.ts` can resolve a snippet to offsets, `findHydrationChunkForAnchor` can locate a chunk | no unified recovery; hydration may re-try on next ledger build, and `adminRepairLabel` may allow manual triage | `source_text`, `evidence_anchor`, `manuscript_coordinates` | anchor uniquely found and validated against source text | yes | `anchorContract.ts` tests, `opportunityLedger.ts` hydration loop |
| Insufficient context | `BASE_DECISION_REASON.CONTEXT_MISSING`, `BASE_DECISION_REASON.INSUFFICIENT_BEFORE_AFTER_CONTEXT`, `LEDGER_HYDRATION_REASON.CONTEXT_NOT_FOUND` | no | no explicit recovery; hydration context lookup fails closed | `source_text`, `manuscript_chunks`, `evidence_anchor` | chunk with surrounding context located and passes SLAE context checks | yes | `findHydrationChunkForAnchor` diagnostics |
| Canon / authority block | `LEDGER_PREFLIGHT_REASON.CANON_AUTHORITY_BLOCKED`, `BASE_DECISION_REASON.CANON_CONFLICT`, `ADMISSION_REASON.HARD_CANON_CONFLICT` | no | terminal `withheld` for hard conflicts; softer canon issues may downgrade to `revision_strategy` | full diagnostic + manuscript context | contradiction resolved or card downgraded | sometimes | `classifyWorkbenchExecutabilityDetailed` |
| Diagnostic contract missing | `DIAGNOSTIC_CONTRACT_REASON` codes | no | admission gate fails; card becomes `withheld` or `revision_strategy` depending on other gates | `rationale`, `symptom`, `cause`, `fix_direction`, `reader_effect` | all fields present and pass length/integrity checks | yes (with author or LLM assistance) | `reviseAdmissionGate.ts` |
| Candidate quality failed | `ADMISSION_CANDIDATE_QUALITY_REASON` / `LEDGER_CANDIDATE_QUALITY_REASON` / `LEDGER_CARD_QUALITY_FAILED` | partly — `candidateHydration.ts` regenerates candidates; `candidateRegeneration.ts` exists | regeneration is attempted in ledger build when A missing or quality fails; **must not overwrite persisted A/B/C** | `evidence_anchor`, `rationale`, `manuscript_context`, `english_variant`, existing A/B/C | regenerated candidates pass quality gates and are distinct | yes, but bounded | `candidateHydration.ts`, `candidateRegeneration.ts` |
| Candidate compliance (noncompliant / low diversity) | `LEDGER_CANDIDATE_COMPLIANCE_REASON.NONCOMPLIANT`, `.LOW_DIVERSITY` | no | card held; no explicit repair | existing A/B/C + quality constraints | candidates become compliant / diverse | yes | `opportunityLedger.ts` |
| Testimony fabrication risk | `LEDGER_CANDIDATE_COMPLIANCE_REASON.TESTIMONY_FABRICATION_RISK` | no | **intentionally nonrecoverable** | N/A | N/A | no | `candidateQuality.ts` / `opportunityLedger.ts` |
| Voice / canon drift | `VOICE_GATE_REASON` / `CANON_GATE_REASON` | no | candidate flagged; may block copy-paste and route to strategy or withheld | candidate text + manuscript voice/canonical facts | candidate no longer drifts | yes | `voiceGate.ts`, `canonGate.ts` |
| Integrity violation | `INTEGRITY_VIOLATION_CODES` (mapped to `integrity_*` in inventory) | no | `repairFamily: 'diagnosis'`, `automaticRecoveryAllowed: false` in inventory; currently no repair executor | full diagnostic tuple | integrity check passes on repaired diagnostic | yes, but not automatic | `recommendationIntegrityGate.ts` |
| Hard context block | `ADMISSION_REASON.HARD_CONTEXT_BLOCK`, `contextQuality: 'blocked'` | no | terminal `withheld` | N/A | N/A | no | `classifyWorkbenchExecutabilityDetailed` |
| Strategy admission failed | `ADMISSION_REASON.STRATEGY_ADMISSION_FAILED`, `BASE_DECISION_REASON.STRATEGY_ADMISSION_FAILED` | no | card becomes `withheld` or `revision_strategy` | full opportunity + source text | strategy defensibility passes | sometimes | `evaluateRecommendationExecutability` |
| Unsupported revision | `ADMISSION_REASON.UNSUPPORTED_REVISION` | no | `withheld` or `revision_strategy` | better diagnostic / context | revision deemed supportable | sometimes | `reviseAdmissionGate.ts` |
| Preflight blocked / not passed | `LEDGER_PREFLIGHT_REASON` codes, `ADMISSION_REASON.PREFLIGHT_NOT_PASSED` | no | card held; some codes trigger regeneration on next ledger build | depends on specific reason | preflight status becomes `passed` or `limited_context` | sometimes | `opportunityLedger.ts` preflight logic |
| Grounding unsupported | `groundingStatus: 'unsupported_blocked'` | no | no explicit repair unless `adminRepairLabel` | source text + anchor | grounding becomes supported or reportable | sometimes | `isSupportedForUserQueue` |
| Safe local copy-paste | `BASE_DECISION_REASON.SAFE_LOCAL_COPY_PASTE_REWRITE` | N/A | terminal success, not a held state | N/A | N/A | N/A | `evaluateRecommendationExecutability` |

## 5. Producer-to-recovery-action mapping (not yet implemented)

This is a **draft contract** derived from the inventory above. It is the source of truth
for the eventual `switch (\`${producer}:${code}\`)` dispatcher. No production code uses
this mapping yet.

| Producer | Code family | Recovery action | Deterministic? | Required inputs | Current encoding status |
|---|---|---|---|---|---|
| `grounding`, `preflight`, `hydration`, `base_decision` | `truncated_anchor`, `insufficient_anchor_grounding`, `evidence_missing`, `hydration_anchor_truncated`, `anchor_not_precise` | `resolve_anchor` / `expand_anchor` | yes, when `source_text` available | `source_text`, `evidence_anchor` | partial (`buildAnchorForSnippet`, `findHydrationChunkForAnchor`) |
| `grounding`, `preflight`, `hydration`, `base_decision` | `context_missing`, `insufficient_before_after_context`, `hydration_context_not_found`, `limited_context_due_to_degraded_canon` | `retrieve_context` | yes | `source_text`, `manuscript_chunks`, `evidence_anchor` | partial (`findHydrationChunkForAnchor`) |
| `integrity`, `copy_paste_admission`, `strategy_admission`, `base_decision` | `diagnostic_missing_*`, `integrity_*` | `repair_diagnosis` | no (LLM or author) | `rationale`, `symptom`, `cause`, `fix_direction`, `reader_effect` | absent |
| `candidate_quality`, `preflight`, `copy_paste_admission`, `voice_gate`, `canon_gate` | `candidate_quality_*`, `candidate_noncompliant`, `candidate_low_diversity`, voice/canon drift | `regenerate_candidates` | no (LLM) | `evidence_anchor`, `rationale`, `manuscript_context`, `english_variant`, **existing `candidate_text_a/b/c`** (preserve authority) | partial (`candidateHydration.ts`, `candidateRegeneration.ts`) |
| `strategy_admission`, `base_decision` | `strategy_admission_failed`, `unsupported_revision`, `missing_concrete_action` | `rerun_admission` / `reclassify` | mixed | full `WorkbenchOpportunity` / `RevisionOpportunity` | absent |
| `final_decision` | any | `reclassify` | mixed | result of upstream repairs | absent |
| any | `testimony_fabrication_risk`, `HARD_CANON_CONFLICT`, `HARD_CONTEXT_BLOCK`, `candidate_quality_failed_after_regen` | `no_action` | — | terminal `withheld` | absent (handled by classification) |

## 6. Authority and safety notes

- **`finalDecision.cardType` is the only partition authority.** No recovery handler may
  write `cardType` directly. Recovery may only change canonical upstream inputs and
  then let `classifyWorkbenchExecutabilityDetailed` recompute.
- **Candidate A/B/C authority:** recovery must not regenerate `candidate_text_b/c`
  merely because they are absent, and must not overwrite a persisted A/B/C trio.
  Regeneration is only permitted when the source artifact is genuinely missing or
  when a quality/canon/voice repair requires a new candidate set, in which case a
  new source hash must be produced and persisted.
- **Unknown producer/code pairs fail closed.** The eventual dispatcher must have no
  generic repair `default` branch. Its `default` must return a terminal `withheld`
  state with an `UNKNOWN_RECOVERY_CONTRACT` audit code and the original producer/code
  preserved.
