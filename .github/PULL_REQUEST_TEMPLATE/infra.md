## Summary

> Validation rule: blank sections, placeholder-only answers (for example, `TBD`, `TODO`, bare `N/A`) fail. Use `N/A — <reason>` when a section truly does not apply.

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

## Unauthorized Input Sources

<!-- Explicitly state all input sources this infra/repo change can influence (workflow_dispatch inputs, env vars, secrets, labels, branch names, file globs, etc.).
For each, describe authorization boundary and validation/sanitization path. If none: state "None". -->

## Internal Process Leakage

<!-- Confirm no internal process details are newly exposed in public-facing outputs (logs, artifacts, PR comments, annotations, status text).
List any sensitive fields reviewed and redacted/omitted. -->

## Input → Action → Output

<!-- Provide a concise flow map of input, action taken, and output produced.
Include failure-path behavior and safe user/operator-visible messaging. -->

## Public-Safe Quality/Status Metrics

<!-- List public-visible metrics/status signals and confirm they are safe (no secrets, no internal-only telemetry leakage).
If not applicable: state "N/A" with reason. -->

## Runtime/Pipeline Expansion

<!-- Declare whether this PR adds any new runtime calls, workers, jobs, routes, or pipeline paths.
If none: state "None" and explain why execution surface is unchanged. -->

## Latency Impact

<!-- Provide before/after latency impact evidence for CI/runtime path where relevant, or explain why no measurable increase is expected.
If impact exists, include mitigation and acceptance rationale. -->

## Branch Freshness (Never Behind)

<!-- Required merge gate: PR head must include current base HEAD. -->

Branch-Behind-Base: 0

## Risks & Anomalies

<!-- What could go wrong; how it's mitigated. -->

---

No-Pipeline-Impact: Confirmed — this PR does not modify lib/evaluation/**, app/api/workers/**, prompts, or any pipeline contract.

<!-- pr-type: infra -->
