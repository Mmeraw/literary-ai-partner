# Canon Fidelity Fixture — Froggin Noggin
## CI Benchmark Fixture | FROGGIN-SPECIFIC | v2

**Version:** 2.0  
**Manuscript:** *Froggin Noggin* by Michael J. Me Raw  
**Scope:** Froggin-specific canon requirements for CI regression testing ONLY  
**Hard rule:** This fixture MUST NOT be injected into any production prompt or general platform calibration. It is test/benchmark use only.  
**Author:** Mike Meraw  

---

## Purpose

A future Froggin Noggin evaluation run must satisfy all required detections below and must fail if any failure-trigger condition is present. This fixture defines the acceptance criteria for automated regression testing of the Froggin evaluation pipeline.

---

## Required Detections (MUST PASS)

A passing Froggin evaluation must explicitly surface each of the following canon nodes. Absence of any node is a test failure.

### Character Canon

| Node | Required Detection | Notes |
|---|---|---|
| Newton / Newbie | Named and identified as primary protagonist | Both name forms acceptable |
| Lacerta | Named and identified as Newton's mother | Relationship must be explicit |
| Twillow | Named and identified as bully / catalyst figure | Structural role must be surfaced |
| Zimeon | Named and identified as Dead Zone / shard longing character | Must carry that specific emotional/structural weight |
| Thorander | Named and identified as ideological engine | Structural/doctrinal role must be explicit |

### Relationship Spine

| Spine | Required Detection | Notes |
|---|---|---|
| Rana–Newton | Named as a relationship spine, not a solo character label | Must be identified as a paired structural unit |
| Rana as healing / ethical bridge | Role must be named explicitly | NOT reduced to "Dead Zone traveler" only |
| Newton–Lacerta | Parental bond must be identified as structurally load-bearing | Must not be treated as ancillary background |

### Doctrinal Counter-System

| Node | Required Detection | Notes |
|---|---|---|
| Twen / Newtlore | Named as doctrinal counter-system | Must be surfaced as parallel/opposing doctrine to dominant system |
| Twen/Newtlore doctrine | Treated as structural, not decorative | Must appear in structural stack or doctrinal audit |

### Medicine / Object System

| Node | Required Detection | Notes |
|---|---|---|
| Juniper berry medicine | Named and identified as functional medicine element | Must include at least one of: ingredient, procedure, risk, or knowledge-transfer reference |
| Fungus / blight / toxin-neutralizing medicine | Named and identified as functional medicine element | Must be treated as structural, not flavor |
| Medicine system overall | Evaluated as plot engine / structural criterion | Not as background or setting detail |

---

## Failure Triggers (MUST FAIL)

A Froggin evaluation that contains any of the following conditions is a test failure. These represent known calibration errors from the baseline analysis.

### Character Attribution Errors

| Condition | Failure Reason |
|---|---|
| Assigns Dead Zone longing to Rana | Zimeon is the Dead Zone / shard longing character; Rana is healing/ethical bridge |
| Treats Newton / Lacerta as ancillary or background | They are load-bearing structural characters |
| Assigns Twillow's structural role to another character | Twillow is the defined bully/catalyst |

### Recommendation Errors

| Condition | Failure Reason |
|---|---|
| Recommends adding Zimeon belief-shift when already present | ALREADY_PRESENT error — ADD issued against existing element |
| Recommends "adding" a relationship spine that exists in the text | Misclassified recommendation type |
| Issues recommendation to add healing/tenderness spine without checking presence | Rana–Newton tenderness spine must be verified before issuing ADD |

### Unsupported Attribution

| Condition | Failure Reason |
|---|---|
| Uses "poaching" as character motivation or as established story fact | No source support for this attribution — must not be injected |
| Any motivation attributed to a character without source support | General canon error per Lesson 4 |

### Structural Omission

| Condition | Failure Reason |
|---|---|
| Pitches the manuscript without mentioning tenderness / healing spine | Commercial pitch missing load-bearing emotional arc |
| Twen / Newtlore not mentioned anywhere in structural analysis | Doctrinal counter-system suppressed |
| Juniper berry medicine absent from criterion analysis | Functional medicine system not detected |

---

## Score Baseline (Truth Target Reference)

These are the validated truth-target scores for a correctly calibrated Froggin evaluation. A passing CI run should be within ±3 points of these targets.

| Dimension | Baseline (uncorrected) | Truth Target | Acceptable Range |
|---|---|---|---|
| Overall | 68 | 74 | 71–77 |
| Readiness | 60 | 68 | 65–71 |
| Commercial | 55 | 66 | 63–69 |
| Literary | 80 | 82 | 79–85 |
| Quality | 72 | 78 | 75–81 |

Scores outside acceptable range without documented justification are a soft test failure (warning, not hard stop).

---

## Fixture Metadata

```json
{
  "fixture_id": "canon_fidelity_fixture_froggin_v2",
  "manuscript": "Froggin Noggin",
  "author": "Michael J. Me Raw",
  "version": "2.0",
  "baseline_job_id": "51638d91-5fbb-4e5a-9326-5decff2161ce",
  "scope": "CI_BENCHMARK_ONLY",
  "production_injection": false,
  "required_detections_count": 14,
  "failure_trigger_count": 10
}
```

---

## Test Assertions (Pseudo-code)

```typescript
// All assertions must pass for a Froggin evaluation to be CI-green

assert.contains(report, "Newton") || assert.contains(report, "Newbie")
assert.contains(report, "Lacerta") && assert.contains(report, "mother")
assert.contains(report, "Twillow")
assert.contains(report, "Zimeon")
assert.contains(report, "Thorander")
assert.contains(report, "Rana") && assert.contains(report, "Newton") // relationship spine
assert.contains(report, "Twen") || assert.contains(report, "Newtlore")
assert.contains(report, "juniper")
assert.contains(report, "fungus") || assert.contains(report, "blight") || assert.contains(report, "toxin")

// Failure triggers — these must NOT be present
assert.notContains(report, "Rana.*Dead Zone longing") // Zimeon owns this, not Rana
assert.notContains(report, "poaching") // unsupported attribution
assert.notContains(report, "add.*Zimeon") // already present
```

---

## Fixture Maintenance

When a new Froggin evaluation is run:
1. Run all required-detection assertions.
2. Run all failure-trigger assertions.
3. Check scores against acceptable range.
4. Log pass/fail per node.
5. Flag any new canon gaps for v3 fixture update.

**Do not update this fixture based on a single anomalous evaluation run. Require at least two independent failures before adding a new detection requirement.**

---

*Froggin-specific CI fixture. Test/benchmark use only. Do not inject into production prompts or general platform calibration. See evaluation_fit_gap_v2.md for abstracted platform lessons.*
