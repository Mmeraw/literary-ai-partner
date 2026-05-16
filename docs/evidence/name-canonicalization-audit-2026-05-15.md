# Name Canonicalization Audit — Mmeraw/literary-ai-partner

**Date:** 2026-05-15
**Base commit:** `ca14ac0` (origin/main)
**Source of truth:** `schemas/criteria-keys.ts` (Canon v1.1.0)

## TL;DR

**Live evaluation code is already canonical.** It imports `CRITERIA_KEYS` / `CRITERIA_METADATA` / `getCriterionDisplayLabel` from `schemas/criteria-keys.ts`. Zero hardcoded canonical label strings in `lib/`, `app/`, or `components/`. Pass 1, Pass 2, Pass 3, and Pass 4 prompts all build their criterion blocks from `CRITERIA_KEYS`. Pass 4 disputes use machine-stable keys, not labels — **no labelling drift can cause Pass 4 false-dispute on its own.**

The drift is concentrated in **four well-bounded zones**, all of which are *non-runtime* artifacts (legacy export, docs, fixtures, one-off scripts):

| # | Zone | Risk | Action |
|---|---|---|---|
| 1 | `base44/` legacy platform export | None (not imported) | Mark frozen via README; leave content as-is |
| 2 | `docs/benchmarks/ancient-bloodlines-*` + `docs/evaluation-reference/` | Low (reference only) | Mark frozen; new benchmarks must use canonical |
| 3 | `testdata/evaluation/ancient-bloodlines.shortform.model.json` + its companion specs | Medium — used by 2 test files | Add a canonical-key mapping table OR re-emit fixture with canonical keys |
| 4 | `scripts/eval-chapter10b.ts` | Low (dev-only utility) | Replace local label map with `CRITERIA_METADATA[key].label` |

There is **one drift-class that should become a CI guard**: any new file under `lib/`, `app/`, `components/`, `schemas/`, or `prompts/` that hard-codes a criterion label string. We can add a lint test that fails the build if a non-canonical label appears outside the source-of-truth file.

---

## 1. Canonical source of truth

`schemas/criteria-keys.ts` (Canon v1.1.0, MDM Compatibility v1):

| Key | Canonical Label |
|---|---|
| `concept` | Concept & Core Premise |
| `narrativeDrive` | Narrative Drive & Momentum |
| `character` | Character Depth & Psychological Coherence |
| `voice` | Point of View & Voice Control |
| `sceneConstruction` | Scene Construction & Function |
| `dialogue` | Dialogue Authenticity & Subtext |
| `theme` | Thematic Integration |
| `worldbuilding` | World-Building & Environmental Logic |
| `pacing` | Pacing & Structural Balance |
| `proseControl` | Prose Control & Line-Level Craft |
| `tone` | Tonal Authority & Consistency |
| `narrativeClosure` | Narrative Closure & Promises Kept |
| `marketability` | Professional Readiness & Market Positioning |

Scope variant: `narrativeClosure` displays as **"Chapter Closure & Promise Integrity"** when scope is `chapter` or `excerpt` (via `getCriterionDisplayLabel`).

---

## 2. Live code consumes the registry correctly

**Files importing `CRITERIA_KEYS` (key-based, runtime-critical):**
- `lib/evaluation/pipeline/runPipeline.ts`
- `lib/evaluation/pipeline/runPass1.ts`, `runPass2.ts`, `runPass3Synthesis.ts`
- `lib/evaluation/pipeline/perplexityCrossCheck.ts`
- `lib/evaluation/pipeline/qualityGate.ts`
- `lib/evaluation/pipeline/comparisonPacket.ts`
- `lib/evaluation/pipeline/buildScoreLedger.ts`
- `lib/evaluation/pipeline/validateEvaluationArtifact.ts`
- `lib/evaluation/pipeline/prompts/pass1-craft.ts`, `pass2-editorial.ts`, `pass3-synthesis.ts`
- `lib/evaluation/processor.ts`
- `lib/evaluation/fullManuscript.ts`
- `lib/evaluation/signal/manuscriptClaimPolicy.ts`
- `lib/evaluation/validateEvaluationArtifact.ts`
- `lib/llm/client.ts`
- `lib/jobs/invariants.ts`, `lib/jobs/finalize.ts`
- `lib/governance/lessonsLearned/ACTIVE_RULES.ts`
- `app/evaluate/[jobId]/page.tsx`
- `schemas/evaluation-result-v1.ts`, `schemas/evaluation-result-v2.ts`
- (plus test files under `__tests__/`)

**Files importing `CRITERIA_METADATA` / `getCriterionDisplayLabel` (display-side):**
- `schemas/criteria-keys.ts` (self)
- `app/evaluate/[jobId]/page.tsx` ← **the only display-side import**

**Hardcoded canonical label strings in `lib/`, `app/`, `components/`:** *zero*

**Hardcoded criterion label strings in Pass 1/2/3 prompts:** zero matches.
`pass3-synthesis.ts` mentions "Prose Control" twice but as descriptive prose ("Prose Control certification hard rule"), not as a label assignment — acceptable.

**Pass 4 (Perplexity cross-check)** builds its criteria block from `CRITERIA_KEYS` as `${key}: ${score}/10` — keys only, no labels. **Label drift cannot cause Pass 4 false-disputes.**

---

## 3. Drift inventory

### Zone 1 — `base44/` (legacy platform export)

This is the old Base44 platform export, archived in-repo and **not imported by any code in `lib/`, `app/`, or `components/`** (verified by grep). It uses an entirely different naming system:

- `"Concept & Premise"` (vs canonical `"Concept & Core Premise"`)
- `"Thematic Resonance"` (vs canonical `"Thematic Integration"`)
- `"Narrative Drive"`, `"Character Depth"`, `"POV & Voice"`, `"Scene Function"`, `"Dialogue & Subtext"`, `"Theme"`, `"World-Building"`, `"Pacing & Structure"`, `"Prose Craft"`, `"Tone"`, `"Narrative Closure"`, `"Professional Readiness"`

**Affected files (sample):**
- `base44/functions/evaluateThirteenCriteria/entry.ts`
- `base44/functions/EXECUTABLE_FUNCTION_INVENTORY.md/entry.ts`
- `base44/functions/13_STORY_CRITERIA.md/entry.ts`
- `base44/functions/evaluateFullManuscript/entry.ts`
- `base44/functions/evaluateQuickSubmission/entry.ts`
- `base44/functions/storeEvaluationSignals/entry.ts`
- `base44/functions/generateBenchmarkComparison/entry.ts`
- `base44/functions/tests/integrityGate.v1/entry.ts`
- `base44/functions/tests/integrityGate.huhu.golden.test/entry.ts`
- `base44/functions/GOVERNANCE_CODE_EXTRACT/entry.ts`
- `base44/functions/WAVE_TEST_CASES.json/entry.ts`
- `base44/functions/12_STORY_CRITERIA.md/entry.ts`

**Recommendation:** Add `base44/README.md` declaring the directory frozen and excluded from canon. Optionally add a `.gitattributes` entry to mark these files as `linguist-vendored`. **Do not touch contents** — they are a historical artifact.

### Zone 2 — `docs/benchmarks/ancient-bloodlines-*` + `docs/evaluation-reference/`

These markdown files use mixed naming. Example: `docs/benchmarks/ancient-bloodlines-shortform-model.md`:

| Drifted | Canonical |
|---|---|
| `"Character Depth & Psychology"` | `"Character Depth & Psychological Coherence"` |
| `"POV, Voice & Tone"` | `"Point of View & Voice Control"` |
| `"Theme / Intelligence"` | `"Thematic Integration"` |
| `"World-Building & Logic"` | `"World-Building & Environmental Logic"` |

**Affected files:**
- `docs/benchmarks/ancient-bloodlines-shortform-model.md`
- `docs/benchmarks/ancient-bloodlines-longform-layered.md`
- `docs/benchmarks/ancient-bloodlines-longform-layered-template.md`
- `docs/evaluation-reference/ancient-bloodlines-v1-corrected-evaluation.md`

**Recommendation:** Add YAML front-matter `benchmark-schema: legacy-shortlabels-v0` to each. The PR C smoke test (already opt-in via `benchmark-schema: canonical-13-v1`) ignores these; they remain valid historical references.

### Zone 3 — Test fixtures

**`testdata/evaluation/ancient-bloodlines.shortform.model.json`** carries both:
- **Drifted** `criterionKey` values: `concept_core_premise`, `character_depth_psychology`, `pov_voice_tone`, `scene_construction_function`, `dialogue_subtext`, `theme_intelligence`, `world_building_logic`, `prose_line_level`, `pacing_structural_balance`, `narrative_closure_promises`, `professional_readiness_market`
- **Drifted** `criterionName` values: `"Character Depth & Psychology"`, `"POV, Voice & Tone"`, `"Theme / Intelligence"`, `"World-Building & Logic"`, `"Prose / Line-Level Craft"`, `"Narrative Closure & Promises"`, `"Professional Readiness / Market"`, `"Dialogue & Subtext"`

**Consumers (live test files):**
- `tests/evaluation/benchmarks/ancient-bloodlines.shortform.spec.ts`
- `tests/evaluation/benchmarks/ancient-bloodlines.fixture.spec.ts`

These specs lookup by their snake_case `criterionKey` — they are self-consistent within the legacy fixture but they DO NOT validate against `CRITERIA_KEYS` / `CRITERIA_METADATA`.

**Recommendation (medium-priority):** Add a `legacyToCanonical` map in the fixture (or its spec) so both naming systems coexist without confusion. Long-term: re-emit the fixture using canonical `concept` / `narrativeDrive` / etc. keys and canonical labels — but this is a behavioral change for the existing tests and should be a separate PR.

### Zone 4 — `scripts/eval-chapter10b.ts`

Dev-only manual eval runner. Lines 128–142 hardcode a local label map:

```typescript
const criteriaLabels: Record<string, string> = {
  concept:          "Concept & Premise",        // ← drift
  narrativeDrive:   "Narrative Drive",          // ← short
  character:        "Character",                // ← short
  voice:            "Voice",                    // ← short
  ...
  tone:             "Tonal Authority",          // ← short
  ...
};
```

**Recommendation:** Replace the entire local map with:

```typescript
import { CRITERIA_KEYS, CRITERIA_METADATA } from "@/schemas/criteria-keys";

for (const key of CRITERIA_KEYS) {
  const label = CRITERIA_METADATA[key].label;
  const c = criteriaMap[key];
  // ...
}
```

This is a 10-line code change with no behavioral impact (output strings change in console only).

---

## 4. Drift-prevention guard (proposed)

Add an opt-in CI test, e.g. `tests/governance/no-hardcoded-criteria-labels.test.ts`:

- Walks `lib/`, `app/`, `components/`, `prompts/` (and `schemas/` except `criteria-keys.ts`).
- Greps for each canonical label string and any known short-label drift variant.
- Fails if any match is found outside `criteria-keys.ts`.
- Allow-list: `docs/`, `base44/`, `archive/`, `testdata/` (fixtures), `scripts/eval-chapter10b.ts` after we fix it.

This makes the registry an enforced single source of truth.

---

## 5. Recommended PR sequence (precedes PR C)

**PR Z — Name canonicalization hygiene** (small, low-risk):
1. Fix `scripts/eval-chapter10b.ts` to use `CRITERIA_METADATA`.
2. Add `base44/README.md` declaring the directory frozen / not canonical.
3. Add front-matter `benchmark-schema: legacy-shortlabels-v0` to the four legacy benchmark markdown files in `docs/benchmarks/` and `docs/evaluation-reference/`.
4. Add `tests/governance/no-hardcoded-criteria-labels.test.ts` (drift guard).
5. Update `docs/benchmarks/README.md` (when added in PR C) to require `benchmark-schema: canonical-13-v1` on all new benchmarks.

**Then PR C** (Froggin Noggin gold standard + smoke test) — additionally enforce that benchmark `Score Table` column names match `CRITERIA_METADATA[key].label` exactly. This converts PR C from "shape smoke test" into "true canonical-drift guard" for benchmarks.

**Then PR A** (Pass 4 governance honors severity + mode) — unchanged.

**Then PR B** (Pass 1 detectedSignals/doctrineTrace minItems:1 for theme/worldbuilding/concept) — unchanged.

---

## 6. What is NOT changing

- `schemas/criteria-keys.ts` — already correct.
- All Pass 1/2/3/4 prompts — already key-driven.
- Database schema — no changes.
- Env vars — no changes.
- `DISPUTE_THRESHOLD` — no changes.
- Production behavior — no changes.
