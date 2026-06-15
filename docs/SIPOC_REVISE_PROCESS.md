# Revise Platform — SIPOC/FIPOC Process Constitution

> **Status:** Executable registry active — `lib/revision/reviseRegistry.ts`
> **CSV mirrors:** `docs/registries/revise/`
> **Evaluation counterpart:** `docs/SIPOC_EVALUATION_PROCESS.md`
> **Governance:** `AI_GOVERNANCE.md` (binding)

---

## Purpose

This document is the canonical SIPOC constitution for the **Revise Platform** —
the full pipeline from Revision Opportunity Ledger Assembly through Author Decision
capture, Ledger Sync, Completion Certification, and TrustedPath Auto-Apply.

It is the machine-authoritative counterpart to the Evaluation E2E SIPOC.
Every stage, artifact, field, kick, and state machine here is executable: the
TypeScript source is `lib/revision/reviseRegistry.ts`.

---

## Factory Position

```
EVALUATION FACTORY   (docs/SIPOC_EVALUATION_PROCESS.md)
        ↓
  revision_opportunity_ledger_v1
        ↓
REVISE FACTORY   (← this document)
        ↓
  revision_completion_record_v1
        ↓
AGENT READINESS FACTORY   (future)
```

---

## Runtime Doctrine

1. **Ledger-first.** Every queue item must trace to `revision_opportunity_ledger_v1`. No opportunity enters the Revise Queue without ledger backing.
2. **Card contract governs admission.** Six-part diagnostic (`symptom`, `cause`, `fixDirection`, `readerEffect`, `evidence_anchor`, `revision_operation`) must be fully populated. Partial items become `needs_targeting`, not deleted. UI/card display aliases are explicit: `fixStrategy = fixDirection`, `readerImpact = readerEffect`, `diagnostic.evidence.quotedExcerpt = evidence_anchor`, and `diagnostic.operationTargeting = revision_operation + location`.
3. **Canonical enum values only.** `RevisionLedgerDecision`, `RevisionReadiness`, `WorkbenchMode`, `WorkbenchScope`, `CrossCheckVerdict`, `AuthorDecisionState` — all are contract values. Non-canonical values are CI-failing defects.
4. **Illegal transitions throw; they do not write.** Session state machine and ledger sync follow the same contract as job state. No silent fallthrough.
5. **Append-only ledger.** `revision_ledger_decisions` is never mutated. Undo is a new append row with `is_undo=true`. Mutations are forbidden.
6. **Mode contract is inherited, not re-inferred.** `revision_mode_contract_v1` is derived from `evaluation_result_v2.confirmed_mode` before the first Revise stage runs. No Revise stage re-evaluates mode.
7. **TrustedPath only auto-applies `approve` verdicts.** `flag`, `reject`, `unavailable`, and `pending` verdicts require manual author review. TrustedPath is not a bypass — it is auto-acceptance of independently verified repairs.
8. **Cross-check does not generate repairs.** `RS09_CROSSCHECK_VERIFICATION` evaluates Option A using an independent model. It does not produce candidate text.
9. **Original manuscript is never mutated.** All decisions are ledger entries. The manuscript is only mutated when the author explicitly exports a revised draft.
10. **UI must not simulate or fabricate author decisions.** The UI is a read-surface for persisted state only. It must not guess or infer `author_decision_state`.
11. **Hard caps are enforced.** Short-form: max 50 opportunities. Long-form: max 100 opportunities. Queue assembly respects these limits post-admission.
12. **Completion gate is active.** `RS08_COMPLETION` emits `revision_completion_record_v1` and certifies only when all `ready_for_revise` items have persisted decisions and no pending sync remains.
13. **`needs_targeting` items are not deleted.** They persist in an advisory view. Authors may retarget them. They do not block completion of `ready_for_revise` items.
14. **Observability is passive.** Telemetry (`lib/revision/telemetry.ts`) and governance logs must not alter control flow.

---

## Runtime Spine

```
Revision Opportunity Ledger Assembly (RS01)
  → Queue Admission Gate (RS02)
    → Queue Prioritization and Assembly (RS03)
      → Workbench Evidence Load (RS04)
        → A/B/C Candidate Generation (RS05)  [if candidates absent]
          ↓
        Author Decision Capture (RS06)
          → Ledger Sync (RS07)
            → [when all ready items decided]
            Completion Certification (RS08)  [active]
              → end state
        ↑ async/feature-flagged ↑
        Repair Cross-Check Verification (RS09)
          → TrustedPath Auto-Apply (RS10)    [if verdict=approve]
```

**Highest-risk seam:**
`RS06_AUTHOR_DECISION → RS07_LEDGER_SYNC`

Reason: this seam carries decision integrity, canonical value enforcement, and
append-only write guarantees. A non-canonical decision value here is a governance
violation.

---

## Stage Summary Table

| Stage | ID | Phase | Active State | Certification |
|---|---|---|---|---|
| Ledger Assembly | RS01 | Ledger Assembly | active | partial |
| Queue Admission | RS02 | Queue Admission | active | partial |
| Queue Prioritization | RS03 | Queue Management | active | emerging |
| Workbench Evidence Load | RS04 | Workbench | active | emerging |
| A/B/C Candidate Generation | RS05 | Workbench | active | partial |
| Author Decision Capture | RS06 | Author Decision | active | partial |
| Ledger Sync | RS07 | Ledger Sync | active | partial |
| Completion Certification | RS08 | Completion | active | certified |
| Cross-Check Verification | RS09 | Cross-Check | active | partial |
| TrustedPath Auto-Apply | RS10 | TrustedPath | active | partial |

---

## Author Decision State Machine

```
pending
  → accepted_a | accepted_b | accepted_c | custom | keep_original | reject | deferred

accepted_a / accepted_b / accepted_c / custom
  → reject | keep_original | deferred   (author re-decides before sync)

keep_original / reject / deferred
  → any other canonical value           (author re-decides before sync)
```

`RevisionLedgerDecision` is exactly:
`accepted_a | accepted_b | accepted_c | custom | keep_original | reject | deferred`

---

## Queue Item Lifecycle

```
queued → ready_for_revise | needs_targeting
ready_for_revise → in_review
needs_targeting → ready_for_revise | deferred
in_review → decided
decided → synced
synced → trustedpath_applied
trustedpath_applied → [terminal]
deferred → ready_for_revise
```

---

## Revision Session State Machine

```
open → findings_ready → synthesis_started → proposals_ready → applied | failed
```

`applied` and `failed` are terminal. No transition out of either is permitted.
Illegal transitions must throw and must not write to the database.

---

## Authority Source Registry

| Family | Title | Path |
|---|---|---|
| governance | AI Governance | `AI_GOVERNANCE.md` |
| contract | Revise Card Contract | `lib/revision/reviseCardContract.ts` |
| contract | Revise Queue Ledger Contract | `lib/revision/reviseQueueLedgerContract.ts` |
| contract | Revise Admission Gate | `lib/revision/reviseAdmissionGate.ts` |
| contract | Revision Mode Contract | `lib/revision/modeContract.ts` |
| contract | TrustedPath Contract | `lib/revision/trustedPath.ts` |
| contract | Repair Cross-Check Contract | `lib/revision/repairCrossCheck.ts` |
| contract | Revision Session State Machine | `lib/revision/sessionTransitions.ts` |
| governance | Revise Platform SIPOC Constitution | `docs/SIPOC_REVISE_PROCESS.md` |

---

## Missing / Critical Gaps

| Gap | Stage | Notes |
|---|---|---|
| Queue Item Lifecycle Persistence | RS03 | Queue state lives in-memory / client; no durable lifecycle record. |
| Needs-Targeting Retargeting Flow | RS02/RS04 | Author retargeting path exists in UI but has no formal admission re-run. |
| Revision Quality Drift Metrics | RS07/RS08 | `RevisionQualityDriftMetrics` is tracked; completion records must remain passive and must not alter author decisions. |
| TrustedPath Eligibility Certification | RS10 | `isTrustedPathEligible` gate exists; no formal eligibility record emitted. |

---

## CSV Mirrors

The Revise executable FIPOC is seven mirrored tables: process, artifact, field,
kick, authority, renderer/consumer, and certification gates.

| File | Description |
|---|---|
| `revise_process_registry.csv` | 10 stages: RS01–RS10 |
| `revise_artifact_registry.csv` | 13 canonical artifacts |
| `revise_field_registry.csv` | 18 canonical fields and enum contracts |
| `revise_kick_matrix.csv` | 11 kick codes |
| `revise_authority_source_registry.csv` | 9 authority sources |
| `revise_renderer_consumption_matrix.csv` | 6 author/API/admin-facing consumer surfaces |
| `revise_certification_gate_registry.csv` | 8 certification gates: RCG01–RCG08 |

Generated by `npm run fipoc:export` from `lib/revision/reviseRegistry.ts`.

---

## Metric Contract

| Metric | Description | Governing Stage |
|---|---|---|
| `ledger_backing_coverage` | % of queue items sourced from `revision_opportunity_ledger_v1`; must be 100% | RS02, RS03 |
| `ready_rate` | `ready_for_revise / total_opportunities`; passive observability only | RS02 |
| `synced_decision_count` | Must equal `author_decision_count` before completion | RS07, RS08 |
| `anchor_coverage` | % of items with resolved anchor in source manuscript | RS04 |
| `finding_id_coverage` | % of ledger opportunities with stable `finding_id`; Ready rows must be traceable | RS01, RS02 |
| `candidate_option_coverage` | % of opportunities with exact A/B/C manuscript-ready candidates; Ready rows require all three | RS02, RS04, RS05 |
| `needs_targeting_count` | Count of evidence-backed but incomplete rows withheld from author acceptance | RS02, RS04 |
| `trustedpath_apply_rate` | `appliedCount / total_eligible`; passive | RS10 |
| `queue_cap_utilization` | `queue_length / hard_cap`; short-form=50, long-form=100 | RS03 |

All metrics are passive observability. They must not alter control flow.
