<!-- Comet template-unification: enforcement-compliant default body. -->
<!-- DO NOT delete required ## headings unless your PR is migration/docs-only (auto-skipped by latency-pr-enforcement.yml). -->

## Summary

<!-- One-paragraph what + why. -->

## Scope

Pass selection (CHECK EXACTLY ONE — Pass 2 pre-checked as default):

- [ ] Pass 1
- [x] Pass 2
- [ ] Pass 3

Changed files:

-

Out of scope:

-

## Contract Integrity

-

## Behavioral Quality

This PR is not reducing intelligence.

<!-- Describe quality preservation. The phrase above is REQUIRED verbatim by enforcement. -->

## Latency Evidence

### Baseline (Pre-change)

| Run | pass2_ms | total_ms | Notes |
|---|---:|---:|---|
| Run 1 | N/A | N/A | |
| Run 2 | N/A | N/A | |

### Post-change Runs

| Run | pass2_ms | total_ms | Notes |
|---|---:|---:|---|
| Run 1 | N/A | N/A | |
| Run 2 | N/A | N/A | |

<!-- Required for Pass 3 PRs (validated by .github/workflows/latency-pr-enforcement.yml).
     Delete this entire block ONLY if your PR does not touch Pass 3. -->

## Divergence distribution (criteria_count_by_state)

```yaml
criteria_count_by_state:
  total_criteria: 13
  contract_compliant: 0
  agree: 0
  soft_divergence: 0
  hard_divergence: 0
  missing_or_invalid: 0
```

## Quality Gate / Anomalies

QG_<gate-id>: <description or "no QG_ behavior changes">

## Risks & Anomalies

-
