# Phase E1 Paused: Nomenclature Canon Violation Detected

**Status:** Phase E1 execution halted during pre-flight  
**Discovery:** 2026-02-09  
**Severity:** Governance violation (not cosmetic)  
**Root Cause:** Runtime-reachable code uses banned criterion-key aliases

---

## What Happened

During Phase E1 local pre-flight (build path from tag `v1.0.1-rrs-100`), TypeScript compilation failed due to invalid criterion keys in `lib/evaluation/processor.ts` mock evaluation output.

**Banned aliases found:**
- `plot` (should be `narrativeDrive`)
- `structure` (should be `sceneConstruction`)
- `stakes` (not a canonical key; concept should fold into `narrativeDrive` rationale)
- `clarity` (not a canonical key; concept should fold into `proseControl` rationale)
- `craft` (should be `proseControl`)

These are **explicitly banned aliases** under `NOMENCLATURE_CANON_v1` (see `docs/NOMENCLATURE_CANON_v1.md` §3.1).

**Additional discovery:** The OpenAI prompt in `generateAIEvaluation()` instructs the model to use these same banned aliases, meaning production AI output would also violate the canon.

---

## Why This Is a Governance Violation

Nomenclature canon violations are **not cosmetic issues**. They:

1. **Break trust signals**: Non-canonical keys invalidate downstream reproducibility and audit trails
2. **Violate Phase C contracts**: Criterion keys are API-stable identifiers, not display text
3. **Compromise operational observations**: Phase E1 would be observing a non-compliant system

Mocks, tests, fixtures, and AI prompts **all count** as runtime-reachable code.

If Phase E1 had continued, we would be certifying a system that already violates its own language law.

**Stopping here is correct, professional, and demonstrates governance enforcement working as designed.**

---

## Required Remediation

### Epic: Nomenclature Canon v1 — Criterion Keys Compliance

**Goal:** Eliminate banned criterion-key aliases anywhere they are used as identifiers (mocks, fixtures, tests, AI prompts, payloads). Make regression mechanically impossible via canon audit hardening.

**Definition of Done:**
- No banned aliases appear as criterion identifiers anywhere in repo
- Canon audit fails CI if banned aliases appear in identifier contexts
- Phase E1 can proceed with confidence that observed behavior is canon-compliant

---

### Child Tickets

#### T1: Detect banned criterion-key aliases in identifier contexts

**Scope:** app code, lib/, processors, mocks, fixtures, tests, sample payloads, seed data, AI prompts

**Banned aliases to detect:**
- `plot`
- `structure`
- `craft`
- `stakes`
- `clarity`

**Acceptance:**
- Report lists each file + line for every match (identifier contexts only)
- False positives minimized (don't block prose/markdown unless clearly a key)

**Search commands:**
```bash
# Tight search: JSON/TS object key contexts
rg -n --hidden --no-ignore-vcs \
  '(^|\s|[{,])\s*("?(plot|structure|craft|stakes|clarity)"?)\s*:' \
  .

# Broader mention search (manual review)
rg -n --hidden --no-ignore-vcs \
  '\b(plot|structure|craft|stakes|clarity)\b' \
  app lib src tests processors fixtures mocks
```

---

#### T2: Replace banned aliases with canonical criterion keys

**Mapping:**
- `plot` → `narrativeDrive`
- `structure` → `sceneConstruction`
- `craft` → `proseControl`
- `stakes` → **remove as key**; fold concept into `narrativeDrive` rationale text
- `clarity` → **remove as key**; fold concept into `proseControl` rationale text

**Critical fix locations:**

1. **lib/evaluation/processor.ts:**
   - Mock evaluation: already fixed in stash (13 canonical keys)
   - OpenAI prompt: must specify canonical 13 keys (see patch below)

2. **AI prompt canonicalization:**
   
   Replace this line in `generateAIEvaluation()` user prompt:
   ```
   4. Scores (0-10) and rationale for all 13 criteria: concept, plot, character, dialogue, voice, pacing, structure, theme, worldbuilding, stakes, clarity, marketability, craft
   ```
   
   With canonical keys:
   ```
   4. Scores (0-10) and rationale for all 13 canonical criteria: concept, narrativeDrive, character, voice, sceneConstruction, dialogue, theme, worldbuilding, pacing, proseControl, tone, narrativeClosure, marketability
   ```

**Acceptance:**
- All identifier occurrences fixed
- No new criterion keys introduced
- Tests/mocks updated accordingly
- AI prompts use canonical keys only

---

#### T3: Enforce fail-closed canon audit on banned criterion aliases

**Mechanism:**

1. **Runtime validation before persistence** (immediate fix for processor.ts):
   
   After constructing `result: EvaluationResultV1`, add validation gate:
   ```typescript
   import { validateEvaluationResult } from "@/schemas/evaluation-result-v1";

   const v = validateEvaluationResult(result);
   if (!v.valid) {
     console.error("[Processor] AI result failed schema validation:", v.errors);
     return generateMockEvaluation(manuscript, job); // fallback to canonical mock
   }
   ```

2. **Extend canon audit** (scripts/validateNomenclature.ts or equivalent):
   - Treat banned aliases as hard errors when appearing in:
     - Mocks
     - Fixtures
     - Stored results
     - API payloads
     - AI prompts
   - Fail CI if any are detected

**Acceptance:**
- CI fails if a banned alias is reintroduced as a criterion key
- Local canon-audit path catches it too
- Regression becomes mechanically impossible

---

## Canonical 13 Criterion Keys (Reference)

**Source:** `schemas/criteria-keys.ts` → `CRITERIA_KEYS` (immutable array)

1. `concept` — Concept & Core Premise
2. `narrativeDrive` — Narrative Drive & Momentum
3. `character` — Character Depth & Psychological Coherence
4. `voice` — Point of View & Voice Control
5. `sceneConstruction` — Scene Construction & Function
6. `dialogue` — Dialogue Authenticity & Subtext
7. `theme` — Thematic Integration
8. `worldbuilding` — World-Building & Environmental Logic
9. `pacing` — Pacing & Structural Balance
10. `proseControl` — Prose Control & Line-Level Craft
11. `tone` — Tonal Authority & Consistency
12. `narrativeClosure` — Narrative Closure & Promises Kept
13. `marketability` — Professional Readiness & Market Positioning

**Invalid aliases (banned as keys):**

| Canonical key | Banned aliases | Note |
|---|---|---|
| `narrativeDrive` | plot, stakes, momentum | Ingredients vs. overall propulsion |
| `sceneConstruction` | structure, beats, threeAct | Scene-level structure |
| `proseControl` | craft, clarity, style, lineQuality | Line-level execution only |

---

## When Phase E1 Resumes

**Only after:**

1. Governance Epic completed (T1, T2, T3 all done)
2. `canon-audit.sh` passes cleanly
3. Local build at `v1.0.1-rrs-100` produces only canonical criterion keys

**Then:**
- Rerun Phase E1 from top of `ops/PHASE_E1_SMOKE_CHECK_CARD.md`
- Log observed results in `ops/PHASE_E_DAY1_LOG.md`

---

## Why This Discovery Is a Strength

Phase E1 pre-flight caught a governance violation **before** live execution.

This proves:
- The nomenclature canon has teeth
- Governance enforcement works even during ops
- The system can self-correct when it catches drift

**Pausing Phase E1 to fix this is the correct, professional move.**

---

**Next Action:** Create GitHub Epic with T1–T3 tickets, execute sweep, then resume Phase E1.
