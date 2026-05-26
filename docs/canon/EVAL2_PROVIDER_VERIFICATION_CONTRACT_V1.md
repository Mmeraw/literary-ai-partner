# Eval 2.0 Provider Verification Contract V1

## Purpose

This contract defines the boundary between RevisionGrade's primary editorial synthesis engine and optional external verification rails.

The core rule is simple: external providers may emit bounded, structured verification artifacts, but they may not inject unstructured prose into Phase 2 or Phase 3 literary synthesis.

## Provider roles

- `primary_editorial_engine`: the only provider role allowed to supply prose to literary synthesis.
- `external_factual_auditor`: an optional factual/plausibility audit rail that may emit `factual_anomalies_detected_v1` only.
- `external_compliance_checker`: an optional report cross-check rail that may emit `external_report_crosscheck_v1` only.

## Default posture

External verification rails are disabled by default. Any runtime integration must explicitly enable the relevant feature flag and must preserve the artifact-only boundary.

## Allowed artifacts

### `factual_anomalies_detected_v1`

Permitted use: bounded factual/plausibility anomaly reporting.

Required boundary:

- no essay-form analysis;
- no report-ready prose;
- capped claim/reality/correction fields;
- no mutation of story authority artifacts;
- no direct synthesis input.

### `external_report_crosscheck_v1`

Permitted use: bounded compliance findings after synthesis.

Required boundary:

- verdict limited to `PASS` or `FAIL`;
- violations limited to structured rule fields;
- reason codes must remain routing tokens, not prose;
- contradicted ledger layer must be a positive 1-based integer;
- no direct rewrite of the report.

## Forbidden behavior

The following are forbidden in this contract:

- external provider prose entering Phase 2 or Phase 3 synthesis;
- external provider output becoming accepted story authority;
- broad manuscript sharing with an external provider without a separate explicit runtime contract;
- Perplexity/API/client wiring in this contract-only layer;
- prompt changes, worker changes, database writes, or report renderer changes.

## Runtime implication

Any future provider integration must pass through deterministic schema validation before its output can be persisted or considered. If validation fails, the artifact must be rejected or quarantined rather than softened into report prose.
