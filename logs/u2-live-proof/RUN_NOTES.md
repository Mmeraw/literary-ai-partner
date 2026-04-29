# U2 Live Proof Run Notes (2026-04-29)

- Job ID: `f64c3266-f969-449a-aff4-18bfefcda9a6`
- Proof JSON: `logs/u2-live-proof/u2-proof-20260429T155922.json`
- Validator output: `logs/u2-live-proof/u2-proof-20260429T155922.validation.txt`
- Machine-derived verification pack: `logs/u2-live-proof/u2-artifact-verification-f64c3266-f969-449a-aff4-18bfefcda9a6-20260429T162556.json`

## Private-beta auth wall note

Rendered report URL (`https://www.revisiongrade.com/evaluate/f64c3266-f969-449a-aff4-18bfefcda9a6/report`) is private-beta gated and requires authenticated tester session.

Manual UI verification was therefore substituted with canonical persisted-data verification from:

- `evaluation_artifacts` row (`artifact_type=evaluation_result_v2`)
- `evaluation_jobs.progress.gate_enforcement.propagation`

This preserves doctrine: persisted artifact + job row are source of truth; UI fetch is a presentation surface.

## Doctrine sequencing note

Proof submission occurred before workbook flip of `RCA-PASS1-TOKEN-001` and is recorded as a deliberate override.
Structural prerequisite fix had already shipped in PR #249; workbook rows were reconciled after validator pass.
