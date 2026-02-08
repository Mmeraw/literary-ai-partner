# MDM Implementation Runbook

**Authority:** Engineering Binding  
**Status:** LOCKED  
**Effective Date:** 2026-01-04  
**Last Updated:** 2026-02-08

---

## Executive Summary

This runbook specifies how to operationalize MDM canon in code, across all evaluation paths. It is the bridge between governance (what must be true) and implementation (how to make it true).

**Required Reading:**
- [`docs/MDM_WORK_TYPE_CANON_v1.md`](./MDM_WORK_TYPE_CANON_v1.md) — The binding governance
- [`docs/WORK_TYPE_REGISTRY.md`](./WORK_TYPE_REGISTRY.md) — The Work Type registry

---

## Part 1: Master Data Anchoring

### Location (Immutable)

```
functions/masterdata/work_type_criteria_applicability.v1.json
```

This is the **only** source of truth for Work Type routing.

### File Structure (Required)

```json
{
  "matrixVersion": "v1",
  "updatedAt": "2026-01-04",
  "criteriaCatalog": [
    { "id": "hook", "label": "Hook / Opening Effectiveness" },
    { "id": "voice", "label": "Voice & Narrative Style" },
    ...
  ],
  "statusLegend": {
    "R": "Required (scored; can affect readiness)",
    "O": "Optional/Informational (may be scored lightly; never a readiness blocker)",
    "NA": "Not Applicable (must never score, penalize, or generate 'missing' flags)",
    "C": "Constrained (evaluated under special rules; may be scored; guidance must not force invention)"
  },
  "workTypes": {
    "personalEssayReflection": {
      "label": "Personal essay / reflection",
      "family": "prose_nonfiction",
      "criteria": {
        "hook": "R",
        "voice": "R",
        "character": "O",
        "conflict": "NA",
        "theme": "R",
        "pacing": "O",
        "dialogue": "NA",
        "worldbuilding": "NA",
        "stakes": "R",
        "linePolish": "R",
        "marketFit": "O",
        "keepGoing": "O",
        "technical": "NA"
      }
    },
    ...
  }
}
```

### Versioning Policy

- Semantic versions: `v1`, `v1.1`, `v2`, etc.
- No in-place edits to released versions
- New Work Type → new minor version
- Applicability change → new minor or major version
- Master data change → CLI tool validates and logs version change

### Schema Validation (Required)

All master data must validate against JSON Schema Draft 2020-12:

```
functions/masterdata/work_type_criteria_applicability.schema.json
```

**Schema Requirements:**
- `matrixVersion` present, string
- `updatedAt` present, string (ISO 8601 recommended)
- `criteriaCatalog` array, 13+ items, each with `id` (unique, alphanumeric) and `label`
- `statusLegend` object with exactly `R`, `O`, `NA`, `C` keys
- `workTypes` object, each entry has `label`, `family` (enum: approved families), `criteria` (object)
- Each `criteria` value must be exactly `R` | `O` | `NA` | `C`

### Runtime Full-Coverage Validation (Fail-Fast)

On app startup or master-data load:

```javascript
function validateWorkTypeMatrix(matrix) {
  // 1. Check criteriaCatalog uniqueness and count
  const catalogIds = matrix.criteriaCatalog.map(c => c.id);
  if (new Set(catalogIds).size !== catalogIds.length) {
    throw new Error('Duplicate criterion IDs in criteriaCatalog (MDM-01 violation)');
  }
  if (catalogIds.length !== 13) {
    throw new Error('criteriaCatalog must have exactly 13 criteria (expectation mismatch)');
  }

  // 2. For each Work Type, validate full coverage
  for (const [workTypeId, workType] of Object.entries(matrix.workTypes)) {
    const workTypeCriteria = Object.keys(workType.criteria);
    if (!arraysEqual(workTypeCriteria, catalogIds)) {
      throw new Error(
        `Work Type '${workTypeId}' missing criteria (MDM-01 violation). ` +
        `Expected: ${catalogIds.join(', ')}. Got: ${workTypeCriteria.join(', ')}`
      );
    }

    // 3. Validate status codes
    for (const status of Object.values(workType.criteria)) {
      if (!['R', 'O', 'NA', 'C'].includes(status)) {
        throw new Error(
          `Work Type '${workTypeId}' has invalid status code '${status}'. ` +
          `Allowed: R, O, NA, C`
        );
      }
    }

    // 4. Validate family enum (MDM-02)
    const approvedFamilies = [
      'prose_nonfiction', 'prose_fiction', 'prose_scene',
      'script_scene', 'screenplay_feature', 'tv_pilot', 'tv_episode',
      'stage_play', 'submission_materials', 'hybrid_other'
    ];
    if (!approvedFamilies.includes(workType.family)) {
      throw new Error(
        `Work Type '${workTypeId}' has invalid family '${workType.family}'. ` +
        `Allowed: ${approvedFamilies.join(', ')}`
      );
    }
  }

  log.info('MATRIX_VALIDATION_SUCCESS', { matrixVersion: matrix.matrixVersion });
  return true;
}

function arraysEqual(a, b) {
  return a.length === b.length && a.every(val => b.includes(val));
}
```

**Failure Behavior:**
- ❌ Throw and do not load matrix
- ❌ Alert Sentry with full validation error details
- ❌ Block app startup or evaluation
- ❌ User sees: "Internal governance error. Please contact support."

---

## Part 2: Work Type Detection & Confirmation Flow

### Detection (Structural Cues Only)

Detection uses **only structural markers**, never ML heuristics or implicit reasoning.

```javascript
function detectWorkType(text) {
  const hints = {
    personalEssayReflection: {
      score: 0,
      indicators: [
        { pattern: /\b(I|me|my|we)\b/g, match: 1 }, // High first-person density
        { pattern: /as\s+I\s+(look\s+)?back|I\s+realized|I\s+learned/i, match: 2 },
        { pattern: /dialogue|said|asked|replied/i, match: -1 }, // No dialogue expected
      ]
    },
    scriptSceneFilmTv: {
      score: 0,
      indicators: [
        { pattern: /^(INT\.|EXT\.)/m, match: 3 }, // Sluglines
        { pattern: /\(.*\)/m, match: 2 }, // Parentheticals
        { pattern: /^[A-Z\s]+$/m, match: 2 }, // CAPS action lines
      ]
    },
    // ... more detection rules
  };

  for (const [workTypeId, config] of Object.entries(hints)) {
    config.score = config.indicators.reduce((sum, ind) => {
      return sum + (text.match(ind.pattern) || []).length * ind.match;
    }, 0);
  }

  const detected = Object.entries(hints)
    .sort(([, a], [, b]) => b.score - a.score)
    .slice(0, 1)
    .map(([id]) => id)[0] || 'otherUserDefined';

  const confidence = calculateConfidence(hints[detected].score);

  return {
    detectedWorkType: detected,
    detectionConfidence: confidence, // 'low' | 'medium' | 'high'
    hint: hints[detected]
  };
}

function calculateConfidence(score) {
  if (score >= 10) return 'high';
  if (score >= 5) return 'medium';
  return 'low';
}
```

**Rules:**
- ✅ Use structural markers only (sluglines, first-person density, reflective phrases, etc.)
- ❌ Do not use ML or semantic inference
- ❌ Do not silently override user-provided Work Type
- Return: `{ detectedWorkType, detectionConfidence, hint }`

### Confirmation Gate (UI + Engine)

**UI Pattern:**
```
"Detected work type: Personal essay / reflection. Confirm?"

[Confirm] [This isn't right → Select another] [Other → Describe]
```

**Engine Contract:**
```javascript
async function confirmWorkType(detected, userAction, userProvidedWorkType) {
  let finalWorkType;

  if (userAction === 'confirm') {
    finalWorkType = detected;
  } else if (userAction === 'override' && userProvidedWorkType) {
    finalWorkType = userProvidedWorkType;
  } else {
    throw new Error('No Work Type confirmed. Evaluation cannot proceed.');
  }

  // Validate finalWorkType exists in matrix
  const matrix = loadMasterData();
  if (!matrix.workTypes[finalWorkType]) {
    throw new Error(`Work Type '${finalWorkType}' not found in matrix.`);
  }

  return finalWorkType;
}
```

**Hard Rule:**
- ❌ No evaluation without `finalWorkTypeUsed` stored
- ❌ No silent defaults
- ❌ No bypassing confirmation

---

## Part 3: Criteria Plan Construction

### Build CriteriaPlan (Single Source of Truth)

Before evaluation runs, build an immutable plan from master data **only**:

```javascript
function buildCriteriaPlan(finalWorkTypeUsed, matrix) {
  const workTypeSpec = matrix.workTypes[finalWorkTypeUsed];
  if (!workTypeSpec) {
    throw new Error(`Fatal: Work Type '${finalWorkTypeUsed}' not in matrix.`);
  }

  const criteriaPlan = {};

  for (const criterion of matrix.criteriaCatalog) {
    const status = workTypeSpec.criteria[criterion.id];
    criteriaPlan[criterion.id] = {
      id: criterion.id,
      label: criterion.label,
      status: status, // R | O | NA | C
      scoreEnabled: status !== 'NA',
      blockingEnabled: status === 'R', // Only R can block readiness
      weight: status === 'R' ? 1.0 : (status === 'O' ? 0.5 : 0),
      notes: []
    };
  }

  return criteriaPlan;
}
```

**Contract:**
- ✅ Built exclusively from matrix
- ✅ No hardcoded defaults
- ✅ No fallback logic
- ❌ Cannot use environment variables to override
- ❌ Cannot use "opinions" to adjust status

---

## Part 4: NA Enforcement (The Kill Switch)

### Pre-LLM: Input Gate (Exclude NA Criteria)

```javascript
async function buildEvaluationPrompt(text, criteriaPlan, finalWorkTypeUsed) {
  const applicableCriteria = Object.entries(criteriaPlan)
    .filter(([_, plan]) => plan.status !== 'NA')
    .map(([id, plan]) => ({
      id,
      label: plan.label,
      status: plan.status
    }));

  const naCriteria = Object.entries(criteriaPlan)
    .filter(([_, plan]) => plan.status === 'NA')
    .map(([id]) => id);

  const prompt = `
You are a literary evaluation system for RevisionGrade.

Work Type: ${finalWorkTypeUsed}
Applicable Criteria: ${applicableCriteria.map(c => c.label).join(', ')}

CRITICAL GOVERNANCE RULE:
The following criteria do NOT APPLY to this Work Type and must never be evaluated, scored, or mentioned:
${naCriteria.join(', ')}

This is not optional. Any mention of the NA criteria violates governance.

Evaluate only the applicable criteria...
  `;

  return prompt;
}
```

**Rule:**
- ✅ Omit NA criteria from the prompt entirely
- ✅ Explicitly state which criteria are forbidden
- ❌ Do not ask the LLM to "mention N/A"
- ❌ Do not rely on prompts as the only control (also use output gate)

### Post-LLM: Output Gate (NA Scrub)

After LLM response is parsed, deterministic gate removes any mention of NA criteria:

```javascript
function applyNAOutputGate(parsedResponse, criteriaPlan, naCriteria) {
  const naCriteriaSet = new Set(naCriteria);

  // 1. Remove NA scores
  for (const criterion of naCriteria) {
    if (parsedResponse.scores[criterion]) {
      delete parsedResponse.scores[criterion];
    }
  }

  // 2. Filter Priority Revision Requests
  parsedResponse.priorityRevisionRequests = (parsedResponse.priorityRevisionRequests || [])
    .filter(item => {
      // Check if item is keyed to an NA criterion
      if (naCriteriaSet.has(item.criterion_id)) {
        log.info('NA_OUTPUT_GATE_SCRUB', { criterion: item.criterion_id, item });
        return false; // Remove NA-keyed revision
      }
      return true;
    });

  // 3. Scrub agentSnapshot (if present)
  if (parsedResponse.agentSnapshot) {
    const coreDriversNA = naCriteria.some(c => ['conflict', 'dialogue', 'worldbuilding'].includes(c));
    if (coreDriversNA) {
      // Disable agentSnapshot entirely if core drivers are NA
      parsedResponse.agentSnapshot = {
        biggest_risk: null,
        most_leverage_fix: null,
        note: 'Agent snapshot disabled for this Work Type under NA governance.'
      };
      log.info('NA_GOVERNANCE', { coreDriversNA, naCriteria: naCriteria.join(', ') });
    } else {
      // Scrub NA mentions from snapshot text
      const snapshot = parsedResponse.agentSnapshot;
      const forbiddenWords = naCriteria.map(c => {
        const criterion = criteriaPlan[c];
        return criterion ? criterion.label.toLowerCase() : c;
      });
      // Remove or flag any mention of forbidden words
    }
  }

  // 4. Scrub WAVE items
  parsedResponse.waveItems = (parsedResponse.waveItems || [])
    .filter(item => {
      // Check basis criterion
      if (naCriteriaSet.has(item.criterion_id)) {
        return false; // Remove NA-based WAVE item
      }
      return true;
    });

  return parsedResponse;
}
```

**Behavior:**
- ✅ Deterministic removal of NA-keyed items
- ✅ Disable agentSnapshot when core drivers are NA
- ✅ Log all removals with `NA_OUTPUT_GATE_SCRUB`
- ❌ Never allow implicit NA mentions ("add plot" when conflict is NA)

---

## Part 5: Audit & Persistence

### Required Audit Fields

Extend `entities/EvaluationAuditEvent.json` with (non-breaking additions):

```json
{
  "id": "uuid",
  "evaluationId": "uuid",
  "timestamp": "2026-02-08T14:30:00Z",
  "userId": "user_id",
  "workId": "work_id",
  "detectedWorkType": "personalEssayReflection",
  "detectionConfidence": "high",
  "userAction": "confirm",
  "userProvidedWorkType": null,
  "finalWorkTypeUsed": "personalEssayReflection",
  "matrixVersion": "v1",
  "criteria_plan": {
    "hook": {
      "id": "hook",
      "label": "Hook / Opening Effectiveness",
      "status": "R",
      "score": 6,
      "evidence": "..."
    },
    "dialogue": {
      "id": "dialogue",
      "label": "Dialogue & Subtext",
      "status": "NA",
      "score": null,
      "evidence": null
    },
    ...
  },
  "totalScore": 70,
  "readinessStatus": "needs_revision"
}
```

**Storage Requirements:**
- ✅ Store on every evaluation
- ✅ Immutable (append-only)
- ✅ Queryable (for audit + analytics)
- ✅ Include per-criterion status and score

---

## Part 6: Acceptance Fixtures

### Test Framework Setup

Create `functions/testWorkTypeRouting.js`:

```javascript
const fixtureA = {
  name: 'Birthday Essay (Personal Essay / Reflection)',
  text: `I've never considered my "birthday" as a day worth celebrating...`,
  expectedWorkType: 'personalEssayReflection',
  expectedNACriteria: ['dialogue', 'conflict', 'worldbuilding'],
  expectedRCriteria: ['hook', 'voice', 'linePolish', 'stakes']
};

const fixtureB = {
  name: 'Script Scene (Film/TV)',
  text: `INT. COFFEE SHOP - DAY\n\nJOHN sits across from Mary...`,
  expectedWorkType: 'scriptSceneFilmTv',
  expectedNACriteria: ['linePolish', 'marketFit'],
  expectedRCriteria: ['dialogue', 'technical', 'pacing']
};

async function runFixtures() {
  console.log('Running MDM acceptance fixtures...\n');

  for (const fixture of [fixtureA, fixtureB]) {
    console.log(`Fixture: ${fixture.name}`);
    const result = await runSingleFixture(fixture);
    if (result.passed) {
      console.log('✅ PASSED\n');
    } else {
      console.log(`❌ FAILED: ${result.failureReason}\n`);
    }
  }
}

async function runSingleFixture(fixture) {
  const { detectedWorkType, detectionConfidence } = detectWorkType(fixture.text);
  const finalWorkType = fixture.expectedWorkType; // Simulate user confirmation

  const matrix = loadMasterData();
  const criteriaPlan = buildCriteriaPlan(finalWorkType, matrix);
  const evaluation = await evaluateWithCriteriaPlan(fixture.text, criteriaPlan, matrix);

  // Assertions
  const assertions = {
    detectedCorrectly: detectedWorkType === fixture.expectedWorkType,
    naCriteriaNotScored: fixture.expectedNACriteria.every(c => evaluation.scores[c] === null),
    naCriteriaNotInRevisions: !evaluation.priorityRevisionRequests.some(r => 
      fixture.expectedNACriteria.includes(r.criterion_id)
    ),
    atLeastOneRFires: fixture.expectedRCriteria.some(c => 
      evaluation.scores[c] !== null && evaluation.scores[c] !== undefined
    ),
    noNAMentionsInSnapshot: fixture.expectedNACriteria.every(c => 
      !JSON.stringify(evaluation.agentSnapshot).toLowerCase().includes(c.toLowerCase())
    )
  };

  const allPass = Object.values(assertions).every(a => a);
  return {
    passed: allPass,
    assertions,
    failureReason: Object.entries(assertions)
      .filter(([_, passed]) => !passed)
      .map(([name]) => name)
      .join('; ')
  };
}

// Export for test runner
module.exports = { runFixtures, fixtureA, fixtureB };
```

### Running Fixtures (CI/CD)

```bash
npm run test:fixtures

# Output:
# Fixture: Birthday Essay (Personal Essay / Reflection)
# ✅ PASSED
#
# Fixture: Script Scene (Film/TV)
# ✅ PASSED
```

**Release Blocker:**
- Fixtures must pass before any Release to Production
- Failed fixtures → do not deploy

---

## Part 7: New-Hire Onboarding Checklist

### Day 1 — Conceptual Grounding

- ☐ Read: [`docs/MDM_WORK_TYPE_CANON_v1.md`](./MDM_WORK_TYPE_CANON_v1.md)
- ☐ Read: [`docs/WORK_TYPE_REGISTRY.md`](./WORK_TYPE_REGISTRY.md)
- ☐ Understand: Work Type ≠ Genre (it's structural routing only)
- ☐ Understand: Routing happens before evaluation
- ☐ Understand: NA is a hard prohibition, not a suggestion
- ☐ Understand: The matrix is law

**Lock-In:**  
"Why must we route before evaluating?"  
Answer: So we don't accidentally score irrelevant criteria. Essays without dialogue shouldn't be penalized for missing dialogue.

---

### Day 2 — System Behavior

- ☐ Walk through: detection → confirmation → evaluation flow
- ☐ Review: Birthday essay fixture (why dialogue is NA)
- ☐ Review: Script scene fixture (why prose polish is NA)
- ☐ Write: A new detection hint for a Work Type
- ☐ Understand: "Positive signal" requirement (at least one R must fire)

**Lock-In:**  
"What does NA actually prevent?"  
Answer: scoring, penalizing, "missing" flags, readiness blocking, revision directives anywhere in output.

---

### Day 3 — Failure Modes to Avoid

- ☐ Never score an NA criterion
- ☐ Never auto-route silently
- ☐ Never force structural invention (scenes, dialogue) in constrained forms
- ☐ Never hardcode applicability logic outside master data
- ☐ Never override user-confirmed Work Type silently

**Code Review Check:**
If you see code that looks like:
```javascript
if (workType === 'essay') {
  // Skip dialogue scoring
}
```

That's wrong. Instead:
```javascript
// Load criteria_plan from matrix
// NA criteria are structurally absent
```

---

### Day 4 — Practical Exercises

- ☐ Read the master data JSON and count Work Types
- ☐ Manually build a criteriaPlan from the matrix for "Novel Chapter"
- ☐ Simulate a user override from detected → user-provided Work Type
- ☐ Verify that logs include: detected vs final Work Type, matrixVersion, per-criterion status
- ☐ Run the acceptance fixtures locally
- ☐ Modify a fixture to expect different NA criteria; watch it fail, then fix it

---

### Graduation Criteria (Required)

A new hire may work independently only after they can answer:

1. **"Why must a personal essay never be penalized for missing dialogue?"**  
   Answer: Because `dialogue` is marked NA for `personalEssayReflection` in the matrix. NA is a hard prohibition. It cannot score, penalize, or flag missing.

2. **"Why is detection advisory but confirmation authoritative?"**  
   Answer: Detection heuristics can be wrong. Only the user's confirmed Work Type is trusted for routing. If we silently auto-routed, we'd misroute forms and corrupt data.

3. **"How would you replay an evaluation from logs six months later?"**  
   Answer: Look up the stored audit record: `finalWorkTypeUsed`, `matrixVersion`, and `criteria_plan` with per-criterion status. That tells us which criteria applied and why.

---

## Part 8: Change Management & Deprecation

### Deploying a Master Data Change

1. **Edit the JSON:**  
   `functions/masterdata/work_type_criteria_applicability.v1.json`

2. **Run validation:**  
   `npm run validate:mdm` → must pass

3. **Update registry:**  
   `docs/WORK_TYPE_REGISTRY.md` (if adding/removing Work Type)

4. **Decide on versioning:**  
   - New Work Type → `v1.1.0` (minor bump)
   - Applicability change → `v1.1.0` or `v2.0.0` depending on scope
   - Label-only change → no version bump

5. **Update fixtures if needed:**  
   `functions/testWorkTypeRouting.js`

6. **Run fixtures locally:**  
   `npm run test:fixtures` → must pass

7. **Open PR with:**
   - JSON changes
   - Registry updates
   - Fixture updates
   - Rationale comment (why the change, what does it prevent?)

8. **Code review checks:**
   - ☐ Full coverage validation passes
   - ☐ No ad-hoc hardcoding introduced
   - ☐ Fixtures still pass
   - ☐ Backward compatibility maintained (old evaluations still work)

9. **Deploy:**
   - Merge to main
   - CI runs full test suite
   - Fixtures run as part of CI
   - Build succeeds
   - Deploy to staging, then production

---

## Part 9: Investor / Auditor Summary

**If someone asks: "How do you prevent AI from misapplying rubrics?"**

Answer:  
"We have a versioned, governed master-data registry (the Work Type → Criteria Applicability Matrix) that specifies, for each structural form, which criteria apply (Required), which are soft (Optional), and which are structurally forbidden (Not Applicable). Before any evaluation runs, the system detects what kind of work it is, the user confirms the Work Type, and the engine loads the criteria plan for that specific form. Any criterion marked N/A cannot score, cannot penalize, cannot generate feedback—it's a hard prohibition enforced in the engine. We log detected vs. confirmed Work Type, the matrix version, and per-criterion status on every run, so six months later we can prove which rubric applied and why. The acceptance fixtures test that the two most-at-risk cases (essays being penalized for no dialogue, scripts being polished on prose style) never happen."

---

## Part 10: Troubleshooting

### "The fixture is failing—dialogue still appears in agentSnapshot"

**Check:**
1. Are you running the latest code? (Redeploy or clear function cache)
2. Is agentSnapshot generation gated before LLM call?
3. Is the NA Output Gate applying after LLM parsing?

**Fix:**
```javascript
// Before LLM call
if (naCriteria.includes('conflict') && naCriteria.includes('dialogue')) {
  let agentSnapshot = null; // Skip LLM call
  agentSnapshot = { note: 'Disabled for this Work Type.' };
} else {
  // Call LLM for agentSnapshot
}
```

---

### "Matrix validation is failing but I don't see why"

**Check:**
```bash
npm run validate:mdm --verbose
```

Look for:
- Missing criteria keys in a Work Type
- Invalid status codes (typo: 'na' instead of 'NA')
- Invalid family name
- Duplicate Work Type IDs

---

### "Old evaluations are using the new matrix version, breaking reproducibility"

**Never do this.** Evaluations must always store and use `matrixVersion` from the time they ran.

If you need to change the matrix:
1. Create a new version (e.g., v1.1.0)
2. Keep the old version available for historical queries
3. New evaluations use the new version; old evaluations reference the old version

---

## References

- **Binding Governance:** [`docs/MDM_WORK_TYPE_CANON_v1.md`](./MDM_WORK_TYPE_CANON_v1.md)
- **Work Type Registry:** [`docs/WORK_TYPE_REGISTRY.md`](./WORK_TYPE_REGISTRY.md)
- **Master Data:** [`functions/masterdata/work_type_criteria_applicability.v1.json`](../functions/masterdata/work_type_criteria_applicability.v1.json)
- **Fixtures:** [`functions/testWorkTypeRouting.js`](../functions/testWorkTypeRouting.js)
- **Criteria Validation:** [`functions/validateWorkTypeMatrix.js`](../functions/validateWorkTypeMatrix.js)
