# Agent Readiness Package — SIPOC/FIPOC Process Constitution

> **Status:** Executable registry active — `lib/agent-readiness/agentReadinessRegistry.ts`
> **CSV mirrors:** `docs/registries/agent-readiness/`
> **Revise counterpart:** `docs/SIPOC_REVISE_PROCESS.md`
> **Governance:** `AI_GOVERNANCE.md` (binding)

---

## Purpose

This document is the canonical SIPOC constitution for the **Agent Readiness Package** —
the full pipeline from Manuscript Eligibility Check through Section Generation, Quality
Gating, Author Review, and Package Export.

It is the machine-authoritative counterpart to the Revise Platform SIPOC.
Every stage, artifact, field, kick, and state machine here is executable: the
TypeScript source is `lib/agent-readiness/agentReadinessRegistry.ts`.

---

## Factory Position

```
EVALUATION FACTORY   (docs/SIPOC_EVALUATION_PROCESS.md)
        ↓
  unified_evaluation_document_v1  (Phase 5-certified UED)
        ↓
REVISE FACTORY   (docs/SIPOC_REVISE_PROCESS.md)
        ↓
  revision_opportunity_ledger_v1  (certified ledger)
  revision_completion_record_v1   (certified revise decisions)
        ↓
  AGENT_PACKAGE_TRACEABILITY_GATE
        ↓
AGENT READINESS FACTORY   (← this document)
        ↓
  agent_readiness_package_v1  (certified package for downstream agents)
        ↓
  package_export_v1  (.txt or .docx submission package)
        ↓
  (future: Storygate Studio submission)
```

### Certified Input Contract

The Agent Readiness Package consumes **only certified artifacts**:

| Source | Artifact | Required |
|---|---|---|
| Evaluation Factory | `unified_evaluation_document_v1` (Phase 5-certified) | yes |
| Evaluation Factory | `evaluation_result_v2` (readiness score, narrative summary) | yes |
| Revise Factory | `revision_opportunity_ledger_v1` (certified ledger) | yes (if revise completed) |
| Revise Factory | `revision_completion_record_v1` (certified decisions) | yes (if revise completed) |
| Revise Factory | `author_decision_v1` (per-opportunity decisions) | yes (if revise completed) |

### Banned Inputs (AGENT_PACKAGE_TRACEABILITY_GATE enforcement)

The Agent Readiness Package **MAY NOT** consume:

| Banned Source | Reason |
|---|---|
| Raw chunks (pass artifacts) | Uncertified intermediate state; not governance-approved |
| Seed outputs (Phase 0/0.5) | Temporary diagnostic artifacts; not author-facing |
| Pass 1/2/3 intermediate artifacts | Pre-normalization state; potentially inconsistent |
| Temporary diagnostics (telemetry, logs) | Observability data; not content |
| `evaluation_report_view_model_v1` | ViewModel is a renderer surface — Agent Readiness is not a renderer |
| Web/PDF/DOCX/TXT renderer output | Presentation/download surfaces; not package authority |
| Direct DB queries bypassing certified artifacts | Breaks traceability chain |

Violations produce `AGENT_PACKAGE_TRACEABILITY_VIOLATION` and block package generation.

---

## Runtime Doctrine

1. **Evaluation-first.** Agent Readiness requires a completed (`complete`) evaluation job.
   Failed, running, queued, or canceled evaluations are ineligible. The `evaluationJobId`
   is a required input to every section generation request.

2. **Certified inputs only.** All data consumed by section generation must originate from
   certified artifacts: `unified_evaluation_document_v1`, `evaluation_result_v2`,
   `revision_opportunity_ledger_v1`, or `revision_completion_record_v1`. Raw chunks,
   seed outputs, pass artifacts, and temporary diagnostics are banned inputs.
   `AGENT_PACKAGE_TRACEABILITY_GATE` enforces this before generation begins.

3. **Draft before approval.** Every generated section is written to `agent_readiness_sections`
   with `status='draft'`. Only an explicit author approval action may set `status='approved'`.
   The generation route must never write `status='approved'` at generation time.

4. **Quality gate is enforced.** AR03_QUALITY_GATE runs before persistence. A section that
   fails the quality gate (too short, editorial meta-language, unresolved placeholders,
   word limit exceeded) must not be persisted and must return an error to the client.

5. **Author bio must not contain invented facts.** The system may shape author-supplied
   input only. It must not invent credentials, awards, education, publication history,
   platform, pet names, or personal history not provided by the author.

6. **Canonical section types only.** The six canonical sections are:
   `query_letter`, `what_makes_unique`, `synopsis`, `query_pitch`, `comparables`, `author_bio`.
   No other section type values are permitted in any DB record or API payload.

7. **Canonical generate modes only.** `generate`, `regenerate`, `improve`. No other values.

8. **Canonical export formats only.** `txt`, `docx`. No other values.

9. **Word limits are hard caps.** Each section has a defined word limit enforced by the
   quality gate. Exceeding the limit is a kick (`WORD_LIMIT_EXCEEDED`). Limits are in
   `SECTION_WORD_LIMIT_REGISTRY`.

10. **Export does not guarantee agent interest.** The package export must not contain
    language implying agent interest, representation, publishing offers, sales outcomes,
    or market performance. These claims are prohibited.

11. **Observability is passive.** Telemetry, metrics, and governance logs must not alter
    control flow. Observability failures are non-fatal.

12. **UI reads persisted state only.** The UI must not simulate, guess, or fabricate
    section status, approval state, or package completeness. It reads from the DB or
    from explicit author actions.

13. **Illegal state transitions throw.** A section cannot go from `draft` to a non-canonical
    status value. Non-canonical `PackageStatus`, `SectionStatus`, `GenerateMode`, or
    `ExportFormat` values are CI-failing defects.

14. **Agent packages do not reinterpret upstream artifacts.** Agent Readiness may package certified Evaluation and Revise artifacts into author-facing submission materials, but it must not reinterpret UED, Revise ledger, scores, recommendations, or business rules.

15. **Renderer-dependent handoff is invalid.** Agent Readiness must not consume Web/PDF/DOCX/TXT renderer output or `evaluation_report_view_model_v1` as package authority. If package assembly depends on renderer/download output, the handoff is invalid and must kick back to the Evaluation / Revise authority boundary instead of assembling the package.

---

## Known Gaps (as of 2026-06-27)

> These are explicitly documented runtime gaps. They are not design errors —
> they are honest acknowledgment of what is not yet implemented. Each is marked
> `missing_critical` or `gap` in the registry.

### RESOLVED-1: Section approval persistence (`AR05`, `AR06`)
Section approval is now persisted via `POST /api/agent-readiness/sections/approve`.
The executable registry marks `AR05_AUTHOR_REVIEW` and `AR06_COMPLETENESS_CHECK`
as `proven / ok`; stale wording that described the Approve button as a disabled
stub is no longer authoritative.

### RESOLVED-2: DB persistence failure handling (`AR04`)
`AR04_SECTION_PERSISTENCE` is now `proven / ok` in the executable registry. DB
write failure returns HTTP 500 and generated content is not returned to the author
as if persistence had succeeded.

### GAP-3: Export does not enforce section completeness or approval (`AR08`)
The download route (`app/api/agent-readiness/download/route.ts`) requires only
`manuscriptTitle` and at least one section. It does not check approval status, does
not require all 6 sections, and does not read from the DB. Missing sections are
silently skipped. The UI gates the CTA on `allSectionsStarted` (all 6 have drafts)
but the API itself has no completeness or approval enforcement.

**Required fix:** Add API-level validation requiring all 6 canonical sections to be
present (and ideally approved) before export is permitted.

### GAP-4: Package history is not persisted (`AR09`)
`AR09_HISTORY` is `planned_required` / `missing_critical`. No package record is
written to the database on export. There is no package version history, no export
audit trail, and no `packageStatus=Exported` write. Export is a stateless one-shot
file generation.

---

## Runtime Spine

```
Agent Package Traceability Gate (AR00)  [AGENT_PACKAGE_TRACEABILITY_GATE]
  → Manuscript Eligibility Check (AR01)
    → Section Generation - AI (AR02)
      → Quality Gate (AR03)
        → Section Persistence (AR04)
          → Author Review & Section Approval (AR05)
            → Package Completeness Check (AR06)
              → Package Export: Assembly + Download (AR08)
                → [planned] Package History (AR09)

  One-click shortcut:
  Batch Section Generation (AR07) → AR02×5 → AR03 → AR04 (per section)
```

**Highest-risk seams:**
- `AR00_TRACEABILITY_GATE` (certified input validation — must run before any generation)
- `AR08_EXPORT` (package assembly/export still does not enforce all-section approval at API level — GAP-3)
- `AR09_HISTORY` (package history/audit persistence missing — GAP-4)
- `AR00_TRACEABILITY_GATE → AR08_EXPORT` (renderer/download output must never become package authority)

---

## Stage Contract: `AR00_AGENT_PACKAGE_TRACEABILITY_GATE`

### Purpose

Validates that the Agent Readiness pipeline consumes only certified artifacts from upstream factories. This gate runs before any section generation begins and prevents uncertified or raw data from contaminating the package.

### Input

- `evaluationJobId` (from client request)
- Certified artifacts available in system:
  - `unified_evaluation_document_v1`
  - `evaluation_result_v2`
  - `revision_opportunity_ledger_v1` (if revise completed)
  - `revision_completion_record_v1` (if revise completed)

### Input Acceptance Metrics

| Metric | Threshold | Failure Mode |
|---|---|---|
| Evaluation job status = `complete` | required | `AGENT_PACKAGE_EVALUATION_INCOMPLETE` |
| `unified_evaluation_document_v1` present for job | required | `AGENT_PACKAGE_UED_MISSING` |
| `evaluation_result_v2` present and non-null | required | `AGENT_PACKAGE_EVAL_RESULT_MISSING` |
| UED Phase 5 certification flag set | required | `AGENT_PACKAGE_UED_NOT_CERTIFIED` |
| Revision ledger present (if revise completed) | conditional | warning only — package proceeds without revise data |
| No raw chunk references in generation context | required | `AGENT_PACKAGE_TRACEABILITY_VIOLATION` |
| No seed output references in generation context | required | `AGENT_PACKAGE_TRACEABILITY_VIOLATION` |

### Process

Resolve evaluation job → load certified artifacts → verify no banned inputs are referenced → pass certified context to section generation.

### Output

- Certified generation context: `agent_readiness_certified_context_v1`
- Contains only: UED summary, readiness score, opportunity ledger summary, completion status, manuscript metadata

### Output Acceptance Metrics

| Metric | Threshold | Notes |
|---|---|---|
| Certified context completeness | UED + eval result present | Minimum viable package input |
| Banned input absence | 0 references to raw chunks, seeds, pass artifacts | Hard enforcement |
| Source hash linkage | generation context includes `source_ued_hash` | Audit trail |
| Revise enrichment (if available) | ledger summary + decision summary included | Enriches package quality |

### Gates / Invariants

- **AGENT_PACKAGE_TRACEABILITY_GATE:** Generation context MUST NOT contain raw chunks, seed outputs, pass artifacts, or temporary diagnostics
- Traceability is verified once at gate entry — individual section generation (AR02) inherits the certified context without re-validation
- If revise data is unavailable (author skipped revise), package proceeds with evaluation data only — this is valid

### Failure Codes

- `AGENT_PACKAGE_TRACEABILITY_VIOLATION` — banned input detected in generation context
- `AGENT_PACKAGE_EVALUATION_INCOMPLETE` — evaluation job not in `complete` status
- `AGENT_PACKAGE_UED_MISSING` — no UED found for evaluation job
- `AGENT_PACKAGE_EVAL_RESULT_MISSING` — evaluation result not found
- `AGENT_PACKAGE_UED_NOT_CERTIFIED` — UED lacks Phase 5 certification

---

## Canonical Enum Values

| Enum | Canonical Values |
|------|-----------------|
| `SectionType` | `query_letter`, `what_makes_unique`, `synopsis`, `query_pitch`, `comparables`, `author_bio` |
| `SectionStatus` | `draft`, `approved` |
| `PackageStatus` | `Not Started`, `Draft`, `Approved`, `Exported` |
| `GenerateMode` | `generate`, `regenerate`, `improve` |
| `ExportFormat` | `txt`, `docx` |

---

## Stage Summary

| # | Stage ID | Name | Status | Gap |
|---|----------|------|--------|-----|
| 0 | `AR00_TRACEABILITY_GATE` | Agent Package Traceability Gate | active / emerging | — |
| 1 | `AR01_MANUSCRIPT_ELIGIBILITY` | Manuscript Eligibility Check | proven / ok | — |
| 2 | `AR02_SECTION_GENERATION` | Section Generation (AI) | proven / ok | — |
| 3 | `AR03_QUALITY_GATE` | Quality Gate | proven / ok | — |
| 4 | `AR04_SECTION_PERSISTENCE` | Section Persistence | proven / ok | DB failure returns HTTP 500 |
| 5 | `AR05_AUTHOR_REVIEW` | Author Review & Section Approval | proven / ok | approval persisted via API |
| 6 | `AR06_COMPLETENESS_CHECK` | Package Completeness Check | proven / ok | approved status tracked in DB |
| 7 | `AR07_BATCH_GENERATION` | Batch Section Generation (generate-all) | proven / ok | — |
| 8 | `AR08_EXPORT` | Package Export (Assembly + Download) | partial / gap | GAP-3: no completeness/approval enforcement |
| 9 | `AR09_HISTORY` | Package History | missing_critical / critical | GAP-4: no persistence |

---

## Authority Sources

| ID | Path | Applies To |
|----|------|-----------|
| `AI_GOVERNANCE` | `AI_GOVERNANCE.md` | All stages |
| `ARTIFACT_AUTHORITY_CHAIN` | `docs/SIPOC_ARTIFACT_AUTHORITY_CHAIN.md` | AR00 (traceability) |
| `SECTION_WORD_LIMIT_REGISTRY` | `lib/agent-readiness/agentReadinessRegistry.ts` | AR03, AR02 |
| `SIPOC_AGENT_READINESS_PROCESS` | `docs/SIPOC_AGENT_READINESS_PROCESS.md` | All stages |
| `JOB_CONTRACT_v1` | `docs/JOB_CONTRACT_v1.md` | AR01 |
| `GOLD_STANDARD` | `lib/agent-readiness/gold-standard.ts` | AR02, AR03 |
| `REVISE_REGISTRY` | `lib/revision/reviseRegistry.ts` | AR01 |
| `DOWNLOAD_ROUTE` | `app/api/agent-readiness/download/route.ts` | AR08 |
| `GENERATE_ROUTE` | `app/api/agent-readiness/generate/route.ts` | AR02, AR03, AR04 |
