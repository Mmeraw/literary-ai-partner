-- Evaluation Relay-Race Proof Query
--
-- Purpose:
--   Verify the locked relay-race evaluation contract for one job:
--
--     intake/chunking
--       -> phase_1a writes pass1a_character_ledger_v1 + pass3_preflight_draft_v1
--       -> phase_2 writes pass12_handoff_v1
--       -> phase_3 writes evaluation_result_v2 + longform_document_v1
--       -> wave_revision writes wave_revision_plan_v1 when eligible
--
-- Usage in Supabase SQL editor:
--   1. Replace the job id in the params CTE.
--   2. Run the query after a job reaches a terminal state OR while observing a run.
--   3. Treat relay_contract_state as the top-level verdict.
--
-- Interpretation:
--   PROOF_COMPLETE_BASE_REPORT:
--     Base evaluation has the required phase_1a, phase_2, and phase_3 baton artifacts.
--   PROOF_COMPLETE_WITH_WAVE:
--     Base evaluation plus wave_revision_plan_v1 exists.
--   WAITING_*:
--     Job is still in-flight and the next expected baton has not landed yet.
--   BROKEN_*:
--     The job state contradicts the relay contract and needs intervention.
--
-- Rule enforced by this query:
--   No phase may rerun all previous phases. If a baton is missing, go back to
--   the phase that writes that baton.

with params as (
  select '00000000-0000-0000-0000-000000000000'::uuid as job_id
),
job as (
  select
    j.id,
    j.manuscript_id,
    j.status,
    j.phase,
    j.phase_status,
    j.failure_code,
    j.last_error,
    j.attempt_count,
    j.max_attempts,
    j.claimed_by,
    j.worker_id,
    j.claimed_at,
    j.heartbeat_at,
    j.last_heartbeat_at,
    j.lease_until,
    j.created_at,
    j.updated_at,
    j.completed_at,
    j.progress
  from evaluation_jobs j
  join params p on p.job_id = j.id
),
artifacts as (
  select
    a.job_id,
    a.artifact_type,
    a.content,
    a.created_at,
    a.updated_at
  from evaluation_artifacts a
  join params p on p.job_id = a.job_id
  where a.artifact_type in (
    'pass1a_chunk_cache_v1',
    'pass1a_character_ledger_v1',
    'pass3_preflight_draft_v1',
    'pass12_handoff_v1',
    'evaluation_result_v2',
    'longform_document_v1',
    'wave_revision_plan_v1',
    'watchdog_rescue_v1',
    'quality_gate_diagnostics_v1',
    'pass_outputs_diagnostic_v1'
  )
),
artifact_flags as (
  select
    j.id as job_id,
    exists (select 1 from artifacts a where a.artifact_type = 'pass1a_chunk_cache_v1') as has_pass1a_chunk_cache,
    exists (select 1 from artifacts a where a.artifact_type = 'pass1a_character_ledger_v1') as has_pass1a_ledger,
    exists (select 1 from artifacts a where a.artifact_type = 'pass3_preflight_draft_v1') as has_pass3_preflight,
    exists (select 1 from artifacts a where a.artifact_type = 'pass12_handoff_v1') as has_pass12_handoff,
    exists (select 1 from artifacts a where a.artifact_type = 'evaluation_result_v2') as has_evaluation_result,
    exists (select 1 from artifacts a where a.artifact_type = 'longform_document_v1') as has_longform_document,
    exists (select 1 from artifacts a where a.artifact_type = 'wave_revision_plan_v1') as has_wave_revision_plan,
    exists (select 1 from artifacts a where a.artifact_type = 'watchdog_rescue_v1') as has_watchdog_rescue,
    exists (select 1 from artifacts a where a.artifact_type = 'quality_gate_diagnostics_v1') as has_quality_gate_diagnostics,
    exists (select 1 from artifacts a where a.artifact_type = 'pass_outputs_diagnostic_v1') as has_pass_outputs_diagnostic
  from job j
),
artifact_state as (
  select
    f.*,
    case
      when not f.has_pass1a_ledger then 'absent'
      when exists (
        select 1 from artifacts a
        where a.artifact_type = 'pass1a_character_ledger_v1'
          and (
            a.content ->> 'status' = 'empty'
            or (
              a.content -> 'ledger_v1' is null
              and a.content -> 'ledger_v2' is null
            )
          )
      ) then 'empty'
      else 'real'
    end as pass1a_ledger_state,
    case
      when not f.has_wave_revision_plan then 'absent'
      else coalesce(
        (
          select a.content ->> 'status'
          from artifacts a
          where a.artifact_type = 'wave_revision_plan_v1'
          order by coalesce(a.updated_at, a.created_at) desc
          limit 1
        ),
        'present_unknown_status'
      )
    end as wave_revision_state
  from artifact_flags f
),
proof as (
  select
    j.*,
    s.has_pass1a_chunk_cache,
    s.has_pass1a_ledger,
    s.pass1a_ledger_state,
    s.has_pass3_preflight,
    s.has_pass12_handoff,
    s.has_evaluation_result,
    s.has_longform_document,
    s.has_wave_revision_plan,
    s.wave_revision_state,
    s.has_watchdog_rescue,
    s.has_quality_gate_diagnostics,
    s.has_pass_outputs_diagnostic,
    coalesce(j.progress #>> '{pipeline_failure_diagnostics,diagnostics,failed_chunk_errors,0,error}',
             j.progress #>> '{pipeline_failure_diagnostics,failed_chunk_errors,0,error}',
             j.progress #>> '{diagnostics,failed_chunk_errors,0,error}') as first_failed_chunk_error,
    case
      when j.status = 'failed' and j.failure_code is not null then 'FAILED_WITH_NAMED_CODE'
      when j.status = 'failed' and j.failure_code is null then 'BROKEN_FAILED_WITHOUT_CODE'

      when j.phase = 'phase_1a' and j.status in ('queued', 'running') and not s.has_pass1a_ledger
        then 'WAITING_PHASE_1A_LEDGER'
      when j.phase = 'phase_1a' and j.status in ('queued', 'running') and s.pass1a_ledger_state = 'empty'
        then 'BROKEN_PHASE_1A_EMPTY_LEDGER'
      when j.phase = 'phase_1a' and s.has_pass1a_ledger and not s.has_pass3_preflight
        then 'WAITING_PHASE_1A_PREFLIGHT_OR_DEGRADED_HANDOFF'

      when j.phase = 'phase_2' and not s.has_pass1a_ledger
        then 'BROKEN_PHASE_2_MISSING_LEDGER_REQUEUE_PHASE_1A'
      when j.phase = 'phase_2' and s.pass1a_ledger_state = 'empty'
        then 'BROKEN_PHASE_2_EMPTY_LEDGER_REQUEUE_PHASE_1A'
      when j.phase = 'phase_2' and not s.has_pass12_handoff
        then 'WAITING_PHASE_2_PASS12_HANDOFF'
      when j.phase = 'phase_2' and s.has_pass12_handoff
        then 'PHASE_2_HANDOFF_READY_QUEUE_PHASE_3'

      when j.phase = 'phase_3' and not s.has_pass12_handoff
        then 'BROKEN_PHASE_3_MISSING_HANDOFF_REQUEUE_PHASE_2'
      when j.phase = 'phase_3' and s.has_pass12_handoff and not s.has_evaluation_result
        then 'WAITING_PHASE_3_EVALUATION_RESULT'
      when j.phase = 'phase_3' and s.has_evaluation_result and not s.has_longform_document
        then 'WAITING_PHASE_3_LONGFORM_DOCUMENT_OR_ASYNC_DREAM'
      when j.phase = 'phase_3' and s.has_evaluation_result and s.has_longform_document and not s.has_wave_revision_plan
        then 'BASE_REPORT_COMPLETE_WAVE_PENDING_OR_INELIGIBLE'
      when j.phase = 'phase_3' and s.has_evaluation_result and s.has_longform_document and s.has_wave_revision_plan
        then 'PROOF_COMPLETE_WITH_WAVE'

      when j.status = 'complete' and s.has_evaluation_result and s.has_longform_document and s.has_wave_revision_plan
        then 'PROOF_COMPLETE_WITH_WAVE'
      when j.status = 'complete' and s.has_evaluation_result and s.has_longform_document
        then 'PROOF_COMPLETE_BASE_REPORT'
      when j.status = 'complete' and not s.has_evaluation_result
        then 'BROKEN_COMPLETE_WITHOUT_EVALUATION_RESULT'
      when j.status = 'complete' and not s.has_longform_document
        then 'BROKEN_COMPLETE_WITHOUT_LONGFORM_DOCUMENT'

      else 'UNKNOWN_RELAY_STATE_REVIEW_ROW'
    end as relay_contract_state
  from job j
  join artifact_state s on s.job_id = j.id
)
select
  job_id,
  status,
  phase,
  phase_status,
  relay_contract_state,
  failure_code,
  last_error,
  first_failed_chunk_error,
  attempt_count,
  max_attempts,
  claimed_by,
  worker_id,
  claimed_at,
  coalesce(last_heartbeat_at, heartbeat_at) as heartbeat_at,
  lease_until,
  has_pass1a_chunk_cache,
  has_pass1a_ledger,
  pass1a_ledger_state,
  has_pass3_preflight,
  has_pass12_handoff,
  has_evaluation_result,
  has_longform_document,
  has_wave_revision_plan,
  wave_revision_state,
  has_watchdog_rescue,
  has_quality_gate_diagnostics,
  has_pass_outputs_diagnostic,
  created_at,
  updated_at,
  completed_at
from proof;
