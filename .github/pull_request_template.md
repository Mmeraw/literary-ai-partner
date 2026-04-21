# Latency PR — Evaluation Pipeline

## Summary

Describe the latency change in one sentence:

> Example: Reduce Pass 2 latency by removing non-value output obligations and tightening token ceiling.

---

## Scope (Strict)

- [ ] This PR affects **only one pass** (Pass 1 / Pass 2 / Pass 3)
- [ ] No unrelated refactors included
- [ ] No hidden scoring or schema changes

**Pass targeted:**
- [ ] Pass 1
- [ ] Pass 2
- [ ] Pass 3

---

## What Changed (Concrete)

List exactly what was removed or modified:

-
-
-

**Why these changes are non-value work:**

-
-
-

---

## Contract Integrity (Must Hold)

- [ ] Schema unchanged (or explicitly documented)
- [ ] All required fields present in outputs
- [ ] No new parse / JSON boundary failures
- [ ] No increase in fallback/repair behavior
- [ ] Full test suite passes (incl. targeted suites)

---

## Behavioral Quality Validation

### Spot Checks (Required)

- [ ] Reviewed ≥2 full outputs manually

**Observed quality:**

- [ ] Rationales remain specific (not generic)
- [ ] Evidence remains grounded and relevant
- [ ] Recommendations remain actionable
- [ ] No templated or repetitive phrasing

---

## Pass-Specific Quality Guards

### If Pass 1

- [ ] No loss of nuance in craft evaluation
- [ ] No reduction in meaningful evidence
- [ ] No increase in independence violations **beyond baseline variance**

> **Rule:** You are allowed to remove verbosity — you are not allowed to remove judgment.

---

### If Pass 2

- [ ] Independence preserved
- [ ] No drift toward Pass 1 phrasing
- [ ] Output remains differentiated and useful

---

### If Pass 3

- [ ] No “Confirmed.” collapse pattern
- [ ] Disagreements are resolved (not flattened)
- [ ] Final rationales contain reasoning (not just verdicts)

#### Divergence Distribution (Required)

Capture from `[Pass3][ReducerTelemetry]`:

`criteria_count_by_state:`
`agree: X`
`soft_divergence: X`
`hard_divergence: X`

**Comparison vs baseline:**

- [ ] Distribution stable
- [ ] No disappearance of hard divergences

> **Rule:** You can compress language — you cannot compress judgment.

---

## Latency Evidence (Measured)

### Baseline (Pre-change)

| Metric | Value |
|------|------|
| passX_ms | |
| model_call_ms | |
| completion_tokens | |
| total_ms | |

---

### Post-change Runs (≥2 required)

| Run | passX_ms | total_ms | completion_tokens | Notes |
|-----|--------|---------|------------------|------|
| Run 1 | | | | |
| Run 2 | | | | |
| Run 3 (optional) | | | | |

---

### Result

- [ ] Latency reduced vs baseline
- [ ] Improvement consistent (not single-run noise)
- [ ] Variance acknowledged

---

## Behavioral Stability

- [ ] No increase in Quality Gate failure rate
- [ ] No increase in independence violations beyond baseline variance
- [ ] No downstream degradation (Pass 3 / final output)

---

## Risks & Anomalies (Required Disclosure)

List anything unusual observed:

-
-
-

Example:

- QG_INDEPENDENCE_VIOLATION observed in 1/3 runs (within expected variance)

---

## Definition of Done

This PR is valid only if:

- [ ] Contract integrity preserved
- [ ] Evaluation quality maintained
- [ ] Latency measurably improved across runs

---

## Final Check

> **We are removing non-value work — not reducing intelligence.**

- [ ] This change removes unnecessary work (not reasoning)
- [ ] Output quality remains intact
- [ ] Latency gain is real and reproducible

---

## Optional: Evidence Artifacts

Link to logs / runs:

-
-

---

## Reviewer Notes

Focus review on:

- Whether removed elements truly had zero value
- Whether reasoning quality is preserved
- Whether latency gains are real (not noise)
