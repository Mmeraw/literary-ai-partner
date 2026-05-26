## Summary

<!-- 1–3 sentences describing the code change. -->

## Scope

<!-- Which modules / packages / endpoints are affected. What is explicitly NOT touched. -->

## Tests Updated

<!-- Yes/No. If Yes: list the test files added or modified. If No: explain why no tests are needed (e.g. trivial typo fix, refactor with existing coverage). -->

- Tests added/modified: <!-- list or "N/A — see explanation" -->

## Unauthorized Input Sources

<!-- Explicitly state all input sources used by this code path (request body/query/headers/cookies, storage, env, files, queue messages, etc.).
For each, describe authorization boundary and validation/sanitization path. If none: state "None". -->

## Internal Process Leakage

<!-- Confirm no internal process details are exposed (internal IDs, stack traces, worker internals, control-flow internals).
List any sensitive fields reviewed and redacted/omitted. -->

## Input → Action → Output

<!-- Provide a concise flow map of input, action taken, and output returned/rendered.
Include failure-path behavior and user-facing safe error contract. -->

## Public-Safe Quality/Status Metrics

<!-- List user/public-visible quality/status metrics and confirm they are safe (no internal-only telemetry leakage).
If not applicable: state "N/A" with reason. -->

## Runtime/Pipeline Expansion

<!-- Declare whether this PR adds any new runtime calls, workers, API routes, jobs, or pipeline paths.
If none: state "None" and explain why execution surface is unchanged. -->

## Latency Impact

<!-- Provide before/after latency evidence where measurable, or explain why no unnecessary latency increase is expected.
If impact exists, include mitigation and acceptance rationale. -->

## Branch Freshness (Never Behind)

<!-- Required merge gate: PR head must include current base HEAD. -->

Branch-Behind-Base: 0

## Risks & Anomalies

<!-- What could go wrong; how it's mitigated. -->

---

No-Pipeline-Impact: Confirmed — this PR does not modify lib/evaluation/**, app/api/workers/**, prompts, or any pipeline contract.

<!-- pr-type: code -->
