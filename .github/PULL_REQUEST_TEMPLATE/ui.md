## Summary

<!-- 1–3 sentences describing what changed visually or interactively. -->

## Scope

<!-- Which screens / components / routes are affected. What is explicitly NOT touched (e.g. evaluation pipeline, API workers). -->

## Visual Evidence

<!-- Before/after screenshots or short clips. For first-render surfaces: state "N/A — first render of <surface>" and include a screenshot of the new state. -->

| State | Before | After |
| --- | --- | --- |
|       |        |       |

## Accessibility

<!-- Color contrast notes, keyboard nav, ARIA labels, focus order. If no interactive surface added, state "N/A — no interactive surface added". -->

## Browser Targets

<!-- Default: Chrome, Safari, Firefox latest. Note any browser-specific concerns. -->

- Chrome latest: ✅
- Safari latest: ✅
- Firefox latest: ✅

## Unauthorized Input Sources

<!-- Explicitly state all input sources used by this UI path (user form, query params, headers, local storage, etc.).
For each, describe authorization boundary and validation/sanitization path. If none: state "None". -->

## Internal Process Leakage

<!-- Confirm no internal process details are exposed (internal IDs, worker state internals, stack traces, hidden control-flow signals).
List any sensitive fields reviewed and redacted/omitted. -->

## Input → Action → Output

<!-- Provide a concise flow map of UI input, action taken, and output rendered.
Include failure path behavior and user-facing error contract (safe + non-sensitive). -->

## Public-Safe Quality/Status Metrics

<!-- List user-visible metrics/status indicators and confirm they are public-safe (no internal-only telemetry leakage).
If not applicable: state "N/A" with reason. -->

## Runtime/Pipeline Expansion

<!-- Declare whether this PR adds any new runtime calls, workers, API routes, or pipeline paths.
If none: state "None" and explain why execution surface is unchanged. -->

## Latency Impact

<!-- Provide before/after interaction latency evidence (or state why there is no measurable impact).
If impact exists, include mitigation and acceptance rationale. -->

## Branch Freshness (Never Behind)

<!-- Required merge gate: PR head must include current base HEAD. -->

Branch-Behind-Base: 0

## Risks & Anomalies

<!-- What could go wrong; how it's mitigated. -->

---

No-Pipeline-Impact: Confirmed — this PR does not modify lib/evaluation/**, app/api/workers/**, prompts, or any pipeline contract.

<!-- pr-type: ui -->
