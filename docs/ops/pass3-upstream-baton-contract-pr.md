# Pass 3 upstream baton contract diagnosis

This branch is for COMET review. Do not merge from ChatGPT.

## Confirmed root cause

Pass 3A reducer failure can be persisted as `pass3_preflight_draft_v1` with all-null placeholder criteria and blank whole-novel fields. Downstream Phase 3B can then consume that artifact as if it were usable preflight. `QG_SHORT_REC` is a downstream symptom, not the root cause.

Do not recalibrate `QG_SHORT_REC` in this fix.

## Production artifact inventory

| Artifact | Size | Created | Usable? |
|---|---:|---|---|
| `pass3_preflight_draft_v1` | 4.6KB | 1:18 UTC / job creation | No — stale placeholder |
| `pass1a_chunk_cache_v1` | 431KB | 1:18 UTC | Yes — real chunk data |
| `pass1a_character_ledger_v1` | 368KB | 1:25 UTC | Yes — real Pass 1A output |
| `pass12_handoff_v1` | 13KB | 1:39 UTC | Yes — real Pass 1 + Pass 2 present |
| `pass_outputs_diagnostic_v1` | 45KB | 1:50 UTC | Yes — diagnostic snapshot |
| `quality_gate_diagnostics_v1` | 6.8KB | 1:50 UTC | Yes — gate results |

Critical finding: `pass12_handoff_v1` exists, was written after Phase 2 completed, and contains real data. The preview shows `pass1Output` with populated criteria, scores, and evidence, including `concept` score 7 with substantive rationale beginning `Distinct high-concept fusion of amphibian society...`.

Therefore this is not a Phase 2 baton-write failure. Phase 2 wrote a valid baton. The defect is Phase 3 read-wiring / stale preflight consumption: Phase 3 either did not read `pass12_handoff_v1`, read the wrong artifact, or let the stale `pass3_preflight_draft_v1` placeholder influence Pass 3B as if it were real independent-read output.

## Operational implication

A full re-run should not be required. Phase 1 and Phase 2 outputs are intact. After the Phase 3 wiring/contract bug is fixed, the failed job should be resumable from Phase 3 using the existing `pass12_handoff_v1`.

## Fix track 1: preflight authority semantics

Branch target name proposed by Mike: `fix/pass3a-preflight-authority-semantics`.

Required behavior:

- If Pass 3A reducer fails, set `preflight_authority = "unavailable"`.
- Add reducer health metadata to the persisted artifact:
  - `reducer_status: "ok" | "failed" | "invalid_empty"`
  - `reducer_failure_reason: string | null`
- `buildCompactPreflightSummary()` must return `PREFLIGHT UNAVAILABLE` if reducer status is not `ok`.
- Empty/all-null criterion drafts must never be injected into Pass 3B as usable independent-read evidence.

## Fix track 2: Phase 3 upstream contract validator

Branch target name proposed by Mike: `fix/phase3-upstream-contract-validator`.

Add `assertPass2HandoffReady()` at the Phase 3 boundary before reducers or quality gates run.

Required error codes:

- `UPSTREAM_HANDOFF_MISSING`
- `UPSTREAM_HANDOFF_STALE`
- `UPSTREAM_HANDOFF_SCHEMA_MISMATCH`
- `UPSTREAM_HANDOFF_EMPTY`
- `UPSTREAM_HANDOFF_PARTIAL`

Required behavior:

- Phase 3 must refuse to run if `pass12_handoff_v1` is absent, stale, schema-incompatible, structurally empty, or partial.
- Quality Gate must not run when upstream contract validation fails.
- Job failure should surface the specific upstream contract error, not a downstream QG code.
- If `pass12_handoff_v1` is valid, Phase 3 must prefer it as the required baton and treat `pass3_preflight_draft_v1` as optional/degraded input only.

## Acceptance tests required

1. Missing handoff -> `UPSTREAM_HANDOFF_MISSING`.
2. Schema mismatch -> `UPSTREAM_HANDOFF_SCHEMA_MISMATCH`.
3. Stale timestamp -> `UPSTREAM_HANDOFF_STALE`.
4. Job ID mismatch -> `UPSTREAM_HANDOFF_STALE`.
5. Missing required criteria -> `UPSTREAM_HANDOFF_PARTIAL`.
6. All criteria empty -> `UPSTREAM_HANDOFF_EMPTY`.
7. Whole-novel evidence empty -> `UPSTREAM_HANDOFF_EMPTY`.
8. Recommendations required but missing -> `UPSTREAM_HANDOFF_PARTIAL`.
9. Minimally valid handoff passes.
10. Valid `pass12_handoff_v1` plus stale placeholder preflight must still allow Phase 3 to synthesize from the handoff while suppressing preflight.
11. Quality Gate must not run when upstream contract validation fails.
12. `QG_SHORT_REC` remains unchanged.

## Production verification SQL

```sql
select
  artifact_type,
  created_at,
  updated_at,
  content ? 'pass1' as has_pass1,
  content ? 'pass2' as has_pass2,
  jsonb_typeof(content) as content_type,
  left(content::text, 1000) as preview
from evaluation_artifacts
where job_id = '<JOB_ID>'
  and artifact_type in (
    'pass1a_character_ledger_v1',
    'pass3_preflight_draft_v1',
    'pass12_handoff_v1',
    'quality_gate_diagnostics_v1',
    'pass_outputs_diagnostic_v1'
  )
order by created_at;
```

## Non-goals

- No merge from ChatGPT.
- No QG threshold changes.
- No scoring changes.
- No WAVE behavior changes.
- No full re-run requirement if Phase 3 can resume from the existing handoff.
