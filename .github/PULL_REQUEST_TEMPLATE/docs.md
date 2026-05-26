## Summary

<!-- 1–3 sentences describing what doc changes and why. -->

## Scope

<!-- Which docs / governance briefs / READMEs are affected. -->

## Unauthorized Input Sources

<!-- Document any input source described/introduced by this docs change and confirm authorized boundaries + validation handling remain accurate.
If none: state "None". -->

## Internal Process Leakage

<!-- Confirm docs do not disclose internal-only process details, secret handling paths, or sensitive internals not intended for public consumption. -->

## Input → Action → Output

<!-- Document the intended user-facing Input → Action → Output contract clarified by this docs change.
If no behavioral contract is described, state "N/A" and why. -->

## Public-Safe Quality/Status Metrics

<!-- Confirm any metrics/status language is public-safe and does not expose internal-only telemetry semantics. -->

## Runtime/Pipeline Expansion

<!-- Confirm this docs PR does not introduce hidden runtime/pipeline expansion claims.
If none: state "None". -->

## Latency Impact

<!-- Confirm no unnecessary latency increase is introduced by the described behavior.
For docs-only edits, state "None — documentation only". -->

## Branch Freshness (Never Behind)

<!-- Required merge gate: PR head must include current base HEAD. -->

Branch-Behind-Base: 0

## Risks & Anomalies

<!-- What could go wrong (e.g. doc contradicts code; outdated link; misleading example); how it's mitigated. -->

---

No-Pipeline-Impact: Confirmed — this PR does not modify lib/evaluation/**, app/api/workers/**, prompts, or any pipeline contract.

<!-- pr-type: docs -->
