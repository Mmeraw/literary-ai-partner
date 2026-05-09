# Reliability Incident Ledger (Seed)

This ledger tracks governance-significant incidents and correction records tied to reliable closure semantics.

## Entries

| incident_id | type | subcode | surface | closure_certified | evidence | notes | recorded_at |
|---|---|---|---|---|---|---|---|
| RL-2026-05-09-001 | governance_failure | false_completion_report | agent_work_report | false | Claimed `docs/reliability/*` + root `README.md` updates absent from `main` at audit time | Treated as non-runtime reliability incident; requires artifact-backed closure only. | 2026-05-09 |
| RL-2026-05-09-002 | status_correction | merged_state_correction | pr_status | true | PR #388 merged on `main` at commit `2a03965c1256a199966194d0d361ef68079e7c76` | Treat as landed substrate step, not closure of #384 architecture track. | 2026-05-09 |
| RL-2026-05-09-003 | classification | mitigation_scope | pass3_surface_integrity | true | PR #365 merged with explicit post-normalization/pre-render scope | Classify as pre-#384 mitigation; not upstream architecture correction for chunk map-reduce substrate. | 2026-05-09 |
