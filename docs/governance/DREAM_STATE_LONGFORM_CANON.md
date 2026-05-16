# DREAM State Long-Form Evaluation Canon

**Status:** LOCKED  
**Owner:** Mmeraw  
**Created:** 2026-05-16  
**Scope:** All long-form DREAM state evaluations — standard and multi-layer / multi-voice  
**Authority:** This document is the master template for every long-form DREAM evaluation produced by RevisionGrade. All gold-standard benchmark files, all pipeline output, and all evaluator prompts must conform to this canon. No gold-standard file may deviate from the section order, section names, or required sub-sections defined here.

---

## Purpose

This canon ensures that every long-form DREAM evaluation — whether produced manually as a benchmark or automatically by the pipeline — is structurally identical, mechanically checkable, and editorially trustworthy.

A DREAM long-form evaluation is the highest-quality output RevisionGrade can produce. It is not a summary. It is a professional editorial document that covers the full manuscript with scored criteria, layered analysis, symbolic system auditing, revision planning, and releasability assessment.

Every evaluator, prompt engineer, benchmark author, and CI check must derive requirements from this document.

---

## Required Frontmatter

Every DREAM long-form evaluation file must begin with a YAML frontmatter block:

```yaml
---
benchmark-schema: canonical-13-v1
dream-state: true
output-mode: standard_long_form | multi_layer_long_form
evaluation-date: YYYY-MM-DD
manuscript-title: <title>
manuscript-author: <author>
word-count: <number>
overall-score: <n> / 100
readiness-score: <n> / 100
commercial-score: <n> / 100
literary-score: <n> / 100
---
```

---

## Canonical Section Order

Every DREAM long-form evaluation must contain the following sections in this exact order. Section numbers and exact heading text are required. Sub-section structure within each section may vary by manuscript, but all required sub-sections are mandatory.

---

### Section 1 — Executive Verdict

**Heading:** `## 1. Executive Verdict`

Required content:
- One paragraph (minimum) stating the manuscript's governing ambition, its primary strengths, its principal drag, and its current readiness posture.
- Must name the central dramatic question or emotional engine.
- Must not be generic. Every sentence must be specific to this manuscript.

---

### Section 2 — Market / Shelf Description

**Heading:** `## 2. Market / Shelf Description`

Required sub-sections:
- `### Best shelf description` — one sentence naming the genre shelf
- `### Likely shelf neighbors` — bulleted list of comparable shelves or comp titles
- `### Pitchable comparison space` — brief description of pitch-ready comp field
- `### Marketable hook` — one paragraph pitchable summary
- `### Market danger` — risks of misreading or mispositionig

---

### Section 3 — What This Manuscript Should Not Become

**Heading:** `## 3. What This Manuscript Should Not Become`

Required content:
- At least three named failure modes the manuscript risks drifting into.
- Each sub-section is a named risk: `### It should not become [X]`
- Closes with a one-line principle (e.g., "The target is not simplification. The target is legibility under pressure.")

---

### Section 4 — Structural Stack

**Heading:** `## 4. Structural Stack`

Required content:
- For **multi_layer_long_form**: a `### Layer & Voice Map` table with columns: Layer, Plane/Arena, Dominant voice/mode, Function in book, Primary stakes, Major dependencies. Then `### Stack diagnosis` paragraph.
- For **standard_long_form**: numbered layers (Layer 1, Layer 2, …) each with a brief paragraph describing function and revision priority.

---

### Section 5 — Arc Map

**Heading:** `## 5. Arc Map`

Required content:
- Named Acts (Act I through Act N) or equivalent arc divisions.
- Each act: name, approximate chapter range, primary function, revision priority.
- Must cover opening through final act/coda.

---

### Section 6 — Score Grid

**Heading:** `## 6. Score Grid`

Required content:
- A markdown table with columns: `#`, `Criterion`, `Score`, `Confidence`, `Summary`
- Must contain all 13 canonical criteria in order (see §Canonical 13 Criteria below).
- For **multi_layer_long_form**: must also include the 4 architecture rows after criterion 13.
- Must include a raw average and DREAM normalized score line below the table.
- Must include an overall confidence statement.

---

### Section 7 — Criterion-by-Criterion Analysis

**Heading:** `## 7. Criterion-by-Criterion Analysis`

Required content:
- One sub-section per criterion: `### N. Criterion Name — Score / 10`
- Each sub-section must contain:
  - **What is working** (or **Fit evidence**) — manuscript-specific evidence
  - **What is weakening impact** (or **Gap evidence**) — manuscript-specific evidence
  - **Evidence anchors** — specific chapters, scenes, or passages
  - **Revision queue** (or **Revision target**) — numbered concrete actions

---

### Section 8 — Layer-by-Layer Analysis

**Heading:** `## 8. Layer-by-Layer Analysis`

Required content:
- One sub-section per identified layer.
- Each layer sub-section must contain:
  - Status line
  - What is working
  - What is weakening impact
  - Revision priorities (numbered)
  - Evidence anchors

For **standard_long_form**: layers are thematic/structural (e.g., survival layer, love/search layer). For **multi_layer_long_form**: layers match the Layer & Voice Map from Section 4.

---

### Section 9 — Cross-Layer Integration

**Heading:** `## 9. Cross-Layer Integration`

Required content:
- Named motifs or cross-layer mechanisms (e.g., `### Table tennis`, `### Transition analysis`)
- For **multi_layer_long_form**: must include `### Transition analysis`, `### Echoes and mirrors`, `### Architectural risk`
- For **standard_long_form**: named motifs showing how they serve multiple layers

---

### Section 10 — Symbolic / Doctrine / System Audit

**Heading:** `## 10. Symbolic / Doctrine / System Audit`

Required content:
- A table of symbolic assets / system elements with columns: Symbol/Element, Current function / Role, First appearance, Later obligations, Status
- Integrity questions (at least 4 named questions with answers)
- System audit conclusion paragraph

---

### Section 11 — Reader Experience

**Heading:** `## 11. Reader Experience`

Required content:
- `### Opening section` (first 50 pages or equivalent)
- `### Middle section`
- `### Final section`
- `### Aftertaste`

Each sub-section: dominant reader question, emotional state, primary risk.

---

### Section 12 — Prioritized Revision Plan

**Heading:** `## 12. Prioritized Revision Plan`

Required content:
- Numbered priorities (Priority 1 through Priority N, minimum 5)
- Each priority: `### Priority N — [Name]` with Goal, action list, and Acceptance check
- Must end with a `### Revision sequence` or `### Sequence recommendation` sub-section naming the recommended order of passes

---

### Section 13 — Releasability Assessment

**Heading:** `## 13. Releasability Assessment`

Required content:
- A table with columns: Release dimension, Current status, Verdict
- Must cover: Premise/hook, Opening pages, Central relationship engine, World/environment realism, [manuscript-specific arcs], Manuscript integrity, Final act, Ending image, Market positioning, Publication readiness
- Must end with:
  - `**Recommended status:**` — a DREAM status code (see §DREAM Status Codes)
  - `**Current status:**` — current DREAM status code
  - `**Primary blocker:**` — named blocker or "None"
  - `**Secondary blockers:**` — named blockers or "None"

---

### Section 14 — Acceptance Checks for Repo Benchmark

**Heading:** `## 14. Acceptance Checks for Repo Benchmark`

Required content:
- `### Required detection checks` — checkbox list of things the evaluator must detect about this manuscript
- `### Failure conditions` — bulleted list of conditions that render an evaluation inadequate for this benchmark

---

### Section 15 — Gold-Standard Lessons / Evaluator Calibration Notes

**Heading:** `## 15. Gold-Standard Lessons / Evaluator Calibration Notes`

Required content:
- Numbered list of lessons this manuscript teaches an evaluator
- `### Calibration principle` sub-section — 2–4 sentences stating what makes this manuscript a useful DREAM benchmark and what a shallow vs DREAM-grade evaluation looks like for this specific manuscript

---

### Section 16 — Repo-Ready Summary Block

**Heading:** `## 16. Repo-Ready Summary Block`

Required content (all as bold key: value lines):
- `**Benchmark name:**` — slug form, e.g. `froggin-noggin-dream`
- `**Source:**` — manuscript title and author
- `**Evaluation type:**` — `DREAM long-form full-manuscript benchmark`
- `**Output mode:**` — `standard_long_form` or `multi_layer_long_form`
- `**Overall score:**` — `N / 100`
- `**Readiness score:**` — `N / 100`
- `**Commercial score:**` — `N / 100`
- `**Literary score:**` — `N / 100`
- `**Primary strengths:**` — comma-separated list
- `**Primary blockers:**` — comma-separated list or "None"
- `**Gold-standard requirement:**` — one sentence naming what any evaluator output must detect to pass this benchmark

---

## Canonical 13 Criteria

All 13 criteria must appear in this exact order with these exact names:

| # | Criterion name |
|---|---|
| 1 | Concept & Core Premise |
| 2 | Narrative Drive & Momentum |
| 3 | Character Depth & Psychological Coherence |
| 4 | Point of View & Voice Control |
| 5 | Scene Construction & Function |
| 6 | Dialogue Authenticity & Subtext |
| 7 | Thematic Integration |
| 8 | World-Building & Environmental Logic |
| 9 | Pacing & Structural Balance |
| 10 | Prose Control & Line-Level Craft |
| 11 | Tonal Authority & Consistency |
| 12 | Narrative Closure & Promises Kept |
| 13 | Professional Readiness & Market Positioning |

**Note:** Criteria 12 and 13 are `Narrative Closure & Promises Kept` and `Professional Readiness & Market Positioning`. Any document using `Emotional Resonance & Reader Impact` or `Market Alignment & Positioning` is non-conformant and must be updated.

---

## Multi-Layer Architecture Score Rows

For **multi_layer_long_form** evaluations only, the score grid must append these 4 rows after criterion 13:

| Row | Name |
|---|---|
| 14 | Layer & Mode Integration |
| 15 | Layer Coherence |
| 16 | Doctrine / Symbolic System Integrity |
| 17 | Canon & Continuity Integrity |

These rows do not replace criteria 1–13. They extend the grid for layered manuscripts only.

---

## DREAM Score Dimensions

Every DREAM long-form evaluation must report 4 score dimensions:

| Dimension | Meaning |
|---|---|
| `quality` | Overall narrative and craft quality (0–100) |
| `readiness` | Revision readiness / how close to submission-ready (0–100) |
| `commercial` | Commercial literary fiction publishing shelf readiness (0–100). This is a publishing dimension — it measures fit for the commercial literary fiction market. It is NOT a banned criterion alias. |
| `literary` | Literary control — voice, thematic integration, craft ambition (0–100) |

---

## DREAM Status Codes

Releasability assessment must use one of these status codes:

| Code | Meaning |
|---|---|
| `DREAM_GOLD_STANDARD` | Benchmark-quality output — publication-ready, no blockers |
| `DREAM_BENCHMARK_CANDIDATE_AFTER_FIXES` | Strong manuscript; becomes benchmark after named fixes |
| `DREAM_LONGFORM_EVAL_COMPLETE_WITH_BLOCKERS` | Evaluation complete; manuscript has named blockers |
| `DREAM_LONGFORM_EVAL_COMPLETE` | Evaluation complete; no major blockers |
| `DREAM_LONGFORM_EVAL_INCOMPLETE` | Evaluation incomplete; do not use as benchmark |

---

## Section Count Rule

A conformant DREAM long-form evaluation has exactly **16 sections** (Sections 1–16). An evaluation with fewer sections is incomplete. An evaluation with additional sections beyond 16 must embed the extra content inside an existing section, not add a Section 17 or higher.

The PR body / suggested PR body, if present, belongs inside **Section 16** as a sub-section, not as a standalone section.

---

## Validation Fixtures

The following files are canonical DREAM long-form benchmark fixtures. They must conform to this canon:

| File | Manuscript | Mode |
|---|---|---|
| `docs/benchmarks/froggin-noggin-dream.md` | *Froggin Noggin* by Michael J. Meraw | `multi_layer_long_form` |
| `docs/benchmarks/cartel-babies-dream.md` | *Cartel Babies* by Michael J. Meraw | `multi_layer_long_form` |
| `docs/benchmarks/ancient-bloodlines-longform-layered.md` | *Ancient Bloodlines* by Michael J. Meraw | `multi_layer_long_form` |

---

## Amendment Rule

Changes to this canon require:
- A separate docs-only PR
- A rationale block explaining what changed and why
- No bundled runtime changes
- Companion updates to `DREAM_OUTPUT_LONG_FORM_SPEC.md` and `LONG_FORM_PIPELINE_SUCCESS_CONTRACT.md` in the same release train

---

## CI Enforcement

The canonical section order defined in this document must be enforced by CI. The governance job must verify:

1. All 16 sections present in the correct order in every file under `docs/benchmarks/` that has `dream-state: true` frontmatter
2. All 13 criteria present in the score grid in correct order
3. Correct criterion names for criteria 12 and 13
4. `benchmark-schema: canonical-13-v1` frontmatter present
5. All 4 DREAM score dimensions reported in Section 16
6. A valid DREAM status code in Section 13
