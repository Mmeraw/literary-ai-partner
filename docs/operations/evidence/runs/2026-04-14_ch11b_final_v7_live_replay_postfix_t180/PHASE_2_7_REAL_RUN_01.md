# PHASE_2_7_REAL_RUN_01

Input:
- Manuscript: ch11b mayan train approval final v7
- Length: 1002 words
- Source: `/workspaces/literary-ai-partner/manuscripts/ch11b-mayan-train-approval-final-v7.txt`
- Model: `gpt-4o-mini`
- Work type: `novel_chapter`

Pass 1:
- Raw output: `docs/operations/evidence/runs/2026-04-14_ch11b_final_v7_live_replay_postfix_t180/pass1_raw.json`
- Parsed output: `docs/operations/evidence/runs/2026-04-14_ch11b_final_v7_live_replay_postfix_t180/pass1_parsed.json`
- Observations:
  - criteria_count=13
  - average_score=7.38
  - recommendation_count=13
  - generic_recommendations=0

Pass 2:
- Raw output: `docs/operations/evidence/runs/2026-04-14_ch11b_final_v7_live_replay_postfix_t180/pass2_raw.json`
- Parsed output: `docs/operations/evidence/runs/2026-04-14_ch11b_final_v7_live_replay_postfix_t180/pass2_parsed.json`
- Observations:
  - criteria_count=13
  - average_score=7.38
  - recommendation_count=13
  - generic_recommendations=0

Pass 3:
- Raw output: `docs/operations/evidence/runs/2026-04-14_ch11b_final_v7_live_replay_postfix_t180/pass3_raw.json`
- Parsed output: `docs/operations/evidence/runs/2026-04-14_ch11b_final_v7_live_replay_postfix_t180/pass3_parsed.json`
- Observations:
  - overall_score_0_100=77
  - verdict=pass
  - avg_axis_delta=0.00
  - high_delta_criteria_count=0

Quality Gate:
- Pass/Fail: FAIL
- Issues detected:
  - pass=false
  - failed_checks=1
  - pass_independence:QG_INDEPENDENCE_VIOLATION

Conclusion:
- What broke:
  - Pipeline failed at pass4 with QG_INDEPENDENCE_VIOLATION.
- What needs prompt tuning:
  - Pass 1: tighten anti-generic rationale rule (require concrete anchor references in each criterion rationale).
  - Pass 2: require recommendation dedupe + stronger action specificity constraints tied to observed text behavior.
  - Pass 3: enforce stronger contradiction resolution guidance when craft/editorial deltas exceed 2 points.
