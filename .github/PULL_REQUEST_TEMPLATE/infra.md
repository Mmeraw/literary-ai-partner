## Summary

<!-- 1–3 sentences describing the CI / infra / config change. -->

## Scope

<!-- Which workflows / config files / dependencies are affected. What is explicitly NOT touched. -->

## CI/Infra Scope

<!-- Concretely: which workflows run differently after this PR? Which environments? Which actions/runners/permissions changed? -->

## Rollback Plan

<!-- How to revert if this causes problems in production CI. -->

## Affected Workflows

<!-- Name each workflow file modified, added, or whose behavior is changed by this PR. -->

- `.github/workflows/<filename>.yml` — what changes

## Risks & Anomalies

<!-- What could go wrong; how it's mitigated. -->

---

No-Pipeline-Impact: Confirmed — this PR does not modify lib/evaluation/**, app/api/workers/**, prompts, or any pipeline contract.

<!-- pr-type: infra -->
