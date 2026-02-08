# MDM Work Type Canon v1

**Authority:** Governance Binding  
**Status:** LOCKED  
**Effective Date:** 2026-01-04  
**Last Updated:** 2026-02-08

---

## Executive Summary

Work Type is a small, governed registry of structural forms (prose, scenes, scripts, submission materials). The system detects and proposes a Work Type; the user confirms or corrects it. That confirmed value becomes the authoritative routing key for criteria applicability (required vs N/A), preventing misrouting and dirty data without expanding scope or violating Design Freeze.

**This is the line between "confident AI" and "governed evaluation system."**

---

## Part 1: What This Canon Defines

This document defines:

1. **Invariants** — Non-negotiable system laws
2. **Controls** — Named governance guardrails  
3. **Enforcement Semantics** — What R/O/NA/C mean in practice
4. **Acceptance Fixtures** — Proof criteria are applied correctly per Work Type

This is **binding governance**, not guidance. Any implementation that deviates must fail fast and alert (Sentry).

---

## Part 2: Invariants (Binding System Laws)

### Invariant MDM-01: Full Coverage is Mandatory

**Statement:**  
Every Work Type must define every canonical criterion key.  
Partial criteria maps are invalid and must fail validation at load time.

**Why This Matters:**  
Gaps in the matrix are silent routing errors. If personalEssayReflection omits `dialogue`, the system cannot safely determine whether to score it or forbid it.

**Operational Consequence:**  
- If Base44 adds a Work Type and omits even one criterion:
  - App startup fails (or feature-flagged off)
  - Sentry error raised
  - No evaluation may run

**Verification:**  
Runtime validator must check before any evaluation:

```
For each workType in criteria_plan:
  if Object.keys(workType.criteria) !== 13 canonical IDs:
    → HARD ERROR + Sentry
```

---

### Invariant MDM-02: Family is a First-Class Analytic & Governance Dimension

**Statement:**  
Family (e.g., prose_nonfiction, script_scene) is governed and used for analytics, calibration, defaults, and UX hints—but never for silent routing.

**Approved Families (v1):**
- `prose_nonfiction`
- `prose_fiction`
- `prose_scene`
- `script_scene`
- `screenplay_feature`
- `tv_pilot`
- `tv_episode`
- `stage_play`
- `submission_materials`
- `hybrid_other`

**What Family May Be Used For:**
- Analytics dashboards (e.g., "average score by family")
- Calibration studies (agent rejection vs family)
- UI hints (e.g., "Most prose_nonfiction pieces use Essay or Memoir Vignette")
- Default Evaluation Mode suggestions (never automatic selection)

**What Family May NOT Be Used For:**
- Silent routing
- Criteria overrides
- Skipping user confirmation

**Why This Matters:**  
Family is semantically valuable but governance-neutral. It cannot substitute for explicit Work Type confirmation.

---

## Part 3: Named Controls (Hard Prohibitions)

### Control RG-NA-001: Dirty-Data Kill Switch

**Name:** RG-NA-001  
**Purpose:** Structurally forbid scoring/penalizing when criteria do not apply

**Statement:**  
If a criterion is marked **NA** for a Work Type, the system is forbidden to:

- Score it
- Penalize it
- Flag it as missing
- Include it in readiness blocking
- Include it in priority revision lists
- Generate any mention of it in feedback, agentSnapshot, or guidance

**Why This Matters:**  
This is the core protection that prevents essays from being rejected for "lacking dialogue," scripts from being penalized for "weak prose polish," etc.

**Enforcement Points:**  
1. **LLM Input Gate:** LLM receives only applicable criteria (R/O); NA criteria are omitted from the prompt entirely
2. **Output Gate:** After parsing LLM response, deterministic NA scrub removes any mention keyed to NA criterion_id
3. **Audit Trail:** Every evaluation stores `criteria_plan` with per-criterion status, so absence of NA scores is verifiable

**Operational Consequence:**  
If any NA criterion produces a score, penalty, or revision directive in any form:
- Governance is violated
- Evaluation run is marked INVALID
- Sentry alert raised
- User sees: "Internal governance error. Evaluation blocked."

---

## Part 4: Semantics (What R/O/NA/C Mean)

Each criterion per Work Type is marked with exactly ONE status:

| Status | Meaning | Scoring | Blocking | Revision Directives |
|--------|---------|---------|----------|-------------------|
| **R** | Required | ✅ Scored, contributes to readiness | ✅ May block | ✅ May suggest |
| **O** | Optional / Informational | ✅ Scored lightly or noted | ❌ Never blocks | ⚠️ Soft language only |
| **NA** | Not Applicable | ❌ Never | ❌ Never | ❌ Never |
| **C** | Constrained | ⚠️ Special rules | ⚠️ Special rules | ⚠️ No invention pressure |

### NA (Not Applicable) — Hard Prohibition

**Definition:**  
The criterion is structurally irrelevant for this Work Type and must never influence scoring, penalties, or feedback.

**Examples:**
- `dialogue` = NA for `personalEssayReflection` → no "add dialogue" directives
- `linePolish` = NA for `scriptSceneFilmTv` → no prose-style polish nags
- `technical` = NA for `novelChapter` → no formatting penalties

**Forbidden Behaviors Under NA:**
- ❌ Generating a score
- ❌ Including in total score
- ❌ Penalizing for "missing"
- ❌ Appearing in agentSnapshot as a risk or leverage point
- ❌ Surfacing in Priority Revision Requests
- ❌ Triggering readiness blockers
- ❌ Implicit mention ("add more plot" when conflict is NA)

### O (Optional) — Soft Signal

**Definition:**  
The criterion may be scored and commented on, but never as a requirement or readiness blocker.

**Forbidden Behaviors Under O:**
- ❌ "This is missing" language
- ❌ Readiness reduction
- ❌ "Must add" or "should add" directives

**Allowed:**
- ✅ Commentary and nuance
- ✅ Soft suggestions ("You might consider…")
- ✅ Scoring for information only

### R (Required) — Full Assessment

**Definition:**  
The criterion must be evaluated and scored. Results may affect readiness.

**Allowed:**
- ✅ Full scoring and assessment
- ✅ "Missing" or "weak" language
- ✅ Readiness blocking (per readiness rules)
- ✅ Priority revision directives

### C (Constrained) — Special Rules

**Definition:**  
The criterion is evaluated under special rules (e.g., safety, form limits) and must never pressure invention.

**Forbidden:**
- ❌ "Create new scenes/characters/drama"
- ❌ Structural rewrite mandates
- ❌ Content invention pressure

**Allowed:**
- ✅ Tighten/clarify language
- ✅ Reframe within existing structure
- ✅ Optional structural opt-in (explicit user choice)

---

## Part 5: Acceptance Fixtures (Proof of Behavior)

The system must prove it enforces R/O/NA/C correctly. Two fixtures demonstrate protection AND signal.

### Fixture A: Birthday Essay (Personal Essay / Reflection)

**Text:**  
The 60th birthday reflection ("I've never considered my birthday as a day worth celebrating…")

**Work Type:**  
`personalEssayReflection`

**Expected Criteria Plan:**
- `dialogue` = NA
- `conflict` = NA
- `worldbuilding` = NA
- `hook` = R
- `voice` = R
- `linePolish` = R
- `stakes` = R
- (others per matrix)

**Assertions (Must All Pass):**

**Protection (No NA Penalties):**
- ✅ No score for `dialogue`
- ✅ No "add dialogue" revision request
- ✅ No "reveal character through dialogue" suggestion
- ✅ No score for `conflict`
- ✅ No "increase stakes/tension/conflict" directive
- ✅ No "add external conflict" suggestion
- ✅ No score for `worldbuilding`
- ✅ No "add sensory details/immersion" based on worldbuilding

**Signal (At Least One R Fires):**
- ✅ `hook` produces a score or evidence
- ✅ `voice` produces a score or evidence
- ✅ `linePolish` produces a score or evidence (e.g., cliché flags, specificity suggestions)

**Negative Signal (No Invention Pressure):**
- ✅ No "add a scene where…" suggestion
- ✅ No "introduce dialogue between characters" directive
- ✅ No "create an external antagonist" mandate

**WAVE Items Allowed:**
- ✅ Cliché reduction ("psychological poison" → specific emotion)
- ✅ Filter verb reduction ("I see that…")
- ✅ Specificity upgrades (abstractions → concrete details)
- ✅ Line-level polish

---

### Fixture B: Script Scene (Film/TV)

**Text:**  
A formatted script scene with sluglines, action lines, dialogue, parentheticals (e.g., INT. COFFEE SHOP - DAY)

**Work Type:**  
`scriptSceneFilmTv`

**Expected Criteria Plan:**
- `linePolish` = NA
- `marketFit` = NA
- `dialogue` = R
- `technical` = R
- `pacing` = R (beat density)
- (others per matrix)

**Assertions (Must All Pass):**

**Protection (No NA Penalties):**
- ✅ No score for `linePolish`
- ✅ No "vary sentence length" or "tighten paragraph rhythm" prose nags
- ✅ No "polish the prose" suggestions
- ✅ No score for `marketFit`
- ✅ No "this won't sell" commentary

**Signal (At Least One R Fires):**
- ✅ `dialogue` produces a score or evidence
- ✅ `technical` produces a score or evidence (format, slugline, action line structure)
- ✅ `pacing` produces a score on beat density / momentum

**Negative Signal (No Prose-Style Creep):**
- ✅ No "improve narrative voice" directive
- ✅ No "lyrical flow" suggestions
- ✅ No "prose style" commentary

---

## Part 6: Enforcement Rules (What Code Must Do)

### Load-Time Validation (Fail-Fast)

On app startup or master-data load:

```
□ matrixVersion present
□ criteriaCatalog IDs are unique and fixed (13 canonical)
□ For each Work Type:
  □ has id, label, family
  □ defines all 13 criteria keys (full coverage, Invariant MDM-01)
  □ uses only R | O | NA | C (no other values)
  □ family ∈ approved family list (Invariant MDM-02)
□ All three criteria_plan.json schema validations pass
```

**If any check fails:**
- → Hard error (app doesn't start or evaluation is blocked)
- → Sentry alert with details
- → User sees: "Internal governance error. Please contact support."

### Evaluation-Time Validation (Fail-Closed)

Before evaluation runs:

```
□ detectedWorkType recorded
□ finalWorkTypeUsed exists (user confirmed or overridden)
□ matrixVersion recorded
□ criteriaPlan built exclusively from matrix
  □ No defaults
  □ No fallback logic
```

**If finalWorkTypeUsed is missing:**
- → Evaluation blocked
- → User required to confirm/correct Work Type

### NA Enforcement (Structural, Not Advisory)

For any criterion marked NA in `criteriaPlan`:

```
□ score = null (never scored)
□ excluded from total score
□ excluded from "missing" checks
□ excluded from readiness blockers
□ excluded from priority revision requests
□ excluded from agentSnapshot biggest_risk / most_leverage_fix
□ no WAVE flag triggered by "missing [criterion]"
```

**Implementation:**
1. LLM receives only R/O criteria in prompt (NA criteria omitted entirely)
2. After LLM output parsing, deterministic NA Output Gate scrubs any mention keyed to NA criterion_id
3. agentSnapshot is either:
   - Built only from R/O criterion IDs (preferred), or
   - Disabled entirely for Work Types where core drivers are NA (acceptable)

---

## Part 7: Audit & Traceability (Investor-Grade Evidence)

Every evaluation run must store:

- `detectedWorkType` — What the system proposed
- `detectionConfidence` — low / medium / high
- `userAction` — confirm | override
- `userProvidedWorkType` — If user overrode, what they selected
- `finalWorkTypeUsed` — The authoritative routing key for this run
- `matrixVersion` — Which matrix version was used (e.g., v1)
- `criteriaPlan` — Complete per-criterion status and scores:
  - `criterion_id`
  - `status` (R/O/NA/C)
  - `score` (or null if NA)
  - `evidence` / `notes` (as available)

**Why This Matters:**  
Six months later, you can answer:
- "Why was dialogue not scored?" → `criteria_plan['dialogue'].status = 'NA'`
- "How do we know NA was enforced?" → `criteria_plan['dialogue'].score = null` + absence from revision requests
- "Which matrix version applied?" → `matrixVersion = 'v1'`

---

## Part 8: Change Management & Versioning

### Matrix Versioning

- Semantic versions: `v1`, `v2`, etc.
- No in-place edits to released versions
- New Work Type → new version
- Applicability change → new version

### Backward Compatibility

- Existing evaluations always reference their original matrix version
- Re-runs may opt into newer versions explicitly

### Deprecation Rules

- Deprecated Work Types remain evaluable (backward compatible)
- UI may hide them for new users
- Never delete without migration path

---

## Part 9: Investor/Auditor Summary

**What This Means for Trust:**

"RevisionGrade prevents overconfident AI errors by structurally forbidding evaluation where criteria do not apply. Every score is reproducible, explainable, and auditable through:

- Named controls (RG-NA-001) that make it impossible to accidentally score irrelevant criteria
- Versioned master data that governs all routing
- Acceptance fixtures that prove protection
- Audit trails showing detected vs. final Work Type, matrix version, and per-criterion status"

---

## Final Lock Statement (Canon)

**No evaluation may run without an explicit, auditable Work Type routing.**

**No criterion may penalize a Work Type where it is marked N/A.**

**The master data matrix is the sole authority for applicability.**

**This is binding governance, not suggestion.**

---

## References

- See: [`docs/WORK_TYPE_REGISTRY.md`](./WORK_TYPE_REGISTRY.md) — Full Work Type registry with detection hints
- See: [`docs/MDM_IMPLEMENTATION_RUNBOOK.md`](./MDM_IMPLEMENTATION_RUNBOOK.md) — How to enforce this in code
- Master Data: [`functions/masterdata/work_type_criteria_applicability.v1.json`](../functions/masterdata/work_type_criteria_applicability.v1.json)
