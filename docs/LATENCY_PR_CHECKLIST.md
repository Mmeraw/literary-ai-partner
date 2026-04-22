# Latency PR Acceptance Checklist

Purpose:
Ensure latency improvements do not degrade evaluation correctness, schema integrity, or judgment quality.

Core Rule: Latency optimization is a constrained optimization problem, not a race to smaller numbers.

## Global Acceptance Criteria

A latency PR is acceptable only if all three hold:

- Contract Integrity (schema + parsing intact)
- Behavioral Quality (no degradation in evaluation output)
- Measured Latency Reduction (across repeated runs)

If any one fails -> PR must not be merged.

## PASS 1 — Craft Execution Checklist

Guiding Principle:

You are allowed to remove verbosity — you are not allowed to remove judgment.

### 1) Contract Integrity (Non-Negotiable)

- [ ] Schema unchanged
- [ ] All 13 criteria present
- [ ] Each criterion has:
  - [ ] score_0_10
  - [ ] rationale
  - [ ] evidence
  - [ ] recommendations
- [ ] No parse failures or boundary errors
- [ ] No increase in JSON repair/fallback behavior
- [ ] All tests pass

### 2) Craft Evaluation Quality

- [ ] Rationales are specific (not generic summaries)
- [ ] Rationales reference actual craft elements
- [ ] Evidence is text-anchored
- [ ] Evidence snippets are meaningful (not trivial/repeated)
- [ ] Recommendations are actionable and concrete
- [ ] No templated or repetitive phrasing across criteria

Mandatory Spot Check:

- [ ] Review >=2 full outputs
- [ ] Confirm:
  - [ ] no boilerplate drift
  - [ ] no loss of nuance
  - [ ] reasoning still present

### 3) Behavioral Stability

- [ ] No increase in QG failure rate
- [ ] No increase in independence violations beyond baseline variance
- [ ] Pass 3 synthesis quality unaffected (spot check)

> ⚠️ Independence violations must be compared against a baseline rate, not a single run.

### 4) Latency Measurement

- [ ] Baseline defined
- [ ] >=2–3 traced runs post-change
- [ ] Improvement observed vs baseline

Required metrics:

- [ ] pass1_ms
- [ ] model_call_ms
- [ ] completion_tokens
- [ ] output_chars
- [ ] Variance documented

### 5) Compression Safety

- [ ] Reduction removes redundancy, not reasoning
- [ ] Reasoning steps still present
- [ ] Evidence count remains useful
- [ ] Recommendations remain grounded

## PASS 2 — Editorial (Reference Only)

(Already proven pattern — keep as lighter guardrail)

- [ ] Remove non-value obligations
- [ ] Preserve independence
- [ ] Maintain rationale usefulness
- [ ] Measure across multiple runs

## PASS 3 — Synthesis Checklist

Guiding Principle:

Pass 3 is the judge, not the stenographer.
You can compress language — you cannot compress judgment.

### 1) Contract Integrity

- [ ] Schema unchanged
- [ ] All 13 criteria present
- [ ] Each criterion has:
  - [ ] final_score_0_10
  - [ ] final_rationale
- [ ] No parse failures
- [ ] No missing criteria

### 2) Synthesis Quality

- [ ] Rationales reflect synthesis (not copying Pass 1/2)
- [ ] Disagreements are resolved (not ignored)
- [ ] No auto-confirmation bias
- [ ] No trivial outputs ("Confirmed." pattern)
- [ ] Reasoning present behind final scores

Mandatory Spot Check:

- [ ] Review >=2 outputs
- [ ] Confirm:
  - [ ] disagreements handled correctly
  - [ ] reasoning preserved
  - [ ] no mechanical compression

### 3) Divergence Handling (Measured Gate)

Capture and compare:

- [ ] criteria_count_by_state: agree / soft_divergence / hard_divergence

Distribution is stable vs baseline:

- [ ] Stable distribution
- [ ] No disappearance of hard divergences

Hard Rule:

- ❌ If hard divergences systematically disappear -> REJECT PR
- ❌ If soft divergences collapse into agreement -> REJECT PR

### 4) Behavioral Stability

- [ ] No increase in QG failures
- [ ] No loss of disagreement signals
- [ ] Final scoring distribution remains plausible
- [ ] Outputs remain consistent with Pass 1 + Pass 2

### 5) Latency Measurement

- [ ] Baseline defined
- [ ] >=2–3 traced runs
- [ ] Improvement observed

Required metrics:

- [ ] pass3_ms
- [ ] model_call_ms
- [ ] completion_tokens
- [ ] comparison_packet_chars
- [ ] Variance documented

### 6) Compression Safety

- [ ] Reasoning still present
- [ ] No trivialization of outputs
- [ ] No loss of nuance in edge cases

## HARD STOP CONDITIONS (GLOBAL)

- ❌ Schema breaks
- ❌ Parse failures increase
- ❌ QG failure rate increases materially
- ❌ Independence violations exceed baseline variance
- ❌ Rationales become generic or templated
- ❌ Divergences are flattened or ignored
- ❌ Latency gain comes from loss of reasoning quality

## FINAL RULE

We are removing non-value work — not reducing intelligence.
