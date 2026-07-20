# Revise Platform — SIPOC/FIPOC Process Constitution

> **Status:** Executable registry active — `lib/revision/reviseRegistry.ts`
> **CSV mirrors:** `docs/registries/revise/`
> **Evaluation counterpart:** `docs/SIPOC_EVALUATION_PROCESS.md`
> **Governance:** `AI_GOVERNANCE.md` (binding)
> **Top-level doctrine:** `docs/governance/AUTHORITY_CHAIN.md` (binding)
> **Artifact authority:** `docs/SIPOC_ARTIFACT_AUTHORITY_CHAIN.md`

---

## Normative Relationship

This Revise SIPOC is governed by `docs/governance/AUTHORITY_CHAIN.md` and the artifact-level constitution in `docs/SIPOC_ARTIFACT_AUTHORITY_CHAIN.md`.

It is the normative downstream counterpart to `docs/SIPOC_EVALUATION_PROCESS.md` for the Evaluation → Revise handoff (`revision_opportunity_ledger_v1`).

Where wording conflicts with top-level doctrine, doctrine is authoritative until this document is reconciled.

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
  REVISE_ADMISSION_GATE
        ↓
  REVISE_LEDGER_TRACEABILITY_GATE
        ↓
  workbench_queue_v1
        ↓
REVISE FACTORY   (← this document)
        ↓
  author_decision_v1
        ↓
  revision_completion_record_v1
        ↓
AGENT READINESS FACTORY   (docs/SIPOC_AGENT_READINESS_PROCESS.md)
```

### Artifact Pipeline (explicit)

```
Certified UED
    ↓
revision_opportunity_ledger_v1   (bridge from Evaluation; includes DCIP compliance + constitutional authority status in quality_manifest)
    ↓
REVISE_ADMISSION_GATE            (validates ledger backing, card contract, evidence anchors)
    ↓
REVISE_LEDGER_TRACEABILITY_GATE  (every queue item traceable: opportunity_id + source_criterion + source_ued_hash)
    ↓
workbench_queue_v1               (classified, prioritized queue: ready_for_revise | needs_targeting)
    ↓
author_decision_v1               (canonical decision per opportunity: accept/reject/defer/custom)
    ↓
revision_completion_record_v1    (certified record of all decisions + sync status)
```

### Traceability Contract

Every queue item in `workbench_queue_v1` MUST contain:
- `opportunity_id` — stable identifier from `revision_opportunity_ledger_v1`
- `source_criterion` — the canonical criterion key this opportunity traces to
- `source_ued_hash` — hash of the source `UnifiedEvaluationDocument` that produced this opportunity
- `finding_id` — stable finding identifier from diagnostic_findings_v1
- `evaluation_job_id` — the evaluation job that produced the evidence

No queue item may exist without ledger provenance. This is enforced by `REVISE_LEDGER_TRACEABILITY_GATE`.

The source `revision_opportunity_ledger_v1` quality manifest MUST also carry:

- `dcip_compliance` — inherited from certified Evaluation context and passing before Ready admission
- `constitutional_authority_registry` — status of required constitutional authorities loaded through `docs/governance/CONSTITUTIONAL_AUTHORITY_REGISTRY.md`

Revise consumes this constitutional context as provenance only. It must not reinterpret DCIP or create an alternative authority chain.

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
15. **Queues own queue state only.** Queues own lifecycle, admission, retry, lease, and presentation state. Queues do not own or mutate certified UED, ViewModel, renderer, or download artifacts.
16. **Revise consumes certified lineage only.** Revise consumes certified Evaluation lineage and `revision_opportunity_ledger_v1` provenance only. It must not consume Web/PDF/DOCX/TXT renderer output or `evaluation_report_view_model_v1` as a revision authority.
17. **Renderer-dependent handoff is invalid.** If Revise admission depends on renderer/download output, the handoff is invalid and must kick back to the Evaluation authority boundary (`S10b_PHASE5_AUTHOR_EXPOSURE_GATE` / `S10c_VIEWMODEL_BOUNDARY_GATE`) instead of proceeding through Revise.
18. **Recommendation lineage is not queue cardinality.** Every authoritative criterion recommendation must receive exactly one governed Evaluation disposition. Only `admitted` dispositions receive canonical opportunity identity and may enter RS01. `suppressed_governed` and `informational_non_actionable` remain certified lineage without becoming active or Held work.
19. **Empty authority differs from missing authority.** `canonicalOpportunityLedger.opportunities: []` is a valid governed zero-opportunity outcome. A missing ledger, malformed ledger, or non-array `opportunities` value fails closed before Revise exposure.
20. **Summaries and scores are not producers.** Report summaries, `top_recommendations`, criterion scores, ViewModel fields, and rendered output cannot create or alter Revise queue membership.
21. **Held is not a fallback disposition.** `held_recoverable` is reserved but rejected by `recommendation_disposition_v1` until a neutral, versioned recovery-authority proof exists. Missing anchors do not automatically create Held items.
22. **Held diagnostics are author-safe projections.** Internal reason codes remain auditable, but the Workbench exposes one safe explanation per distinct diagnostic family, deduplicates repeated families, maps unknown codes to generic safe prose, and emits zero raw-code leakage.

### Evaluation → Revise Authority and Kickback Matrix

| Boundary input | Required state / metric | Authorized output | Dirty-data kickback |
|---|---|---|---|
| Authoritative criterion recommendations | Stable source identity for every source; source IDs unique | One disposition per source | Missing, duplicate, or unexpected identity → `S10b_PHASE5_AUTHOR_EXPOSURE_GATE`; block certification |
| `recommendation_disposition_v1` | `source_recommendation_count = disposition_count = unique source count`; coverage ratio `1` | Complete recommendation lineage | Count/set mismatch, unknown version, or invalid disposition → `S10b`; reconstruct lineage |
| `admitted` disposition | Non-empty canonical opportunity identity; exactly one ledger mapping | RS01 ledger opportunity | Missing/duplicate identity or admitted row loss → `S10b`/RS01; no queue exposure |
| `suppressed_governed` / `informational_non_actionable` | No canonical opportunity identity | Persisted lineage only | Any queue identity or queue item → `S10b`/RS01; reject projection |
| Canonical opportunity authority | `opportunities` is an array; empty is valid | Ledger projection or valid empty Workbench | Missing/malformed authority → fail closed; no legacy fallback |
| RS01 → RS02 | Every queue candidate backed by one canonical ledger opportunity | `ready_for_revise` or `needs_targeting` | Unbacked item or admitted coverage loss → RS01 |
| Internal Held diagnostics → RS04 | Every non-empty raw input classified; distinct families deduplicated | One author-safe explanation per distinct family | Lost classification, duplicate explanation, empty safe output, or raw leakage → block Workbench author exposure |

The executable registries in `lib/evaluation/fipocRegistry.ts` and `lib/revision/reviseRegistry.ts` are the single source of truth. CSVs under `docs/registries/` and forensic workbooks are generated evidence mirrors; they must not introduce new authority or thresholds.

---

## Runtime Spine

```
Revision Opportunity Ledger Assembly (RS01)
  → Queue Admission Gate (RS02)
    → Ledger Traceability Gate (RS02b)  [REVISE_LEDGER_TRACEABILITY_GATE]
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
| Ledger Traceability Gate | RS02b | Queue Admission | active | emerging |
| Queue Prioritization | RS03 | Queue Management | active | emerging |
| Workbench Evidence Load | RS04 | Workbench | active | emerging |
| A/B/C Candidate Generation | RS05 | Workbench | active | partial |
| Author Decision Capture | RS06 | Author Decision | active | partial |
| Ledger Sync | RS07 | Ledger Sync | active | partial |
| Completion Certification | RS08 | Completion | active | certified |
| Cross-Check Verification | RS09 | Cross-Check | active | partial |
| TrustedPath Auto-Apply | RS10 | TrustedPath | active | partial |

---

## Stage Contract: `RS02b_REVISE_LEDGER_TRACEABILITY_GATE`

### Purpose

Validates that every admitted queue item has full traceability back to the evaluation that produced it. This is the enforcement point for the "no queue item without ledger provenance" doctrine.

### Input

- Admitted queue items from `RS02_QUEUE_ADMISSION`
- `revision_opportunity_ledger_v1` (source ledger)

### Input Acceptance Metrics

| Metric | Threshold | Failure Mode |
|---|---|---|
| `opportunity_id` present | 100% of items | item rejected (not deleted — moved to `needs_targeting`) |
| `source_criterion` resolves to canonical criterion key | 100% of items | item flagged for manual review |
| `source_ued_hash` matches a persisted UED | 100% of items | item rejected |
| `finding_id` traces to `diagnostic_findings_v1` | ≥95% of items (allows ledger-only opportunities from enrichment) | items below threshold flagged, not blocked |
| `evaluation_job_id` resolves to a completed job | 100% of items | item rejected |

### Process

Validate traceability fields → verify UED hash against persisted artifacts → confirm finding lineage → emit `workbench_queue_v1` with traceability metadata attached.

### Output

- `workbench_queue_v1` — classified, prioritized revision queue with verified traceability

### Output Acceptance Metrics

| Metric | Threshold | Notes |
|---|---|---|
| Traceability coverage | 100% of `ready_for_revise` items have all five traceability fields | `needs_targeting` items may have partial traceability |
| Queue item count | Equals authorized admitted/withheld input count; may be zero | A zero queue is valid when canonical authority is present and contains zero opportunities. `REVISE_QUEUE_EMPTY` applies only when authorized input opportunities were unexpectedly lost. |
| Ready/NeedsTargeting ratio | No minimum — passive observability | Informational; does not block |
| Ledger-to-queue loss rate | ≤20% of admitted items rejected by traceability | If >20% rejected, emit diagnostic warning (likely upstream ledger assembly issue) |

### Gates / Invariants

- **REVISE_LEDGER_TRACEABILITY_GATE:** No `ready_for_revise` item may enter workbench without all five traceability fields verified
- Items that fail traceability are not deleted — they move to `needs_targeting` with reason `traceability_incomplete`
- This gate does NOT re-evaluate or re-score — it validates provenance only
- This gate MUST reject renderer/download-derived inputs. Web/PDF/DOCX/TXT projections and `evaluation_report_view_model_v1` are presentation artifacts, not Revise authority.
- Passive: does not alter opportunity content, severity, or classification

### Failure Codes

- `REVISE_TRACEABILITY_MISSING_OPPORTUNITY_ID`
- `REVISE_TRACEABILITY_INVALID_CRITERION`
- `REVISE_TRACEABILITY_UED_HASH_MISMATCH`
- `REVISE_TRACEABILITY_FINDING_NOT_FOUND`
- `REVISE_TRACEABILITY_JOB_NOT_FOUND`
- `REVISE_HANDOFF_RENDERER_OUTPUT_INVALID`

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
open → findings_ready → synthesis_started → proposals_ready → applied | failed | failed_retryable

failed_retryable → open   (re-entry after classified retryable failure)
```

`applied` and `failed` are terminal. No transition out of either is permitted.
`failed_retryable` allows re-entry to `open` after the failure is classified as
retryable by `classifyFailureDisposition()` and a kick target is resolved via
`REVISE_KICK_MATRIX`. Every `failed_retryable` → `open` transition must be
accompanied by a `revision_failure_record_v1` artifact.
Illegal transitions must throw and must not write to the database.

---

## Authority Source Registry

| Family | Title | Path |
|---|---|---|
| governance | AI Governance | `AI_GOVERNANCE.md` |
| governance | Artifact Authority Chain | `docs/SIPOC_ARTIFACT_AUTHORITY_CHAIN.md` |
| contract | Revise Card Contract | `lib/revision/reviseCardContract.ts` |
| contract | Revise Queue Ledger Contract | `lib/revision/reviseQueueLedgerContract.ts` |
| contract | Revise Admission Gate | `lib/revision/reviseAdmissionGate.ts` |
| contract | Revise Ledger Traceability Gate | `lib/revision/reviseAdmissionGate.ts` (traceability validation) |
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

## Corrective Actions Applied

### Root Cause: Canon Gate Blocking 100% of Revise Queue Opportunities (2026-06-12)

**Problem:** Production data showed 189 of 189 opportunities (100%) blocked by `canon_authority_blocked`. Zero opportunities ever reached the user. All 11 revision sessions were stuck in `open` with 0 findings, 0 proposals.

**Root cause chain:**
1. `buildLedgerQualityReport.ts` counted dependency-inherited warnings (one canonical identity issue cascaded to 8 downstream layers) toward the >3 warning threshold, causing `gate_ready_status: "repair_required"` even when the underlying issue was a single same-name ambiguity.
2. `resolveReviseContextQuality` treated `repair_required` identically to `blocked` and `blocked_content_hard_fail`, returning `context_quality: "blocked"`.
3. `preflightReasonsForOpportunity` pushed `canon_authority_blocked` for every opportunity when `context_quality === "blocked"`.
4. `isSupportedForUserQueue` rejected all blocked opportunities.
5. Hydration (RS05) only attempted opportunities with `preflight_status === "passed"`, so zero candidates were generated.

**Fixes applied:**
1. **`buildLedgerQualityReport.ts`** — Exclude `identity_dependency:*` cascade warnings from the >3 root-cause warning count. These are informational metadata documenting which layers inherit canonical identity risk; they are not independent issues.
2. **`resolveReviseContextQuality`** — `repair_required` now maps to `context_quality: "limited"` (not `"blocked"`). Only `blocked` and `blocked_content_hard_fail` produce `"blocked"`.
3. **`opportunityLedger.ts` hydration eligibility** — Allow `limited_context` opportunities to enter hydration (RS05), not just `passed`.
4. **`isSupportedForUserQueue`** — Accept `limited_context` preflight status for user queue admission (alongside `passed`).
5. **`reviseAdmissionGate.ts`** — Accept `limited_context` preflight and `limited` context quality for admission (not just `passed`/`clean`).

**Doctrine preserved:**
- `blocked` and `blocked_content_hard_fail` still fully block (no weakening of hard-fail gates)
- SLAE validation unchanged
- Candidate quality gates unchanged
- `limited_context` cards have confidence capped at `medium` per existing logic
- No production validation rules were weakened

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

| Metric | Description | Governing Stage | Threshold |
|---|---|---|---|
| `ledger_backing_coverage` | % of queue items sourced from `revision_opportunity_ledger_v1` | RS02, RS02b, RS03 | 100% (enforced) |
| `recommendation_lineage_coverage` | `disposition_count / source_recommendation_count` with exact source-ID set equality | S10b, RS01 | 100% (enforced) |
| `recommendation_source_identity_integrity` | missing + duplicate + unexpected source identities | S10b | 0 (enforced) |
| `admitted_authority_coverage` | admitted dispositions with exactly one canonical opportunity identity | S10b, RS01 | 100% (enforced) |
| `suppression_forensics_reconciliation` | persisted `disposition_counts`, `validation_counts`, `governing_rule_counts`, and `criterion_disposition_counts` recomputed from source dispositions | S10b, RS01 | exact match (enforced for `recommendation_suppression_forensics_v1`) |
| `post_canonicalization_suppression_count` | dispositions rejected by canonical opportunity completeness after initial validation | S10b, RS01 | observed and governed; never used as an admission signal |
| `non_admitted_queue_identity_count` | suppressed/informational dispositions carrying queue identity | S10b, RS01 | 0 (enforced) |
| `canonical_authority_presence` | `canonicalOpportunityLedger.opportunities` is an array; empty allowed | S10b, RS01 | 100% (enforced) |
| `traceability_coverage` | % of `ready_for_revise` items with all 5 traceability fields | RS02b | 100% (enforced) |
| `traceability_loss_rate` | % of admitted items rejected by traceability gate | RS02b | ≤20% (warning above) |
| `ready_rate` | `ready_for_revise / total_opportunities` | RS02 | No minimum (passive) |
| `synced_decision_count` | Must equal `author_decision_count` before completion | RS07, RS08 | equality (enforced) |
| `anchor_coverage` | % of items with resolved anchor in source manuscript | RS04 | ≥90% (ready items) |
| `finding_id_coverage` | % of ledger opportunities with stable `finding_id` | RS01, RS02 | ≥95% (ready items) |
| `candidate_option_coverage` | % of opportunities with exact A/B/C manuscript-ready candidates | RS02, RS04, RS05 | 100% of ready items (enforced) |
| `candidate_option_distinctness` | A/B/C options are materially distinct from one another (no duplicate/near-duplicate); pairwise content overlap < 0.80 | RS02, RS05 | 100% of ready items (enforced — duplicate options fail the card and trigger regeneration via `candidate_quality_duplicate_options`) |
| `needs_targeting_count` | Count of evidence-backed but incomplete rows withheld from author acceptance | RS02, RS04 | No maximum (passive) |
| `raw_diagnostic_classification_coverage` | non-empty raw diagnostic inputs assigned a diagnostic family | RS04 | 100% (enforced) |
| `author_safe_explanation_coverage` | distinct diagnostic families with one safe public explanation | RS04 | 100% (enforced) |
| `raw_diagnostic_leakage_count` | internal diagnostic tokens present in author-facing Workbench fields | RS04 | 0 (enforced) |
| `trustedpath_apply_rate` | `appliedCount / total_eligible` | RS10 | No minimum (passive) |
| `queue_cap_utilization` | `queue_length / hard_cap`; short-form=50, long-form=100 | RS03 | ≤100% (enforced) |
| `decision_canonical_rate` | % of author decisions using `RevisionLedgerDecision` enum values | RS06 | 100% (enforced) |
| `ued_source_freshness` | source UED was produced by the most recent completed evaluation job | RS01 | informational (passive) |

**Metric enforcement levels:**
- **Enforced** — violation blocks the pipeline (gate fails, item rejected or moved to needs_targeting)
- **Warning** — violation emits diagnostic telemetry; does not block
- **Passive** — observability only; must not alter control flow
