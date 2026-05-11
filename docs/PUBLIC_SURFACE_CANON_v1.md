# PUBLIC_SURFACE_CANON_v1 — Two-Tier IP Boundary Doctrine

**Status:** CANON — Binding  
**Version:** v1  
**Authority chain:** NOMENCLATURE_CANON_v1 → this document → all UI/API/export surfaces  
**Enforcement:** CI guard (`scripts/ci-guard/check_public_surface_terms.ts`) + TypeScript types  

---

## 1. Purpose

This document defines the **translation boundary** between the internal evaluation engine (Tier 2) and every user-facing surface (Tier 1). It is the canonical contract for what may and may not cross the public API, UI, report, and export boundary.

Without this boundary:
- Internal canonical identifiers (wave IDs, gate IDs, doctrine codes, registry keys, prompt fragments) leak into user-facing output.
- IP embedded in the internal schema is exposed.
- The public schema becomes coupled to the internal schema, preventing independent evolution.

---

## 2. Two-Tier Doctrine

### Tier 1 — Public Surface

Everything that can be seen, consumed, or downloaded by an end user:
- UI pages and components that render evaluation output
- API route responses returned to clients (`/api/reports/...`, etc.)
- Exported files (JSON, PDF, CSV)
- Webhook payloads sent to third parties

**Tier 1 uses only `PublicEvaluationReport` and `PublicRevisionHandoff` schemas (defined in §4).**

### Tier 2 — Internal / Protected IP

Everything that runs inside the evaluation engine, pipeline, and persistence layer:
- `EvaluationResultV2` and all constituent types
- Wave identifiers and tiers (`early`, `mid`, `late`, WAVE_GUIDE internal codes)
- Gate identifiers and decision codes (`ArtifactGateResult`, gate codes)
- Doctrine codes, registry keys, policy family strings
- Prompt versions and prompt fragments
- `persistEvaluationResultV2` return types
- All `lib/evaluation/pipeline/` internals

**Tier 2 never travels to the user surface directly.**

---

## 3. Translation Boundary

The **sole authorized translation point** from Tier 2 → Tier 1 is:

```
lib/evaluation/translateToPublicReport.ts
```

This module exports:
- `translateToPublicReport(internal: EvaluationResultV2): PublicEvaluationReport`
- `translateToPublicHandoff(internal: EvaluationResultV2): PublicRevisionHandoff`

**Rules:**
1. All UI components and API routes that render evaluation output **MUST** call one of these functions and **MUST NOT** consume `EvaluationResultV2` directly for display.
2. The translator **MUST** drop all banned fields before returning (see §5).
3. The translator is the only location where internal criterion keys map to craft-language labels.
4. No other module may perform this translation.

---

## 4. Canonical Schemas

### 4.1 PublicEvaluationReport

Defined in: `types/public-evaluation-report.ts`

| Field | Type | Description |
|---|---|---|
| `reportId` | `string` | Opaque public report identifier (not the internal `evaluation_run_id`) |
| `generatedAt` | `string` | ISO timestamp |
| `verdict` | `"pass" \| "revise" \| "fail"` | Canonical verdict |
| `overallScore` | `number \| null` | 0–100, null when not enough signal |
| `confidenceLabel` | `"high" \| "medium" \| "low" \| "withheld"` | Public confidence band |
| `summary` | `string` | One-paragraph editorial summary |
| `strengths` | `string[]` | Top-3 strength statements (craft language) |
| `risks` | `string[]` | Top-3 risk statements (craft language) |
| `criteria` | `PublicCriterionResult[]` | Per-criterion public view (§4.3) |
| `recommendations` | `PublicRecommendations` | Quick wins + strategic revisions (§4.4) |
| `manuscriptWordCount` | `number \| undefined` | Word count metadata, user-visible |
| `genre` | `string \| undefined` | Genre metadata |
| `warnings` | `string[]` | Governance warnings in craft language |
| `limitations` | `string[]` | Scope limitations in craft language |

**Banned from this schema:** `evaluation_run_id`, `job_id`, `manuscript_id`, `user_id`, `engine`, `prompt_version`, `policy_family`, `schema_version`, `score_adjustments`, `governance.transparency`, `criteria_plan`, `repro_anchor`, `artifact_validation_result`, `artifact_reason_codes`, `processing.segment_count`, `processing.total_tokens_estimated`, `processing.runtime_ms`, all wave/gate identifiers.

### 4.2 PublicRevisionHandoff

Defined in: `types/public-revision-handoff.ts`

| Field | Type | Description |
|---|---|---|
| `handoffId` | `string` | Opaque handoff identifier |
| `generatedAt` | `string` | ISO timestamp |
| `verdict` | `"pass" \| "revise" \| "fail"` | Canonical verdict |
| `prioritizedActions` | `PublicActionItem[]` | Ordered revision actions in craft language |
| `criteriaHighlights` | `PublicCriterionHighlight[]` | Surface-level highlights per criterion |
| `nextStepSuggestion` | `string` | Single editorial next-step suggestion |

### 4.3 PublicCriterionResult

| Field | Type | Description |
|---|---|---|
| `label` | `string` | Craft-language criterion label (e.g. "Voice", "Pacing") |
| `status` | `"evaluated" \| "insufficient_signal" \| "not_applicable"` | Public status vocabulary |
| `score` | `number \| null` | 0–10, null when not scorable |
| `rationale` | `string` | Qualitative explanation |
| `evidence` | `PublicEvidenceItem[]` | Snippets with no internal location metadata |
| `recommendations` | `PublicRecommendationItem[]` | Targeted criterion recommendations |

**Note:** `"evaluated"` maps from internal `"SCORABLE"`. `"insufficient_signal"` maps from `"NO_SIGNAL" | "INSUFFICIENT_SIGNAL"`. `"not_applicable"` maps from `"NOT_APPLICABLE"`. Internal status values **MUST NOT** appear in public output.

### 4.4 PublicRecommendations

| Field | Type | Description |
|---|---|---|
| `quickWins` | `PublicActionItem[]` | Low-effort, high-impact actions |
| `strategicRevisions` | `PublicActionItem[]` | Higher-effort structural changes |

### 4.5 PublicActionItem

| Field | Type | Description |
|---|---|---|
| `action` | `string` | Editorial action statement |
| `why` | `string` | Rationale |
| `effort` | `"low" \| "medium" \| "high"` | Effort level |
| `impact` | `"low" \| "medium" \| "high"` | Expected impact |

---

## 5. Banned Identifiers on Public Surface

The following patterns **MUST NOT** appear in any Tier 1 payload, string, or rendered output. The CI guard enforces this automatically.

### 5.1 Banned string patterns (regex)

| Pattern | Reason |
|---|---|
| `WAVE-[A-Z0-9_]+` | Internal wave identifiers |
| `\bWAVE_GUIDE\b` | Wave guide internal reference |
| `Gate\s+\d+[\.\d]*` | Gate identifiers (e.g. "Gate 15.1") |
| `RITUAL-[A-Z0-9_-]+` | Ritual/doctrine codes |
| `evaluation_result_v2` | Internal schema version |
| `schema_version` | Internal schema field |
| `policy_family` | Internal governance field |
| `repro_anchor` | Internal reproducibility field |
| `artifact_validation_result` | Internal gate field |
| `artifact_reason_codes` | Internal gate field |
| `criteria_plan` | Internal transparency field |
| `CRITERIA_13` | Internal criteria source reference |
| `prompt_version` | Internal engine field |
| `evaluation_run_id` (in responses) | Internal correlation ID |
| `pipeline_stage` | Internal pipeline field |
| `failure_origin` | Internal failure envelope field |
| `AUTHORITY_CAP_APPLIED` | Internal score adjustment code |
| `score_adjustments` | Internal score adjustment array |
| `INSUFFICIENT_SIGNAL_REASON` | Internal signal vocabulary |
| `\bNO_SIGNAL\b` | Internal signal status |
| `\bINSUFFICIENT_SIGNAL\b` | Internal signal status |
| `\bSCORABLE\b` | Internal signal status |
| `\bNOT_APPLICABLE\b` (in responses) | Internal criterion status |
| `MDM_WORK_TYPE_CANON` | Internal MDM reference |
| `CANON_PHASE_STATUS` | Internal phase status reference |

### 5.2 Scope of enforcement

The CI guard scans:
- `app/` — all route handlers and page components
- `components/` — all UI components
- `lib/evaluation/translateToPublicReport.ts` — audited separately to confirm banned terms are only in drop/map logic, not output

---

## 6. Criterion Label Mapping (Tier 2 key → Tier 1 label)

This is the authoritative mapping table. The translator **MUST** use exactly these labels.

| Internal key (CriterionKey) | Public label |
|---|---|
| `concept` | "Concept & Premise" |
| `narrativeDrive` | "Narrative Drive" |
| `character` | "Character" |
| `voice` | "Voice" |
| `sceneConstruction` | "Scene Construction" |
| `dialogue` | "Dialogue" |
| `theme` | "Theme" |
| `worldbuilding` | "Worldbuilding" |
| `pacing` | "Pacing" |
| `proseControl` | "Prose Control" |
| `tone` | "Tone" |
| `narrativeClosure` | "Narrative Closure" |
| `marketability` | "Market Fit" |

**MDM criterion keys** (`hook`, `voice`, `character`, `conflict`, `theme`, `pacing`, `dialogue`, `worldbuilding`, `stakes`, `linePolish`, `marketFit`, `keepGoing`, `technical`) use the same key as their public label with title-case normalization applied by the translator.

---

## 7. Export Serialization Rule

All serialization paths that write user-downloadable files (JSON exports, PDF generation, CSV) **MUST**:
1. Accept only `PublicEvaluationReport` or `PublicRevisionHandoff` as input.
2. Call `assertNoBannedTerms(payload)` (exported from `lib/evaluation/translateToPublicReport.ts`) before writing.
3. Throw if any banned term is detected — never silently strip.

---

## 8. Governance Chain

```
NOMENCLATURE_CANON_v1
  └── defines canonical Tier 2 identifiers (all internal)
      └── PUBLIC_SURFACE_CANON_v1  ← this document
            └── defines what may cross to Tier 1
                └── lib/evaluation/translateToPublicReport.ts
                      └── sole authorized translator
                          └── types/public-evaluation-report.ts
                          └── types/public-revision-handoff.ts
                              └── all UI / API / export surfaces
                                  └── scripts/ci-guard/check_public_surface_terms.ts
                                        └── fails PRs on violation
```

---

## 9. Amendment Process

Changes to §4 (schemas), §5 (banned identifiers), or §6 (label mapping) require:
1. A version bump to this document.
2. A corresponding update to `scripts/ci-guard/check_public_surface_terms.ts` banned patterns.
3. A corresponding update to `types/public-evaluation-report.ts` or `types/public-revision-handoff.ts`.
4. CI must pass before merging.
