# PG-06B / RCA-005 Editorial Calibration Evidence

Status: evidence-first investigation, not a scoring or suppression-policy change.

## Scope

This record covers the first PG-06B pass over committed, non-secret repository evidence for zero-card and low-card evaluation outcomes.

It classifies observed cases into the RCA-005 categories requested for calibration work:

- correct governed suppression
- producer omission
- disposition/ownership loss
- canonicalization loss
- editorial under-generation
- unsupported threshold hypothesis

## Guardrail

No scoring, caps, thresholds, queue/admission behavior, or suppression policy should change merely because a strong-but-imperfect evaluation produced few cards.

Recommendation opportunity count is not a quota. Under `docs/governance/OPPORTUNITY_DISCOVERY_POLICY.md`, valid zero-card criteria require governed disposition metadata and a rationale; only then can the case be editorially adjudicated.

## Method

Added `scripts/governance/analyze-pg06b-editorial-calibration.ts` as an observational analyzer. It reads committed evaluation JSON and emits non-prose metrics only:

- score
- recommendation count
- evidence count
- `recommendation_status`
- status rationale presence
- canonical coverage issues from `analyzeGovernedOpportunityCoverage`
- structural classification

It intentionally excludes manuscript prose, evidence snippets, and recommendation text.

Targeted regression coverage lives in `tests/scripts/analyze-pg06b-editorial-calibration.test.ts`.

## Evidence scanned

Command output, generated from committed files only:

- Source files analyzed: 4
- Candidate cases: 4
- Total recommendation-present criteria: 13
- Valid governed suppression requiring editorial adjudication: 0
- Propagation gap / missing disposition: 24
- Invalid disposition metadata: 0
- Status/cardinality mismatch: 0
- Missing disposition rationale: 0
- Strong empty legacy-compatible criteria: 15

Candidate evidence files:

| Source | Total score | Recommendations | Weak zero-recommendation criteria | Primary classification |
| --- | ---: | ---: | ---: | --- |
| `evidence/phase-d/d2/agent-view-fixtures/fixture_set_v1/sample_evaluation_result_v1__sanitized.json` | 78 | 0 | 10 | disposition/ownership loss |
| `evidence/phase-d/d2/agent-view-fixtures/fixture_set_v1/sample_evaluation_result_v1__forbidden_language.json` | 85 | 0 | 5 | disposition/ownership loss |
| `docs/operations/evidence/runs/2026-04-14_ch11b_final_v7_live_replay_postfix_t180/pass3_raw.json` | 77 | 11 | 5 | disposition/ownership loss |
| `docs/operations/evidence/runs/2026-04-14_ch11b_final_v7_live_replay_postfix_t180b/pass3_raw.json` | 74 | 7 | 4 | disposition/ownership loss |

## Classification result

### Correct governed suppression

No committed case in this pass qualifies. A case would require zero recommendations plus a canonical governed `recommendation_status` and adequate `recommendation_status_rationale`.

### Producer omission

Not proven by this pass. Missing recommendations on weak criteria are present, but the observed artifacts also lack governed disposition metadata. That makes them structural propagation/disposition cases first, not evidence that the producer made an editorial omission.

### Disposition / ownership loss

Proven in committed evidence. All 24 weak zero-recommendation criteria found in this pass are missing governed disposition metadata. This aligns with the malformed disposition propagation defect already advanced by PR #1362 and REL-E005.

### Canonicalization loss

Not proven by this pass. The scanned JSON does not demonstrate that valid produced recommendations were lost during canonical opportunity ledger construction. That category requires comparing pre-canonical source recommendations to canonical ledger output for the same job.

### Editorial under-generation

Not proven by this pass. Because no valid governed zero-card cases were found, there is no safe basis to claim prompt/editorial under-generation. The correct next evidence would be post-#1362 evaluations where criteria carry valid governed no-recommendation statuses and rationales, followed by human editorial review of whether those rationales are legitimate.

### Unsupported threshold hypothesis

Rejected for this evidence pass. The data does not support changing score thresholds, caps, or suppression policy. Low/zero card count alone remains non-actionable under the opportunity discovery policy.

## Conclusion

The first PG-06B pass does not justify runtime or scoring changes. It confirms that available committed low/zero-card cases are primarily disposition/ownership loss artifacts, not editorial calibration proof.

Next evidence needed: post-#1362 production or redacted fixture cases containing canonical `recommendation_status` and rationale fields. Only those can separate correct governed suppression from true editorial under-generation.