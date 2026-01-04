# GOLD-STANDARD CALIBRATION PROCESS
**Defensible · Repeatable · Auditable**

**Status:** Approved  
**Version:** 1.0  
**Date:** 2026-01-04  
**Authority:** RevisionGrade Quality Standard

---

## Objective

Establish and maintain:
- A **calibrated 95% threshold** (confidence means what it claims)
- A **gold-standard regression suite** (prevents drift)
- A **continuous improvement loop** (measurable learning)

---

## A. Inputs: The Gold Set

### v1 Target Set
**20 manuscripts** (minimum viable calibration)

### Balance Requirements

| Dimension | Distribution |
|-----------|-------------|
| **Genre** | Thriller, literary, sci-fi, romance, memoir, screenplay |
| **Format** | Novel (15), screenplay (3), excerpt (2) |
| **Quality** | Strong (8), medium (8), weak (4) |
| **Ambiguity** | Clean (12), ambiguous (8) |

### Per-Manuscript Artifacts

Each manuscript includes:
1. **Immutable snapshot ID**
2. **Metadata sheet** (title, genre, word count, format)
3. **Evaluation run logs**
4. **Truth set** (annotated ground truth)

---

## B. Annotation Protocol (Human Truth Set)

### What Gets Annotated

For each manuscript, create truth set for:

1. **Role Assignments**
   - Protagonist (name, page introduced)
   - Antagonist (type, first appearance)
   - Key supporting roles (if >25% page time)

2. **Structural Beats** (where applicable)
   - Inciting incident (chapter/page)
   - Midpoint (chapter/page)
   - Climax (chapter/page)

3. **Readiness Outcome**
   - Not Ready / Conditional / Ready

4. **Known Ambiguity Flags**
   - Areas where reasonable experts disagree

---

### Annotation Team (Minimum)

- **2 independent annotators**
  - 1 internal (RevisionGrade team member)
  - 1 external invited expert (editor, agent, or educator)

- **1 adjudicator**
  - Final tie-breaker for disagreements

---

### Annotation Output

**Consensus Truth:**
- Agreed-upon facts
- Confidence level per fact (certain / likely / uncertain)

**Allowed Disagreement Zones:**
- Documented areas where annotators disagree
- These become **expected "Medium confidence" territory**

**Critical Rule:**
Disagreement zones are NOT forced into false certainty; they remain labeled as ambiguous.

---

## C. Calibration Method (v1)

### Step 1: Run Evaluation

Run RevisionGrade evaluation on all gold-set manuscripts.

---

### Step 2: Compare to Truth Set

For each claim type:
- Compute **True Positives** (correct and asserted)
- Compute **False Positives** (incorrect but asserted)
- Compute **False Negatives** (correct but missed)

---

### Step 3: Build Confidence Distribution

Group claims by confidence band:
- HIGH (≥95%)
- MEDIUM (80-94%)
- LOW (<80%)

For each band, compute:
- **Actual correctness rate** (TP / (TP + FP))

---

### Step 4: Validate Calibration

| Band | Target Correctness | Action if Below Target |
|------|-------------------|----------------------|
| HIGH (≥95%) | ≥95% | Threshold too permissive → raise internal scoring |
| MEDIUM | 80-94% | Acceptable range |
| LOW | No requirement | Expected low correctness |

---

### Step 5: Lock Configuration

**Locked Parameters:**
- Threshold = 95% (policy decision)
- Dimension weights (currently equal)

**If re-weighting needed:**
- Do it transparently
- Document rationale
- Re-run calibration

**Example:** Role assignment might require heavier Evidence Presence weight if systematic errors detected.

---

## D. Regression Suite (Release-Blocking)

### Purpose

Once calibrated, the gold set becomes a **release gate**.

---

### Execution

Every new build runs the full gold set before deployment.

---

### Blocking Conditions

Any of the following **BLOCKS** the release:

1. **Confidence drift** beyond tolerance (>5 percentage points on critical claim types)
2. **Increased false certainty** (high-confidence claims that are wrong)
3. **Broken determinism** (same input producing different outputs)
4. **New unknowns not labeled** (ambiguity present but not flagged)

---

### Evidence Required

- Full regression report
- Per-manuscript pass/fail
- Aggregate accuracy vs baseline

---

## E. Continuous Improvement Loop

### Incident → Learning

Every production incident that reflects a **real misclassification** becomes:

1. **EvaluationIncident** record (logged immutably)
2. **Candidate addition** to gold set (if representative)
3. **New regression test case** (prevent recurrence)
4. **Calibration update** (if repeated error class)

---

### Learning Velocity Metric

```
learning_velocity = (errors_last_month - errors_this_month) / errors_last_month
```

**Target:** Positive (decreasing errors)

---

### Review Cadence

- **Weekly:** Review new incidents
- **Monthly:** Update gold set if needed
- **Quarterly:** Full recalibration

---

## F. Deliverables

### What Base44 Should Expect

1. **GOLD_SET_MANIFEST.json**
   - List of all gold manuscripts
   - Version, genre, quality band, ambiguity profile

2. **ANNOTATION_GUIDE.md**
   - Definitions and annotation rules
   - Examples of edge cases

3. **TRUTH_SET_<manuscriptId>.json** (per manuscript)
   - Annotated ground truth
   - Confidence levels per fact

4. **CALIBRATION_REPORT_v1.pdf** (or .md)
   - Accuracy by band
   - Calibration curve
   - Pass/fail determination

5. **CI Job: run_gold_suite**
   - Automated regression execution
   - Pass/fail gates integrated with deployment pipeline

---

## G. Gold Set Versioning

### Version Control

- Gold set versioned independently of code
- Version format: `GOLD_SET_v1.2`
- Changes logged in manifest

---

### Addition Criteria

New manuscripts added when:
- Represents new genre/format not covered
- Captures repeated incident pattern
- Balances quality distribution

---

### Removal Criteria

Manuscripts removed when:
- No longer representative
- Superseded by better example
- Calibration stability maintained without it

**Minimum set size: 20** (never go below)

---

## H. Calibration Report Structure

### Executive Summary
- Pass/fail determination
- Overall accuracy
- Confidence calibration status

---

### Detailed Findings

Per manuscript:
- Accuracy score
- Confidence distribution
- Flagged issues

---

### Band Analysis

| Band | Claim Count | Actual Correctness | Target | Status |
|------|------------|-------------------|--------|--------|
| HIGH | 450 | 96% | ≥95% | ✅ PASS |
| MEDIUM | 230 | 87% | 80-94% | ✅ PASS |
| LOW | 120 | 62% | No req | N/A |

---

### Recommendations

- Any needed threshold adjustments
- Dimension re-weighting proposals
- Test suite additions

---

## I. Test Integration

### Automated Tests

The following automated tests run against gold set:

1. **Accuracy Test** (RG-GOLD-01)
   - Overall accuracy ≥92%
   - Evidence: Calibration report

2. **Calibration Test** (RG-GOLD-02)
   - HIGH band correctness ≥95%
   - Evidence: Band analysis table

3. **Drift Test** (RG-GOLD-03)
   - Confidence drift <5%
   - Evidence: Trend comparison (current vs baseline)

4. **Determinism Test** (RG-GOLD-04)
   - Re-run same manuscript → identical results
   - Evidence: Repeated evaluation logs

---

## J. Governance Rules

### No Manual Overrides

- Calibration failures cannot be "explained away"
- Release blocked until fixed or gold set updated

---

### Transparency

- All gold set changes logged
- All calibration reports archived
- All regression failures visible in Control Tower

---

### Accountability

- Calibration owner: RevisionGrade
- Regression execution owner: Base44
- Dispute resolution: Joint governance review

---

**Authority:** RevisionGrade Quality Standard  
**Binding Status:** Release-Blocking  
**Gold Set Owner:** RevisionGrade  
**CI Implementation Owner:** Base44  
**Review Cycle:** Monthly (incidents), Quarterly (full recalibration)