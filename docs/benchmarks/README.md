# Ancient Bloodlines — Evaluation Benchmark Package

## Overview

This package contains a complete calibration fixture for the RevisionGrade evaluation system, using *Ancient Bloodlines—Love Between Species* as a gold-standard reference. The benchmark ensures RevisionGrade maintains consistent behavior across code changes, prompt updates, and new evaluator training.

## What's in this package

### Documentation
- **[ancient-bloodlines-shortform-model.md](ancient-bloodlines-shortform-model.md)** — Human-readable reference evaluation (merged template format) with full criterion scoring and canonical governance notes.

### Test Fixtures
- **[ancient-bloodlines.shortform.model.json](../../testdata/evaluation/ancient-bloodlines.shortform.model.json)** — Machine-checkable expected output (CriterionBlock schema) with score targets, emotional bands, and governance metadata.

- **[ancient-bloodlines.evidence-anchors.json](../../testdata/evaluation/ancient-bloodlines.evidence-anchors.json)** — 20 evidence anchors (scenes, dialogues, thematic moments) used for validation and few-shot training.

- **[ancient-bloodlines.canon-presence.json](../../testdata/evaluation/ancient-bloodlines.canon-presence.json)** — Required recurring cast and canon continuity enforcement metadata.

### Regression Tests
- **[ancient-bloodlines.shortform.spec.ts](../../tests/evaluation/benchmarks/ancient-bloodlines.shortform.spec.ts)** — Comprehensive Jest test suite validating:
  - Score band compliance (±1 tolerance)
  - Canon character preservation (Twillow, Snappy, Thorander, Rana, Newton)
  - Closure non-scorability enforcement
  - CRAFT vs. INTELLIGENCE separation
  - Emotional band consistency
  - Revision priority governance

- **[ancient-bloodlines.fixture.spec.ts](../../tests/evaluation/benchmarks/ancient-bloodlines.fixture.spec.ts)** — Sanity checks validating the fixture itself respects governance invariants.

- **[ancient-bloodlines.governance.spec.ts](../../tests/evaluation/benchmarks/ancient-bloodlines.governance.spec.ts)** — Behavior-governance suite validating computed coverage certification, fail-closed long-form downgrade semantics, criterion-scope locking, and quality-gate rejection before persistence when uncertified manuscript-wide scores remain SCORABLE.

- **[github-ancient-bloodlines-gold-standard-brief.md](github-ancient-bloodlines-gold-standard-brief.md)** — Gold-standard acceptance brief for GitHub/PR discussions: benchmark passes only when truth-governance behavior is enforced, not merely fixture presence.

## Why this benchmark exists

The original RevisionGrade Job 3463bb26 reported a score of 20/100 for this novella, but root cause analysis revealed the issue was not manuscript quality but **packet design failure**: Pass 3 received only a lossy "compressed reference window" and could not score five categories responsibly.

This benchmark documents:
1. **Corrected ground truth**: 62–67/100 when all 12 categories are scored responsibly
2. **System gaps**: Packet design, rubric conflation (CRAFT/INTELLIGENCE merge), score semantics (0/10 ambiguity)
3. **Validation gates**: Regression tests that prevent future corruptions

## How to use this benchmark

### For validation (during CI/CD)

Run the test suites to catch regressions:

```bash
npm run test:benchmark:ancient-bloodlines
```

These tests will fail if:
- Any criterion score drifts outside tolerance (±1)
- Canon characters (Twillow, Snappy, Thorander) are dropped from commentary
- Closure is re-scored as numeric despite insufficient coverage
- CRAFT and INTELLIGENCE scores collapse to the same value
- Emotional banding becomes implausible

### For training new evaluators

Use the evidence anchors to show good behavior:

```json
// From ancient-bloodlines.evidence-anchors.json
{
  "anchorId": "AB-005",
  "topic": "Cross-species healing / care work",
  "criterionLinks": ["character_depth_psychology", "theme_intelligence"],
  "whyItMatters": "Dramatizes the theme (cross-species cooperation). Shows Newton's interiority as engagement, not narration.",
  "revisionLever": "This scene is where Newton's choice to care feels most real..."
}
```

The 20 anchors show:
- Where CRAFT (prose, pacing, dialogue) is weak but fixable
- Where INTELLIGENCE (theme, world-building, concept) is strong
- Canon continuity requirements (all 13 named characters)
- Dramatized vs. expository delivery patterns

### For future calibration (PR #2)

Once PR #458 is merged and one production run with v12 is complete:

1. Compare actual Froggin Noggin ledger output against the structured context fixture
2. Validate heuristic NER noise profile on real character_ledger data
3. Use this corrected Ancient Bloodlines eval as baseline when setting PR #2 gates

## Governance rules encoded here

### Closure handling
- Status must be `INSUFFICIENT_SIGNAL` (not `SCORABLE`) when full manuscript is unavailable
- Score must be `null` (not numeric 0)
- Confidence must be `LOW`
- Tests will fail if anyone tries to re-score closure as numeric

### Canon continuity
- All 13 characters in `canonicalCharacters` should appear in Character Depth, World-Building, and Theme commentary
- Exception: Secondary characters may be omitted if truly minor, but antagonists (Twillow, Snappy) and authority figures (Thorander) must appear
- Test requires minimum 70% mention rate (≥9 of 13 characters)

### Craft vs. Intelligence separation
- CRAFT criteria (dialogue, prose, scene construction, pacing): typically 5–6/10 "needs work but fixable"
- INTELLIGENCE criteria (theme, world-building, concept): typically 7–8/10 "conceptually strong"
- Tests enforce that intelligence average differs meaningfully from craft average (>0.5 points difference)

### Emotional banding
- Most criteria: `STRENGTH_PLUS_GROWTH` (promising work with clear improvement path)
- Lower craft areas: `GROWTH` (focus on revision)
- Non-scorable closure: `INSUFFICIENT_SIGNAL_REASSURANCE` (not claiming false certainty)

## Test execution checklist

Before deploying any RevisionGrade updates:

- [ ] Run `npm run test:benchmark:ancient-bloodlines`
- [ ] All 50+ tests pass (fixture validation + regression suite)
- [ ] Verify no canonical character names are dropped from commentary
- [ ] Confirm closure score is still `null`, not numeric
- [ ] Check that craft/intelligence score averages differ (> 0.5 points)

## Release gate policy

No RevisionGrade release is valid unless the Ancient Bloodlines benchmark gate is green on main.

- Required gate command: `npm run test:benchmark:ancient-bloodlines`
- CI enforcement: workflow step `Ancient Bloodlines benchmark gate` in `.github/workflows/ci.yml`
- The benchmark must remain non-flaky; any flaky behavior blocks release until resolved.

## Implementation notes

### Wiring the actual evaluator

When you integrate the actual RevisionGrade SHORTFORM pipeline:

Replace this in `ancient-bloodlines.shortform.spec.ts`:
```typescript
// MOCK: Replace with real call
report = JSON.parse(JSON.stringify(expected));
```

With this:
```typescript
report = await runEvaluation({
  route: 'SHORTFORM',
  manuscriptId: 'ancient-bloodlines-3463bb26',
});
```

Then run tests. If they fail, the fixture alerts you to the divergence.

### Score tolerance guidance

The `SCORE_TOLERANCE = 1` allows ±1 point per criterion. This accounts for:
- Slight variation in how heuristic NER extracts character names
- Minor prompt wording changes
- Different random seeds in Pass 3 if present

If you see consistent +0.5 drift, consider adjusting baseline. If you see wild swings (±2+), investigate prompt corruption.

### Extending the benchmark

To add another manuscript as a calibration case:

1. Create a new markdown evaluation in `docs/benchmarks/`
2. Create a JSON fixture in `testdata/evaluation/` following the CriterionBlock schema
3. Create evidence anchors in `testdata/evaluation/`
4. Create test file in `tests/evaluation/benchmarks/`
5. Wire the new tests into CI
6. Add governance notes documenting what the new manuscript teaches (e.g., "this tests POV consistency in first-person horror")

## Reading the fixtures for context

### If a field in the fixture says...

- `status: "SCORABLE"` → Expect a numeric score (0–10)
- `status: "INSUFFICIENT_SIGNAL"` → Expect `score: null` and `confidence: "LOW"`
- `confidence: "MODERATE"` → ±1 variation is acceptable
- `confidence: "HIGH"` → Convergence should be tighter (±0.5 preferred)
- `emotionalBand: "STRENGTH_PLUS_GROWTH"` → Supportive, constructive tone recommended
- `emotionalBand: "GROWTH"` → Honest about weaknesses; clear revision path still accessible

### Canon / open promises

The fixture documents:
- **13 named characters** who must appear in commentary
- **6 open story promises** that the novella sets up and should resolve
- **Missing-evidence rule**: Omitted sections → label as `INSUFFICIENT_SIGNAL`, don't score blind

## Troubleshooting

### Test fails: "Canon loss detected"

**Symptom**: `REGRESSION: Canon loss detected. Expected at least 9 characters; found 5.`

**Cause**: Your evaluator is not mentioning major characters (Twillow, Snappy, Thorander) in Character Depth / World-Building / Theme commentary.

**Fix**: Check that your prompt includes character roster and that your Pass 2a structured context populates character_ledger with full names. If NER is stripping names, recalibrate the heuristic.

### Test fails: "Closure has been re-scored"

**Symptom**: `REGRESSION: Closure has been re-scored. This breaks governance rule...`

**Cause**: A code or prompt change caused Pass 3 to emit a numeric score for Narrative Closure & Promises.

**Fix**: Verify that your governance gate checks `coverage.mode` and downgrades closure to `INSUFFICIENT_SIGNAL` if full manuscript is unavailable. Do not allow numeric scores for partial-coverage criteria.

### Test fails: "Craft and intelligence scores collapse"

**Symptom**: `Expected difference to be greater than 0.5...`

**Cause**: Your evaluator is treating dialogue, prose, and pacing the same as theme and world-building.

**Fix**: Audit your prompt to ensure it explicitly separates CRAFT (line-level execution) from INTELLIGENCE (systemic thinking). The rubric should make this distinction clear.

---

**Last updated**: 2026-05-13  
**Benchmark status**: ✅ Locked (Ancient Bloodlines v1 corrected evaluation 62–67/100)  
**Related PRs**: #458 (v12 structured context), #459 (PacketV2 + INTELLIGENCE axis), #2 (gate calibration)
