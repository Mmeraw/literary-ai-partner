# Runtime Conformance Remediation Plan

> **Status:** branch-local remediation plan — not merged to `main` yet  
> **Date:** 2026-06-11  
> **Source audit:** `docs/RUNTIME_CONFORMANCE_AUDIT.md`  
> **Principle:** Governance → Runtime Conformance, not Governance → More Governance

---

## Repository State Warning

This plan is currently local to branch `pricing-font-fix` alongside the Storygate canon/runtime conformance work.

Verified on 2026-06-11:

| Artifact | `origin/main` status |
|----------|----------------------|
| `docs/storygate/STORYGATE_STUDIO_CANON.md` | missing |
| `docs/RUNTIME_CONFORMANCE_AUDIT.md` | missing |
| `market_category` references | 0 |

Do **not** treat this plan, the Storygate canon, or the runtime conformance audit as true repository state until this branch is opened as a PR, reviewed, and merged.

---

## Remediation Status Values

| Status | Meaning |
|--------|---------|
| `READY_FOR_PR` | Scope is clear enough for an implementation PR. |
| `NEEDS_DESIGN` | Requires schema/API/design decision before implementation. |
| `BLOCKED_BY_GOVERNANCE_PR` | Depends on merging the local governance/audit branch first. |
| `IN_PROGRESS` | Implementation PR is actively underway. |
| `DONE` | Runtime conformance proved by tests/evidence and registry updated. |

## Severity Values

| Severity | Meaning |
|----------|---------|
| `P0` | Blocks trustworthy author/user exposure or risks false runtime certification. |
| `P1` | Blocks factory-level SIPOC enforcement or downstream handoff. |
| `P2` | Important conformance gap, but not the first release blocker. |
| `P3` | Documentation/test-hardening or follow-up proof work. |

---

## 30–60 Day PR Sequence

| Order | PR Theme | Primary Factory | Goal | Status |
|-------|----------|-----------------|------|--------|
| 0 | Merge governance/audit branch | All | Put Storygate canon, runtime audit, dependency report, registries, tests, and CSV mirrors into GitHub-visible repo state. | `BLOCKED_BY_GOVERNANCE_PR` |
| 1 | Evaluation author exposure gate | Evaluation | Prevent author-visible output until required validators/renderers certify persisted canonical artifacts. | `READY_FOR_PR` |
| 2 | Evaluation renderer parity | Evaluation | Prove webpage/download renderers consume persisted canonical EvaluationResultV2 without recalculation/drift. | `READY_FOR_PR` |
| 3 | Agent Readiness persistence hardening | Agent Readiness | Make DB persistence failures fatal and observable; stop returning generated content as if saved. | `READY_FOR_PR` |
| 4 | Agent Readiness approval API | Agent Readiness | Persist section approvals and make package completeness DB-backed. | `READY_FOR_PR` |
| 5 | Agent Readiness export/history enforcement | Agent Readiness | Require complete approved package before export; persist package history/export records. | `READY_FOR_PR` |
| 6 | Revise completion certification | Revise | Implement/prove `RS08_COMPLETION` before downstream handoff. | `READY_FOR_PR` |
| 7 | Storygate package validator + readiness gate | Storygate | Add current-canon 11-field package validator and 9.0/equivalent readiness gate. | `NEEDS_DESIGN` |
| 8 | Storygate submission/listing persistence | Storygate | Persist current-canon submission snapshots and private/restricted listings. | `NEEDS_DESIGN` |
| 9 | Storygate professional verification/access workflow | Storygate | Implement industry verification, access request, creator/admin approval, controlled viewing, audit, revocation. | `NEEDS_DESIGN` |
| 10 | Long-form evaluation normalization hardening | Evaluation | Reduce critical risk in Pass 3, ER2 normalization, DREAM, final external audit. | `NEEDS_DESIGN` |

---

## Remediation Matrix

| Gap | Severity | Issue | PR | Status |
|-----|----------|-------|----|--------|
| Governance/audit work not on `main` | `P0` | Storygate canon, runtime audit, dependency report, and `market_category` are branch-local. GitHub `main` does not contain them. | PR-00 Governance Visibility | `BLOCKED_BY_GOVERNANCE_PR` |
| `S10b_PHASE5_AUTHOR_EXPOSURE_GATE` missing | `P0` | Evaluation can expose author-facing output without a fully proven phase-5 author exposure certification gate. | PR-01 Evaluation Author Exposure Gate | `READY_FOR_PR` |
| `S11a_RENDERER_WEBPAGE` partial/critical | `P0` | Web renderers may drift from persisted canonical evaluation artifacts or recalculate/report differently. | PR-02 Evaluation Renderer Parity | `READY_FOR_PR` |
| `S07_PASS3` high-risk/critical | `P1` | Pass 3 synthesis remains a critical seam for long-form output quality and structure. | PR-10 Long-Form Evaluation Normalization | `NEEDS_DESIGN` |
| `S08_ER2_NORMALIZATION` high-risk/critical | `P1` | EvaluationResultV2 normalization is not fully proven end-to-end. | PR-10 Long-Form Evaluation Normalization | `NEEDS_DESIGN` |
| `ADJACENT_CANON_GOVERNANCE` critical | `P1` | Gate 15, Golden Spine, Dialogue Canon, and revision canon metadata are active but critical. | PR-10 Long-Form Evaluation Normalization | `NEEDS_DESIGN` |
| `ADJACENT_DREAM` active partial/critical | `P1` | DREAM long-form synthesis has runtime surface but remains critical. | PR-10 Long-Form Evaluation Normalization | `NEEDS_DESIGN` |
| `ADJACENT_FINAL_EXTERNAL_AUDIT` active partial/critical | `P1` | Final external audit is active but not fully conformance-proven. | PR-10 Long-Form Evaluation Normalization | `NEEDS_DESIGN` |
| `ADJACENT_SEMANTIC_GATE` critical | `P1` | Story layer quality gate exists but conformance and persistence proof are insufficient. | PR-10 Long-Form Evaluation Normalization | `NEEDS_DESIGN` |
| `ADJACENT_REVIEW_GATE` critical | `P1` | Review gate exists but remains critical in registry/audit. | PR-10 Long-Form Evaluation Normalization | `NEEDS_DESIGN` |
| `AR04_SECTION_PERSISTENCE` missing-critical | `P0` | Agent Readiness generation route treats DB save failure as non-fatal and returns generated content. | PR-03 Agent Readiness Persistence Hardening | `READY_FOR_PR` |
| `AR05_AUTHOR_REVIEW` missing-critical | `P0` | Section approval is UI/client state only; no API persists `status='approved'`. | PR-04 Agent Readiness Approval API | `READY_FOR_PR` |
| `AR06_COMPLETENESS_CHECK` missing-critical | `P0` | Package completeness cannot be DB-proven because approvals are not persisted. | PR-04 Agent Readiness Approval API | `READY_FOR_PR` |
| `AR08_EXPORT` partial/gap | `P1` | Export API accepts incomplete packages and does not enforce all sections approved. | PR-05 Agent Readiness Export/History Enforcement | `READY_FOR_PR` |
| `AR09_HISTORY` missing-critical | `P1` | Package history/export records are not persisted. | PR-05 Agent Readiness Export/History Enforcement | `READY_FOR_PR` |
| `RS08_COMPLETION` missing-critical | `P0` | Revise completion certification is planned but not implemented/proven. Downstream handoff remains unsafe. | PR-06 Revise Completion Certification | `READY_FOR_PR` |
| `RS07_LEDGER_SYNC` partial/gap | `P1` | Revision ledger sync exists but needs conformance tests around durability and canonical decisions. | PR-06 Revise Completion Certification | `READY_FOR_PR` |
| `RS06_AUTHOR_DECISION` partial/emerging | `P1` | Author decision capture exists but persistence semantics need explicit conformance tests. | PR-06 Revise Completion Certification | `READY_FOR_PR` |
| `SG01_CREATOR_SUBMISSION` partial/gap | `P1` | Storygate has public preparation surfaces but no certified current-canon submission persistence. | PR-08 Storygate Submission/Listing Persistence | `NEEDS_DESIGN` |
| `SG02_INTAKE_VALIDATION` missing-critical | `P0` | No centralized current-canon 11-field package validator. | PR-07 Storygate Package Validator + Readiness Gate | `NEEDS_DESIGN` |
| `SG03_INTERNAL_SCREENING` missing-critical | `P1` | No current-canon internal screening route/persistence. | PR-08 Storygate Submission/Listing Persistence | `NEEDS_DESIGN` |
| `SG04_TIER_ASSIGNMENT` missing-critical | `P2` | No persisted internal tier/audit evidence. | PR-08 Storygate Submission/Listing Persistence | `NEEDS_DESIGN` |
| `SG05_PACKAGE_VERIFICATION` partial/gap | `P0` | 11-field package is governance-locked, but server-side package verification is missing. | PR-07 Storygate Package Validator + Readiness Gate | `NEEDS_DESIGN` |
| `SG06_READINESS_VERIFICATION` partial/gap | `P0` | 9.0 threshold is documented/tested in registry but not runtime-enforced. | PR-07 Storygate Package Validator + Readiness Gate | `NEEDS_DESIGN` |
| `SG07_INDUSTRY_VERIFICATION` missing-critical | `P1` | Industry verification shell exists, but persisted server-side verification enforcement is not proven. | PR-09 Storygate Verification/Access Workflow | `NEEDS_DESIGN` |
| `SG08_LISTING_ACTIVATION` missing-critical | `P1` | No current-canon listing activation route/persistence. | PR-08 Storygate Submission/Listing Persistence | `NEEDS_DESIGN` |
| `SG09_ACCESS_REQUEST` missing-critical | `P1` | No durable access request route/persistence. | PR-09 Storygate Verification/Access Workflow | `NEEDS_DESIGN` |
| `SG10_CREATOR_ADMIN_APPROVAL` missing-critical | `P1` | Creator/admin approval is core protection but not implemented. | PR-09 Storygate Verification/Access Workflow | `NEEDS_DESIGN` |
| `SG11_CONTROLLED_ACCESS` missing-critical | `P1` | No controlled viewing authorization route. | PR-09 Storygate Verification/Access Workflow | `NEEDS_DESIGN` |
| `SG12_ACCESS_LOGGING_REVOCATION` missing-critical | `P1` | Structured append-only audit and revocation persistence are missing. | PR-09 Storygate Verification/Access Workflow | `NEEDS_DESIGN` |

---

## PR-00 — Governance Visibility

**Goal:** make current branch-local governance artifacts visible to GitHub reviewers.

Required contents:

- `docs/storygate/STORYGATE_STUDIO_CANON.md`
- `docs/SIPOC_STORYGATE_PROCESS.md`
- `lib/storygate/storygateRegistry.ts`
- `__tests__/lib/storygate/storygateRegistry.test.ts`
- `docs/registries/storygate/*.csv`
- `docs/storygate/STORYGATE_LEGACY_DEPENDENCY_REPORT.md`
- `docs/RUNTIME_CONFORMANCE_AUDIT.md`
- `docs/RUNTIME_CONFORMANCE_REMEDIATION_PLAN.md`
- Storygate app copy updates under `app/storygate-studio/**`
- CSV export support in `scripts/export-fipoc-registries.ts`
- Registry README/System Factory Map updates

Acceptance evidence:

- `npm run fipoc:export`
- `npx jest --runInBand --runTestsByPath __tests__/lib/evaluation/fipocRegistry.test.ts __tests__/lib/revision/reviseRegistry.test.ts __tests__/lib/agent-readiness/agentReadinessRegistry.test.ts __tests__/lib/storygate/storygateRegistry.test.ts`
- GitHub PR review confirms files exist in the branch and are not claimed as merged until accepted.

---

## PR-01 — Evaluation Author Exposure Gate

**Goal:** implement/prove `S10b_PHASE5_AUTHOR_EXPOSURE_GATE`.

Required implementation direction:

- Add author-exposure certification module or route-level gate.
- Gate author-visible report surfaces on required validators.
- Fail closed when final audit, normalization, renderer parity, or blocking governance checks fail.
- Never infer readiness from UI state.

Acceptance evidence:

- Tests for blocked exposure when required gate fails.
- Tests for permitted exposure only when canonical persisted artifacts pass.
- Registry status may move only after runtime proof exists.

---

## PR-02 — Evaluation Renderer Parity

**Goal:** prove renderers consume persisted canonical artifacts without recalculation/drift.

Required implementation direction:

- Lock webpage renderer to canonical EvaluationResultV2 input.
- Add parity tests comparing webpage/download/canonical persisted artifact.
- Ensure renderer formats only; it must not recalculate report type, score, genre, criteria, confidence, warnings, pitch, premise, or entity names.

Acceptance evidence:

- Snapshot/contract tests for renderer parity.
- Negative tests proving renderer does not synthesize missing canonical values.

---

## PR-03 — Agent Readiness Persistence Hardening

**Goal:** make AR04 persistence failures fatal.

Required implementation direction:

- In `app/api/agent-readiness/generate/route.ts`, DB save failure must return 500-class error or explicit retry/failure response.
- Do not return generated content as successful if persistence failed.
- Preserve quality gate behavior before persistence.

Acceptance evidence:

- Unit/API tests for Supabase upsert failure.
- Test proves no `200` response is returned when section persistence fails.

---

## PR-04 — Agent Readiness Approval API

**Goal:** persist approvals and make completeness DB-backed.

Required implementation direction:

- Add approval API, e.g. `POST /api/agent-readiness/sections/approve`.
- Approve only authenticated user's own section.
- Persist `status='approved'` with canonical enum validation.
- Reload package completeness from DB, not client-only state.

Acceptance evidence:

- Tests for approved transition.
- Tests for unauthorized approval blocked.
- Tests for non-canonical status rejected.
- Tests proving completeness requires all canonical sections approved.

---

## PR-05 — Agent Readiness Export/History Enforcement

**Goal:** enforce package completeness at export and persist package history.

Required implementation direction:

- `app/api/agent-readiness/download/route.ts` must require all canonical sections and approved status.
- Export must read trusted persisted sections or verify client payload against DB state.
- Persist package/export record for history.

Acceptance evidence:

- Export blocked when one section missing.
- Export blocked when one section unapproved.
- Export writes package history/export record.

---

## PR-06 — Revise Completion Certification

**Goal:** implement/prove `RS08_COMPLETION`.

Required implementation direction:

- Create completion certification runtime path.
- Certify revision session completion only after ledger decisions, sync, cross-check, and required revision artifacts pass.
- Block downstream handoff when completion is not certified.

Acceptance evidence:

- Tests for incomplete ledger blocking completion.
- Tests for completion certificate persistence.
- Tests for downstream handoff blocked without certificate.

---

## PR-07 — Storygate Package Validator + Readiness Gate

**Goal:** implement current-canon Storygate package verification.

Required implementation direction:

- Add 11-field package validator for:
  - `query_letter`
  - `synopsis`
  - `author_bio`
  - `elevator_pitch`
  - `agent_pitch`
  - `market_comparables`
  - `market_category`
  - `target_audience`
  - `market_position_statement`
  - `sample_pages`
  - `rights_declaration`
- Enforce Storygate threshold 9.0 or documented qualified equivalent.
- Reject film/screen/adaptation scope.
- Do not use Base44 validators as current authority.

Acceptance evidence:

- Tests for every missing field.
- Tests for `market_category`, `target_audience`, `market_position_statement`, and `market_comparables` as distinct required fields.
- Tests for 8.0 rejected as Storygate admission.
- Tests for film/screen/adaptation scope rejected.

---

## PR-08 — Storygate Submission/Listing Persistence

**Goal:** persist current-canon submissions and governed listings.

Required implementation direction:

- Create current Storygate submission snapshot persistence.
- Add internal screening/tier fields only if canonical contract is explicit.
- Listing starts private/restricted and requires creator/admin approval for access.
- Duplicate listing guard.

Acceptance evidence:

- Submission persists only after validator pass.
- Listing activation blocked when eligibility fails.
- Listing starts private/restricted.
- Duplicate listing blocked.

---

## PR-09 — Storygate Verification/Access Workflow

**Goal:** implement verified professional access workflow.

Required implementation direction:

- Persist professional verification state.
- Require verified state before access request.
- Persist access request without granting access.
- Creator/admin approval creates grant.
- Controlled viewing requires active grant and allowed artifact scope.
- Every state change/view/download writes append-only audit.
- Revocation blocks future access without deleting history.

Acceptance evidence:

- Unverified requester blocked.
- Access request does not grant access.
- Non-creator/non-admin approval blocked.
- View outside allowed artifacts blocked.
- Audit event written for request, grant, denial, view/download, verification, revocation.
- Revoked grant blocks future access.

---

## PR-10 — Long-Form Evaluation Normalization Hardening

**Goal:** reduce critical Evaluation conformance risk around long-form synthesis/normalization/final audit.

Required implementation direction:

- Prove Pass 3 synthesis produces canonical EvaluationResultV2 inputs.
- Prove normalization rejects malformed or incomplete outputs.
- Prove DREAM/final external audit failures block author exposure where configured blocking.
- Add fixture-based long-form regression tests, including known-problem manuscripts when available.

Acceptance evidence:

- EvaluationResultV2 schema conformance tests.
- Long-form synthesis failure-path tests.
- Final external audit blocking tests.
- Renderer parity tests integrated with PR-02 where applicable.

---

## Cartel Babies Re-Run Doctrine

Cartel Babies can be run again after PR-00 lands, or on this branch for diagnostic purposes, but the result must not be treated as production certification.

The purpose of the rerun is now different:

```text
Before: Does it work?
Now: If it fails, which runtime-conformance seam failed?
```

Classify any rerun failure against this remediation plan:

| Failure Class | Route to PR |
|---------------|-------------|
| Author-visible output exposed before all required checks pass | PR-01 Evaluation Author Exposure Gate |
| Web report differs from canonical persisted result | PR-02 Evaluation Renderer Parity |
| Download differs from web/canonical result | PR-02 / PR-10 depending on root cause |
| EvaluationResultV2 schema or normalized artifact invalid | PR-10 Long-Form Evaluation Normalization |
| Pass 3 synthesis produces incomplete, contradictory, or malformed long-form output | PR-10 Long-Form Evaluation Normalization |
| DREAM/final external audit fails to block author exposure when configured blocking | PR-10 Long-Form Evaluation Normalization |
| Revision handoff depends on uncertified Revise completion | PR-06 Revise Completion Certification |

The improvement is not that failure is impossible. The improvement is that failure now has a governance-backed taxonomy and an implementation queue.

---

## Operating Rule

No factory may be promoted from `registry-described` to `SIPOC-enforced` until remediation rows for its missing-critical stages are `DONE` with tests and runtime evidence.

This plan should be updated by implementation PRs, not by speculative governance edits.
