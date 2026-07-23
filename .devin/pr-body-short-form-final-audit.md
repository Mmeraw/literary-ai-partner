<!-- Comet template-unification: enforcement-compliant default body. -->
<!-- DO NOT delete required ## headings unless your PR is migration/docs-only (auto-skipped by latency-pr-enforcement.yml). -->

## Summary

Short-form evaluations (< 25k words) complete through the main processor and never reach the DREAM worker, so they never received a `final_external_audit_v1` artifact. The author-exposure release gate then failed with `author_exposure:final_external_audit_failed` for every short-form job. This change persists a deterministic `SKIP` final external audit inline during processor finalization for short-form jobs, so the release gate has the artifact it expects.

The SKIP record is now bound to the actual `evaluation_result_version` and verified `word_count` at audit time, and `getAuthorExposureDecision` rejects a final audit whose binding fields do not match the job row. Long-form behavior is unchanged: the DREAM worker continues to own substantive final-audit persistence for >= 25k word manuscripts.

## Scope

Pass selection (CHECK EXACTLY ONE — Pass 2 pre-checked as default because the change lives in the phase-2 finalization path):

- [ ] Pass 1
- [x] Pass 2
- [ ] Pass 3

Changed files:

- `lib/evaluation/processor.ts` — persist `final_external_audit_v1` artifact for short-form jobs before the atomic completion write
- `lib/evaluation/pipeline/finalExternalAudit.ts` — include `word_count` and `evaluation_result_version` in final audit content; derive `evaluation_result_version` from the evaluated result's `schema_version`
- `lib/evaluation/authorExposureCertification.ts` — read `evaluation_jobs.word_count` and `evaluation_result_version`; block exposure when the audit's binding fields mismatch the job row
- `tests/lib/evaluation/pipeline/finalExternalAudit.test.ts` — regression tests for short-form SKIP binding fields and persistence
- `tests/lib/evaluation/authorExposureCertification.test.ts` — regression tests for bound short-form exposure, mismatched `word_count`, mismatched `evaluation_result_version`, and missing long-form audit

Out of scope:

- No changes to DREAM worker (`/api/workers/process-dream`) or long-form finalization
- No changes to the release-gate schema acceptance logic (`finalExternalAuditAllowsPhase5Exposure` still rejects only `BLOCK`)
- No changes to prompts, model selection, or author-facing text normalization

## Evaluation Process Change Declaration

Process Change: yes

- [x] Sequential phase-gate doctrine preserved (parallelism only within safe sub-workloads).
- [x] Phase 0 remains first and is proven before downstream processing.
- [x] Phase 2 remains blocked on accepted_story_ledger_v1 (Review Gate authority).
- [x] Phase 3 remains blocked on pass12_handoff_v1 and is sole owner of Pass 3B synthesis.
- [x] Deterministic quality gates run after Pass 3B and before completion.
- [x] WAVE remains post-evaluation (after evaluation_result_v2) and non-fatal to base evaluation.

One-line doctrine: The pipeline is sequential at the phase/gate level and parallel only inside safe sub-workloads.

Process-Change Impact Summary (required when Process Change: yes):

- The main processor now persists the `final_external_audit_v1` artifact during short-form finalization. This is a deterministic, provider-free SKIP audit for manuscripts below the 25k long-form threshold; it does not invoke any LLM. The artifact was previously produced only by the DREAM worker, which only processes completed long-form jobs, so short-form jobs were missing it and were incorrectly blocked at the author-exposure release gate.
- The final audit content now carries `word_count` and `evaluation_result_version` binding fields. `getAuthorExposureDecision` cross-checks these against the `evaluation_jobs` row, so a stale final audit from a prior result cannot unlock exposure if the binding fields drift.

## Contract Integrity

- `finalExternalAuditAllowsPhase5Exposure` (already in `main`) accepts the pipeline artifact shape (`schema_version: 'final_external_audit_v1'`, `verdict: 'SKIP'/'PASS'/'WARN'`) and rejects only `BLOCK` verdicts.
- The persisted artifact uses the canonical `final_external_audit_v1` schema from `lib/evaluation/pipeline/finalExternalAudit.ts`.
- `getAuthorExposureDecision` now queries `evaluation_jobs(word_count, evaluation_result_version)` and blocks exposure when the `final_external_audit_v1` artifact's binding fields disagree with the job row.
- No raw author text, model reasoning, or internal diagnostic details are exposed; the artifact content is the same safe audit envelope used for long-form jobs.

## Behavioral Quality

This PR is not reducing intelligence.

The short-form final audit is deterministic: `runFinalExternalAudit` immediately returns `verdict: 'SKIP'` for `wordCount < 25_000` without calling a provider, preserving the same quality determination that would be made later by the DREAM worker for long-form jobs. The binding check adds fail-closed integrity to the release gate without weakening any pass/fail semantics.

## Latency Evidence

### Baseline (Pre-change)

| Run | pass2_ms | total_ms | Notes |
|---|---:|---:|---|
| Run 1 | N/A | N/A | No prior short-form finalization timing captured for this specific artifact persistence path. |
| Run 2 | N/A | N/A | N/A |

### Post-change Runs

| Run | pass2_ms | total_ms | Notes |
|---|---:|---:|---|
| Run 1 | N/A | N/A | Short-form final audit is deterministic and provider-free; no measurable pass2 latency added. Author-exposure binding check adds one indexed `evaluation_jobs` lookup by primary key. |
| Run 2 | N/A | N/A | N/A |

## Quality Gate / Anomalies

QG_none: No quality-gate behavior changes. The `final_external_audit_v1` artifact is only produced, not interpreted; the existing release gate continues to enforce the same SKIP/PASS/WARN-only policy and still rejects BLOCK verdicts. The new binding check is an integrity addition, not a quality-gate relaxation.

## Branch Freshness (Never Behind)

<!-- Required merge gate: PR head must include current base HEAD. -->

Branch-Behind-Base: 0

## Risks & Anomalies

- Risk: Long-form jobs are mis-routed through the short-form path. Mitigation: the call is guarded by `coverageForReporting.sourceWords < WAVE_MIN_WORDS` (25k); the same threshold the DREAM worker uses to decide whether to process a job.
- Risk: A second `final_external_audit_v1` artifact could be persisted for long-form jobs if the guard drifts. Mitigation: the DREAM worker query already includes `word_count >= 25000`, so the two paths are mutually exclusive by word-count threshold.
- Risk: `persistFinalExternalAudit` throws and the job fails closed. This is acceptable: missing the artifact would have caused a release-gate failure anyway, and failing closed is consistent with the fail-closed artifact persistence policy.
- Risk: Legacy `final_external_audit_v1` artifacts without `word_count`/`evaluation_result_version` skip the binding check and continue to pass. New audits carry binding fields; stale legacy audits are not covered by binding validation, but they still must pass `finalExternalAuditAllowsPhase5Exposure`.

## Architecture Alignment

- alignment: post-#384 architecture-aligned
- mitigation_expiry:
- dependent_architecture:
- expected_revisit: no
- replay_ids_at_risk:
- replay_ids_targeted:

<!-- pr-type: evaluation -->
