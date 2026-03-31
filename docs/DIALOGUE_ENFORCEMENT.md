# Dialogue Enforcement Policy

**Status:** Canonical  
**Authority:** WAVE Revision Guide, RevisionGrade Governance  
**Effective:** March 31, 2026  

## Summary

Dialogue in revision workflows must be handled as a protected asset. Compression and rewriting rules do not apply to functional dialogue. This policy establishes three-layer enforcement to prevent drift.

---

## Principle

From WAVE canon: *dialogue must do work*. Functioning dialogue should not be explained, flattened, or optimized for efficiency. Meaning moves through rhythm, repetition, implication, and subtext—none of which survives generic compression.

**Governed rule:**
If dialogue advances plot, reveals character, shifts power, or carries meaning through rhythm/repetition/subtext, lock it. Only compress narration around it. Only remove dialogue if it fails function completely.

---

## Three-Layer Enforcement

### 1. Classification Gate

**Trigger:** Before any compression runs, classify the passage.

**Logic:**
- If the passage is **dialogue-heavy** (>30% dialogue markers, multiple speakers), classify as `dialogue`
- If the passage is **multi-speaker** (3+ speakers per section), classify as `dialogue`  
- If the passage is **meaning-bearing through rhythm/repetition/implication**, classify as `dialogue`
- Otherwise, classify as `prose` and route to compressible pool

**Implementation:** Extend `lib/revision/passageClassifier.ts` to detect dialogue characteristics.

**Result:** Dialogue passages route to protected class instead of compressible class.

---

### 2. Execution Barrier

**Trigger:** If classification resolves to protected dialogue.

**Allowed Operations:**
- Dialogue tag cleanup under Wave 13 only
- Surrounding narration compression (outside dialogue blocks)
- Metadata management

**Forbidden Operations (hard-blocked):**
- ❌ Merging dialogue lines
- ❌ Rewriting phrasing for efficiency
- ❌ Removing cadence-bearing repetition
- ❌ Altering rhythm, pauses, or implication
- ❌ Compression of dialogue body text under any profile

**Implementation:** In `lib/revision/revisionOrchestrator.ts`, when `passageHint === "protected"` or classification is `dialogue`, return zero edits immediately (existing fast-path).

**Authority:** Follows WAVE canon directly: platforms implement canon; they do not redefine it.

---

### 3. Validation Layer

**Fixture Tests:**
- Add `tests/fixtures/benchmarks/dialogue-integrity-strict.fixture.json`
- Passages with dialogue content expect `compression: "0%"` or near-zero
- Include high-density dialogue (e.g., Anthony-William exchange from LTRD Ch. 2)

**Assertions (in `tests/unit/benchmark-truth-cases.test.ts`):**
```typescript
// Protected dialogue must return zero edits
expect(run.edits.filter(e => e.content.includes('dialogue')).length).toBe(0);

// Line order must be preserved for all dialogue
expect(run.passageClassification.classification).not.toBe('dialogue') 
  || run.edits.length === 0;

// Dialogue text must not be rewritten
expect(run.output).toContain(originalDialogueText);
```

**Regression Checks:**
- CI must validate no dialogue compression across all active profiles
- Contract guard must reject changesets that alter dialogue text without explicit governance approval
- Canon Guard (`AI_GOVERNANCE.md`) must validate dialogue lock enforcement

**CI Pre-merge:**
- Pre-commit: `canon-guard` validates no dialogue body compression in diffs
- CI: `npm test` validates all dialogue fixtures at 0% compression
- Merge gate: Requires explicit dialogue safety review if any dialogue modification

---

## Governance Authority

**Contract Reference:**
- `docs/JOB_CONTRACT_v1.md` — job state enforcement
- `WAVE_REVISION_GUIDE.md` — dialogue as working element (canon)
- `AI_GOVERNANCE.md` — platform authority and contract validation

**CI Integration:**
- Pre-commit: `canon-guard` (checks JOB_CONTRACT_v1, validates dialogue preservation)
- Test: Jest harness validates dialogue fixtures at 0% compression
- Merge: Requires Canon Guard + dialogue safety check pass

---

## Implementation Roadmap

- [ ] **Phase 1:** Extend classifier to detect dialogue (>30% markers, multi-speaker)
- [ ] **Phase 2:** Add dialogue integrity fixture + assertions
- [ ] **Phase 3:** Update CI pre-commit to validate dialogue hard-lock
- [ ] **Phase 4:** Document dialogue test results in benchmark summary

---

## Rationale

This three-layer approach is consistent with current architecture:
- ✅ Protected passages already return zero edits (execution barrier exists)
- ✅ Classifier already distinguishes passage types (classification gate structure exists)
- ✅ Test harness + Canon Guard already enforce contract (validation layer exists)

This policy formalizes what was implicit and ensures dialogue handling survives code refactors, profile additions, and team changes.

---

## Reference Example

**LTRD Ch. 2 Anthony-William Exchange** (lines 152-160 canonical):

```
WILLIAM: [speaks about river and ceremony]
ANTHONY: [responds about offering and acceptance]
```

**Treatment:**
- Classified as: `dialogue` (multi-speaker, meaning-bearing)
- Compression: Hard-locked (0 edits)
- Protection: Preserved in full, rhythm intact
- Allowed: Surrounding narration compression only

**Result:** Dialogue integrity + selective prose compression in same passage = balanced revision.
