# Phase 2.5 Stage Validation Report

## Scope

- ingest
- extraction
- validation
- apply
- fail-closed classification on bad inputs
- repeated-run byte identity
- persisted machine-readable evidence

## Metrics

- success_case_total: 5
- success_case_passed: 5
- failure_case_total: 3
- failure_case_passed: 3
- ingest_count_total: 9
- extracted_count_total: 9
- validated_count_total: 9
- applied_count_total: 9
- repeated_run_identity_passed: true
- pass: true

## Success cases

- happy-single-proposal: output_match=true, repeat_output_match=true, repeat_pipeline_identity_match=true
- happy-multi-proposal-unicode: output_match=true, repeat_output_match=true, repeat_pipeline_identity_match=true
- literary-prose: output_match=true, repeat_output_match=true, repeat_pipeline_identity_match=true
- dialogue-punctuation: output_match=true, repeat_output_match=true, repeat_pipeline_identity_match=true
- multi-paragraph-spacing: output_match=true, repeat_output_match=true, repeat_pipeline_identity_match=true

## Failure cases

- malformed-ingest: classified_code=PARSE_ERROR, expected_code_match=true
- extraction-mismatch: classified_code=ANCHOR_MISS, expected_code_match=true
- apply-preflight-overlap: classified_code=OFFSET_CONFLICT, expected_code_match=true
