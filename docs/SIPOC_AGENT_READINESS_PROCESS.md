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
  evaluation_result_v2  (readiness score, narrative summary)
        ↓
REVISE FACTORY   (docs/SIPOC_REVISE_PROCESS.md)
        ↓
  revision_completion_record_v1
        ↓
AGENT READINESS FACTORY   (← this document)
        ↓
  package_export_v1  (.txt or .docx submission package)
        ↓
  (future: Storygate Studio submission)
```

---

## Runtime Doctrine

1. **Evaluation-first.** Agent Readiness requires a completed (`complete`) evaluation job.
   Failed, running, queued, or canceled evaluations are ineligible. The `evaluationJobId`
   is a required input to every section generation request.

2. **Draft before approval.** Every generated section is written to `agent_readiness_sections`
   with `status='draft'`. Only an explicit author approval action may set `status='approved'`.
   The generation route must never write `status='approved'` at generation time.

3. **Quality gate is enforced.** AR03_QUALITY_GATE runs before persistence. A section that
   fails the quality gate (too short, editorial meta-language, unresolved placeholders,
   word limit exceeded) must not be persisted and must return an error to the client.

4. **Author bio must not contain invented facts.** The system may shape author-supplied
   input only. It must not invent credentials, awards, education, publication history,
   platform, pet names, or personal history not provided by the author.

5. **Canonical section types only.** The six canonical sections are:
   `query_letter`, `what_makes_unique`, `synopsis`, `query_pitch`, `comparables`, `author_bio`.
   No other section type values are permitted in any DB record or API payload.

6. **Canonical generate modes only.** `generate`, `regenerate`, `improve`. No other values.

7. **Canonical export formats only.** `txt`, `docx`. No other values.

8. **Word limits are hard caps.** Each section has a defined word limit enforced by the
   quality gate. Exceeding the limit is a kick (`WORD_LIMIT_EXCEEDED`). Limits are in
   `SECTION_WORD_LIMIT_REGISTRY`.

9. **Export does not guarantee agent interest.** The package export must not contain
   language implying agent interest, representation, publishing offers, sales outcomes,
   or market performance. These claims are prohibited.

10. **Observability is passive.** Telemetry, metrics, and governance logs must not alter
    control flow. Observability failures are non-fatal.

11. **UI reads persisted state only.** The UI must not simulate, guess, or fabricate
    section status, approval state, or package completeness. It reads from the DB or
    from explicit author actions.

12. **Illegal state transitions throw.** A section cannot go from `draft` to a non-canonical
    status value. Non-canonical `PackageStatus`, `SectionStatus`, `GenerateMode`, or
    `ExportFormat` values are CI-failing defects.

---

## Known Gaps (as of 2026-06-11)

> These are explicitly documented runtime gaps. They are not design errors —
> they are honest acknowledgment of what is not yet implemented. Each is marked
> `missing_critical` or `gap` in the registry.

### GAP-1: Section approval is not persisted to DB (`AR05`, `AR06`)
The **Approve** button in `AgentReadinessClient.tsx` is a disabled stub with no
`onClick` handler. Approval state lives in React `sectionStates` only. No API
endpoint writes `status='approved'` to `agent_readiness_sections`. The
`getPackageStatuses()` function reads `status='approved'` from DB but nothing writes
it, so `packageStatus` can never become `Approved` via the DB path.

**Required fix:** Create `POST /api/agent-readiness/sections/approve` (or similar),
wire the Approve button, and reload section state from DB on page load.

### GAP-2: DB persistence failure is non-fatal (`AR04`)
In `app/api/agent-readiness/generate/route.ts`, the `saveError` from the Supabase
upsert is caught, logged as a warning, and the route still returns `200` with the
generated content. This means content can be shown to the author without being saved.
This violates the AI_GOVERNANCE contract requiring system errors to surface as 500
rather than being masked.

**Required fix:** Treat `saveError` as a 500-class error or implement a retry + explicit
failure response so the author knows persistence failed.

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
Manuscript Eligibility Check (AR01)
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
- `AR04_SECTION_PERSISTENCE` (DB failure non-fatal — GAP-2)
- `AR05_AUTHOR_REVIEW → AR06_COMPLETENESS_CHECK` (approval not persisted — GAP-1)

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
| 1 | `AR01_MANUSCRIPT_ELIGIBILITY` | Manuscript Eligibility Check | proven / ok | — |
| 2 | `AR02_SECTION_GENERATION` | Section Generation (AI) | proven / ok | — |
| 3 | `AR03_QUALITY_GATE` | Quality Gate | proven / ok | — |
| 4 | `AR04_SECTION_PERSISTENCE` | Section Persistence | missing_critical / critical | GAP-2: DB failure non-fatal |
| 5 | `AR05_AUTHOR_REVIEW` | Author Review & Section Approval | missing_critical / critical | GAP-1: approval not persisted |
| 6 | `AR06_COMPLETENESS_CHECK` | Package Completeness Check | missing_critical / critical | GAP-1: DB completeness check broken |
| 7 | `AR07_BATCH_GENERATION` | Batch Section Generation (generate-all) | proven / ok | — |
| 8 | `AR08_EXPORT` | Package Export (Assembly + Download) | partial / gap | GAP-3: no completeness/approval enforcement |
| 9 | `AR09_HISTORY` | Package History | missing_critical / critical | GAP-4: no persistence |

---

## Authority Sources

| ID | Path | Applies To |
|----|------|-----------|
| `AI_GOVERNANCE` | `AI_GOVERNANCE.md` | All stages |
| `SECTION_WORD_LIMIT_REGISTRY` | `lib/agent-readiness/agentReadinessRegistry.ts` | AR03, AR02 |
| `SIPOC_AGENT_READINESS_PROCESS` | `docs/SIPOC_AGENT_READINESS_PROCESS.md` | All stages |
| `JOB_CONTRACT_v1` | `docs/JOB_CONTRACT_v1.md` | AR01 |
| `GOLD_STANDARD` | `lib/agent-readiness/gold-standard.ts` | AR02, AR03 |
| `REVISE_REGISTRY` | `lib/revision/reviseRegistry.ts` | AR01 |
| `DOWNLOAD_ROUTE` | `app/api/agent-readiness/download/route.ts` | AR08 |
| `GENERATE_ROUTE` | `app/api/agent-readiness/generate/route.ts` | AR02, AR03, AR04 |
