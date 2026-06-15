---
file-role: format-template
note: >
  This is a blank reusable format template for multi-layer / multi-voice long-form evaluations.
  It is not a benchmark evaluation. Current native long-form multi-layer examples are
  governed by docs/benchmarks/DREAM_LONGFORM_BENCHMARK_INDEX.md and the Story Ledger
  answer keys under docs/benchmarks/story-ledger/.
  Moved to templates/ for repo hygiene (was previously at docs/benchmarks/ root,
  which created a false impression of being a duplicate evaluation file).
---

# Manuscript Evaluation Report — Multi-Layer / Multi-Voice Long Form

Designed for structurally complex manuscripts with multiple eras, ontological planes, doctrine systems, voice regimes, canon-bearing paratext, symbolic systems, documentary structures, or other layered architecture. This template extends the global RevisionGrade long-form evaluation and should be used when a standard linear assessment would erase the work's intended architecture.

This is a reusable **format template** for DREAM-style multi-layer benchmark evaluations. It must remain aligned with the canonical long-form multi-layer evaluation template at `docs/templates/evaluation/long-form-multi-layer-evaluation-template.md`.

---

## Purpose

This format does four things:

1. Preserves the stack of the manuscript before evaluating quality.
2. Distinguishes local craft issues from architectural issues.
3. Audits canon, doctrine, relic, symbolic, or continuity systems for stability and payoff.
4. Produces revision guidance that can improve readability without flattening ambition.

---

## Work Metadata

- **Title:** `<manuscript title>`
- **Reference ID:** `<UUID / benchmark id / job id>`
- **Report Type:** `Long-Form Multi-Layer Evaluation`
- **Template mode:** `multi-layer / multi-voice`
- **Scope:** `<chapter / excerpt / full manuscript / cycle>`
- **Coverage statement:** `<what was actually read>`
- **Submitted Word Count / Words analyzed:** `<count>`
- **Estimated Manuscript Pages:** `<XXX>` at 250 words/page
- **Genre:** `<pipeline-diagnosed genre>`
- **Genre Confidence:** `<Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence>`
- **Target Audience:** `<pipeline-diagnosed target audience>`
- **Target Audience Confidence:** `<Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence>`
- **Shelf:** `<pipeline-diagnosed manuscript shelf>`
- **Shelf Confidence:** `<Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence>`
- **Overall Score:** `<XX>/100`
- **Overall Score Confidence:** `<Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence>`
- **Market Readiness:** `<Market Ready / Near Market Ready / Not Market Ready>`
- **Market Readiness Confidence:** `<Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence>`
- **Reading Grade Level:** `<X.X>` (Flesch-Kincaid)
- **Dialogue/Narrative Ratio:** `<XX>%` dialogue / `<XX>%` narrative
- **Evaluation date:** `<YYYY-MM-DD>`
- **Engine build:** `<engine/version or "human">`

### Metadata Rules

- **Genre**, **Target Audience**, **Shelf**, **Overall Score**, and **Market Readiness** are interpretive fields and must carry field-specific confidence labels.
- **Reading Grade Level** and **Dialogue/Narrative Ratio** are deterministic metadata and do not carry confidence labels.
- **Target Audience** identifies the intended reader group.
- **Shelf** identifies the manuscript's professional bookstore/library/market-positioning shelf.
- Do not use one global confidence value as a substitute for field-level confidence.
- Use only the canonical confidence labels listed in this template.

---

## Canonical Confidence Labels

Use these five labels exactly:

1. **Very High Confidence**
2. **High Confidence**
3. **Moderate Confidence**
4. **Low Confidence**
5. **Insufficient Evidence**

Use **Insufficient Evidence** when the sample, coverage, or evidence base does not support a reliable judgment. Do not use legacy labels such as `Mixed`, `Medium`, `Unclear`, or unqualified `High / Moderate / Low` in this template.

---

## Premise

`<1-2 sentence elevator pitch that captures the core dramatic situation: protagonist or central force, primary conflict/tension, layer architecture where relevant, and emotional/tonal register. Suitable for query letters, back-cover copy, or marketing.>`

---

## Content Warnings

`<Bulleted list of content categories requiring reader advisories — e.g., graphic violence, sexual assault, substance abuse, self-harm, animal cruelty, body horror, child endangerment. Only include warnings supported by textual evidence. If none detected, state: "No content warnings identified." Conclude with: "Consider including content warnings in book marketing or front matter.">`

---

## Executive Summary

`<1 short paragraph naming the manuscript's governing ambition, primary emotional anchor, most significant architectural strength, most consequential drag, current Market Readiness, and readiness posture.>`

### Narrative Synthesis Score Cards

For native DREAM / long-form layered reports, keep the four score cards — **Quality**, **Readiness**, **Commercial**, and **Literary** — as a compact **Narrative Synthesis** surface near the top of the report. These cards support scanning and parity across webpage/PDF/DOCX/TXT exports, but they do **not** replace the prose Executive Summary. The Executive Summary must remain a short author-facing paragraph.

---

## Revision Opportunity Summary

- **Total Revision Opportunities:** `<XX>`
- **Recommended:** `<X>`
- **Optional:** `<X>`
- **Consider:** `<X>`

Recommended / Optional / Consider labels indicate author-facing revision posture. Do not imply that the evaluation report applies repairs; repairs belong to Revise Queue.

---

## Structural Stack

### Layer & Voice Map

| Layer | Era / Plane | Dominant voice / mode | Function in book | Primary stakes | Major dependencies | Confidence |
|---|---|---|---|---|---|---|
| `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence>` |
| `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence>` |

### Stack Diagnosis

Address:

- Which layer is the emotional anchor.
- Which layer is the interpretive frame.
- Which layer carries canon or doctrinal obligation.
- Which layer is most fragile.
- Whether the book integrates upward from concrete experience into abstraction, or reverses that flow.
- Whether any layer is decorative rather than structurally necessary.
- Whether evidence coverage is sufficient to support the layer diagnosis.

---

## 13 Criteria Score Grid

Use the canonical 13 story criteria. DREAM / Story Ledger / layer-aware analysis may add architecture surfaces, but it must not replace these criteria.

| Criterion | Score | Confidence | Summary Finding |
|---|---:|---|---|
| Concept & Core Premise | `<x/10>` | `<Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence>` | `<...>` |
| Narrative Drive & Momentum | `<x/10>` | `<Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence>` | `<...>` |
| Character Depth & Psychological Coherence | `<x/10>` | `<Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence>` | `<...>` |
| Point of View & Voice Control | `<x/10>` | `<Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence>` | `<...>` |
| Scene Construction & Function | `<x/10>` | `<Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence>` | `<...>` |
| Dialogue Authenticity & Subtext | `<x/10>` | `<Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence>` | `<...>` |
| Thematic Integration | `<x/10>` | `<Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence>` | `<...>` |
| World-Building & Environmental Logic | `<x/10>` | `<Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence>` | `<...>` |
| Pacing & Structural Balance | `<x/10>` | `<Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence>` | `<...>` |
| Prose Control & Line-Level Craft | `<x/10>` | `<Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence>` | `<...>` |
| Tonal Authority & Consistency | `<x/10>` | `<Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence>` | `<...>` |
| Narrative Closure & Promises Kept | `<x/10>` | `<Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence>` | `<...>` |
| Professional Readiness & Market Positioning | `<x/10>` | `<Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence>` | `<...>` |

Use `Not evaluated — insufficient evidence in sample` where applicable.

---

## Layer-Specific Supplemental Score Surfaces

Use only when the manuscript's architecture requires them. These supplemental surfaces do not replace the canonical 13 criteria.

| Supplemental Surface | Score | Confidence | Summary Finding |
|---|---:|---|---|
| Layer & Mode Integration | `<x/10>` | `<Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence>` | `<...>` |
| Layer Coherence | `<x/10>` | `<Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence>` | `<...>` |
| Doctrine / Glyph System Integrity | `<x/10>` | `<Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence>` | `<...>` |
| Canon & Continuity Integrity | `<x/10>` | `<Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence>` | `<...>` |
| Symbol / Object Lifecycle Integrity | `<x/10>` | `<Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence>` | `<...>` |
| Evidence Distribution Integrity | `<x/10>` | `<Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence>` | `<...>` |

---

## Criterion Rationales & Surfaced Opportunities

For each criterion, provide a compact rationale and up to three surfaced opportunities.

Each surfaced opportunity should use this diagnostic structure where evidence supports it:

1. **Evidence:** `<where in the manuscript or layer the issue appears>`
2. **Symptom:** `<observable problem or underperformance>`
3. **Cause:** `<mechanism producing the symptom>`
4. **Fix Direction:** `<bounded repair direction>`
5. **Reader Effect:** `<what changes for the reader if repaired>`
6. **Mistake-Proofing:** `<what must not be damaged during repair>`

---

## Layer-by-Layer Analysis

Repeat the following block for each major layer.

### `<Layer name>`

**Function in the Whole**

`<What this layer is doing narratively, emotionally, philosophically, structurally, or canonically.>`

**What Is Working**

- `<Specific strength>`
- `<Specific strength>`
- `<Specific strength>`

**What Is Weakening Impact**

- `<Specific drag>`
- `<Specific drag>`
- `<Specific drag>`

**Revision Priorities for This Layer**

- `<Targeted revision>`
- `<Targeted revision>`

**Evidence Anchors**

- `<Chapter / scene / motif / object / symbol>`
- `<Chapter / scene / motif / object / symbol>`

**Layer Confidence**

`<Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence>` — `<brief evidence-limitation explanation, if any>`

---

## Cross-Layer Integration

### Transition Analysis

Assess the handoff quality between the major layers. Name where transitions are:

- earned and cumulative;
- intentionally destabilizing but productive;
- or confusing in a way that degrades reading experience.

### Echoes and Mirrors

Identify repeated objects, vows, motifs, wounds, relics, phrases, gestures, laws, or structures that allow one layer to illuminate another.

### Architectural Risk

Explain where the manuscript risks splitting into separate books, and what specific connective tissue would solve that.

---

## Canon, Doctrine, and Symbolic System Audit

Use this section when the work contains scripture, glyph systems, relic catalogs, canon appendix material, symbolic law, or explicit metaphysical law.

### System Inventory

| System Element | Role | First Major Appearance | Later Obligations | Status | Confidence |
|---|---|---|---|---|---|
| `<relic / glyph / law / scripture>` | `<...>` | `<...>` | `<...>` | `<stable / drifting / underused / contradictory>` | `<Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence>` |
| `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence>` |

### Integrity Questions

Address each directly:

- Does the symbolic system change character decisions or only explain them after the fact?
- Do relics / glyphs maintain stable identity and consequence?
- Does doctrine illuminate the emotional core, or compete with it?
- Does late metaphysical resolution pay off early embodied conflict?
- Are any canon-bearing sections overbuilt relative to their payoff?
- Is confidence limited by missing chapters, incomplete sampling, or unclear evidence distribution?

---

## Story Ledger / Architecture Map

When included, summarize the manuscript's major operating layers in readable editorial language.

The map should answer:

1. **What architecture is present?**
2. **How does that architecture affect reader experience?**
3. **Where does the architecture strengthen or weaken the manuscript's readiness?**

Do not turn this section into a raw artifact dump. Keep it selective, legible, and tied to evaluation.

---

## Reader Experience

### What a Strong Reader Is Likely to Feel

`<Describe the intended high-end reading experience if the manuscript lands.>`

### What an Average Reader May Struggle With

`<Describe where comprehension, trust, or emotional continuity may weaken.>`

### What Should Not Be Simplified Away in Revision

- `<Ambitious feature worth preserving>`
- `<Ambitious feature worth preserving>`
- `<Ambitious feature worth preserving>`

---

## Revision Plan

### Top 5 Actions

1. `<Most important architectural revision>` — `<why it matters first>`.
2. `<Second revision>` — `<why now>`.
3. `<Third revision>` — `<reader / narrative effect>`.
4. `<Fourth revision>` — `<reader / narrative effect>`.
5. `<Fifth revision>` — `<reader / narrative effect>`.

### Sequence Recommendation

`<Explain the order of operations: e.g., fix stack and transitions first, then canon continuity, then local line edits.>`

---

## Acceptance Checks

Before calling the manuscript substantially improved, confirm:

- The layer map is still necessary and still legible.
- The emotional anchor remains vivid after architectural cleanup.
- Doctrine / glyph / relic material affects the lived story.
- At least one late metaphysical payoff clearly answers an early concrete wound.
- The manuscript feels like one designed organism rather than adjacent lore systems.
- Genre, Target Audience, Shelf, Overall Score, and Market Readiness have field-specific confidence labels.
- Any unsupported or evidence-limited judgment is marked with **Insufficient Evidence** or a lower confidence label.

---

## Evaluator Guardrails

- Do not punish a work simply for containing multiple planes or voice regimes.
- Do not reward complexity merely for existing; test whether it integrates.
- Separate "hard to read because ambitious" from "hard to read because underconnected."
- Name uncertainty instead of hallucinating total coherence.
- Preserve the manuscript's strange, mythic, or layered ambitions when proposing revisions.
- Do not expose protected pipeline, gate, reducer, raw artifact, or execution terminology in author-facing prose.
- Do not collapse **Target Audience** and **Shelf** into one field.
- Do not use legacy confidence labels.
