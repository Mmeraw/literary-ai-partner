drop policy if exists "audit_entries_insert_service" on "public"."audit_entries";

drop policy if exists "audit_entries_read_own" on "public"."audit_entries";

drop policy if exists "evaluation_jobs_insert_own" on "public"."evaluation_jobs";

revoke delete on table "public"."audit_entries" from "anon";

revoke insert on table "public"."audit_entries" from "anon";

revoke references on table "public"."audit_entries" from "anon";

revoke select on table "public"."audit_entries" from "anon";

revoke trigger on table "public"."audit_entries" from "anon";

revoke truncate on table "public"."audit_entries" from "anon";

revoke update on table "public"."audit_entries" from "anon";

revoke delete on table "public"."audit_entries" from "authenticated";

revoke insert on table "public"."audit_entries" from "authenticated";

revoke references on table "public"."audit_entries" from "authenticated";

revoke select on table "public"."audit_entries" from "authenticated";

revoke trigger on table "public"."audit_entries" from "authenticated";

revoke truncate on table "public"."audit_entries" from "authenticated";

revoke update on table "public"."audit_entries" from "authenticated";

revoke delete on table "public"."audit_entries" from "service_role";

revoke insert on table "public"."audit_entries" from "service_role";

revoke references on table "public"."audit_entries" from "service_role";

revoke select on table "public"."audit_entries" from "service_role";

revoke trigger on table "public"."audit_entries" from "service_role";

revoke truncate on table "public"."audit_entries" from "service_role";

revoke update on table "public"."audit_entries" from "service_role";

alter table "public"."audit_entries" drop constraint if exists "chk_audit_actor";

alter table "public"."audit_entries" drop constraint if exists "chk_audit_event_type";

alter table "public"."audit_entries" drop constraint if exists "chk_audit_source";

alter table "public"."audit_entries" drop constraint if exists "chk_audit_status";

alter table "public"."audit_entries" drop constraint if exists "chk_audit_to_status";

alter table "public"."evaluation_artifacts" drop constraint if exists "evaluation_artifacts_manuscript_id_fkey";

alter table "public"."evaluation_artifacts" drop constraint if exists "unique_job_artifact";

drop function if exists "public"."admin_list_jobs"(p_status text, p_job_type text, p_phase text, p_policy_family text, p_created_after timestamp with time zone, p_created_before timestamp with time zone, p_failed_after timestamp with time zone, p_failed_before timestamp with time zone, p_cursor_failed_at timestamp with time zone, p_cursor_created_at timestamp with time zone, p_cursor_id uuid, p_limit integer);

drop function if exists "public"."admin_retry_job"(p_job_id uuid);

drop function if exists "public"."increment_job_attempt_count"(p_job_id uuid, p_timestamp timestamp with time zone);

drop function if exists "public"."claim_job_atomic"(p_worker_id text, p_now timestamp with time zone, p_lease_seconds integer);

alter table "public"."audit_entries" drop constraint if exists "audit_entries_pkey";

drop index if exists "public"."audit_entries_pkey";

drop index if exists "public"."idx_audit_entries_decision_code";

drop index if exists "public"."idx_audit_entries_event_type";

drop index if exists "public"."idx_audit_entries_job_id";

drop index if exists "public"."idx_audit_entries_ok";

drop index if exists "public"."idx_audit_entries_ts";

drop index if exists "public"."idx_evaluation_artifacts_manuscript_id";

drop index if exists "public"."idx_evaluation_jobs_failure_envelope";

drop index if exists "public"."idx_evaluation_jobs_retry_timing";

drop index if exists "public"."manuscript_chunks_processing_started_idx";

drop index if exists "public"."manuscript_chunks_retry_idx";

drop index if exists "public"."unique_job_artifact";

drop table "public"."audit_entries";

alter table "public"."evaluation_artifacts" drop column if exists "artifact_version";

alter table "public"."evaluation_artifacts" drop column if exists "content";

alter table "public"."evaluation_artifacts" drop column if exists "manuscript_id";

alter table "public"."evaluation_artifacts" drop column if exists "source_hash";

alter table "public"."evaluation_artifacts" drop column if exists "source_phase";

alter table "public"."evaluation_artifacts" drop column if exists "updated_at";

alter table "public"."evaluation_artifacts" add column if not exists "artifact_payload" jsonb;

alter table "public"."evaluation_jobs" drop column if exists "failure_envelope";

alter table "public"."evaluation_jobs" drop column if exists "last_attempt_at";

alter table "public"."evaluation_jobs" add column if not exists "phase_1_attempt_count" integer default 0;

alter table "public"."evaluation_jobs" add column if not exists "phase_1_completed_at" timestamp with time zone;

alter table "public"."evaluation_jobs" add column if not exists "phase_1_error" text;

alter table "public"."evaluation_jobs" add column if not exists "phase_1_locked_at" timestamp with time zone;

alter table "public"."evaluation_jobs" add column if not exists "phase_1_locked_by" text;

alter table "public"."evaluation_jobs" add column if not exists "phase_1_started_at" timestamp with time zone;

alter table "public"."evaluation_jobs" add column if not exists "phase_1_status" text default 'not_started'::text;

alter table "public"."manuscript_chunks" add column if not exists "error" text;

alter table "public"."manuscript_chunks" alter column "manuscript_id" set data type integer using "manuscript_id"::integer;

CREATE INDEX IF NOT EXISTS evaluation_artifacts_job_id_idx ON public.evaluation_artifacts USING btree (job_id);

CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_phase_1_locked ON public.evaluation_jobs USING btree (phase_1_locked_at) WHERE (phase_1_locked_at IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_phase_1_status ON public.evaluation_jobs USING btree (phase_1_status);

CREATE INDEX IF NOT EXISTS idx_manuscript_chunks_lease_expires_at ON public.manuscript_chunks USING btree (lease_expires_at) WHERE (status = 'processing'::public.chunk_status);

CREATE INDEX IF NOT EXISTS idx_manuscript_chunks_manuscript_id ON public.manuscript_chunks USING btree (manuscript_id);

CREATE INDEX IF NOT EXISTS idx_manuscript_chunks_status_lease ON public.manuscript_chunks USING btree (status, lease_expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS uq_eval_jobs_active_phase1 ON public.evaluation_jobs USING btree (manuscript_id, job_type) WHERE ((phase = 'phase_1'::text) AND (status = ANY (ARRAY['queued'::text, 'running'::text])));

CREATE UNIQUE INDEX IF NOT EXISTS uq_eval_jobs_active_phase1_worktype ON public.evaluation_jobs USING btree (manuscript_id, job_type, work_type) WHERE ((phase = 'phase_1'::text) AND (status = ANY (ARRAY['queued'::text, 'running'::text])));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'evaluation_jobs_phase_1_status_check'
      and conrelid = 'public.evaluation_jobs'::regclass
  ) then
    alter table "public"."evaluation_jobs" add constraint "evaluation_jobs_phase_1_status_check" CHECK ((phase_1_status = ANY (ARRAY['not_started'::text, 'in_progress'::text, 'completed'::text, 'failed'::text]))) not valid;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'evaluation_jobs_phase_1_status_check'
      and conrelid = 'public.evaluation_jobs'::regclass
      and convalidated = false
  ) then
    alter table "public"."evaluation_jobs" validate constraint "evaluation_jobs_phase_1_status_check";
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'evaluation_jobs_phase_chk'
      and conrelid = 'public.evaluation_jobs'::regclass
  ) then
    alter table "public"."evaluation_jobs" add constraint "evaluation_jobs_phase_chk" CHECK ((phase = ANY (ARRAY['phase_0'::text, 'phase_1'::text, 'phase_2'::text]))) not valid;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'evaluation_jobs_phase_chk'
      and conrelid = 'public.evaluation_jobs'::regclass
      and convalidated = false
  ) then
    alter table "public"."evaluation_jobs" validate constraint "evaluation_jobs_phase_chk";
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'attempt_count_non_negative'
      and conrelid = 'public.manuscript_chunks'::regclass
  ) then
    alter table "public"."manuscript_chunks" add constraint "attempt_count_non_negative" CHECK ((attempt_count >= 0)) not valid;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'attempt_count_non_negative'
      and conrelid = 'public.manuscript_chunks'::regclass
      and convalidated = false
  ) then
    alter table "public"."manuscript_chunks" validate constraint "attempt_count_non_negative";
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'manuscript_chunks_attempts_check'
      and conrelid = 'public.manuscript_chunks'::regclass
  ) then
    alter table "public"."manuscript_chunks" add constraint "manuscript_chunks_attempts_check" CHECK (((attempt_count >= 0) AND (max_attempts >= 1) AND (attempt_count <= 1000) AND (max_attempts <= 1000))) not valid;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'manuscript_chunks_attempts_check'
      and conrelid = 'public.manuscript_chunks'::regclass
      and convalidated = false
  ) then
    alter table "public"."manuscript_chunks" validate constraint "manuscript_chunks_attempts_check";
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'max_attempts_positive'
      and conrelid = 'public.manuscript_chunks'::regclass
  ) then
    alter table "public"."manuscript_chunks" add constraint "max_attempts_positive" CHECK ((max_attempts > 0)) not valid;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'max_attempts_positive'
      and conrelid = 'public.manuscript_chunks'::regclass
      and convalidated = false
  ) then
    alter table "public"."manuscript_chunks" validate constraint "max_attempts_positive";
  end if;
end $$;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.admin_retry_job(p_job_id uuid, p_reason text DEFAULT NULL::text, p_actor uuid DEFAULT NULL::uuid)
 RETURNS TABLE(job_id uuid, status text, changed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH target AS (
    SELECT j.id, j.status, j.attempt_count, j.failed_at, j.next_attempt_at
    FROM public.evaluation_jobs j
    WHERE j.id = p_job_id
    FOR UPDATE
  ),
  updated AS (
    UPDATE public.evaluation_jobs j
    SET
      status = 'queued',
      next_attempt_at = now(),
      failed_at = NULL,
      worker_id = NULL,
      lease_token = NULL,
      lease_until = NULL,
      heartbeat_at = NULL,
      updated_at = now()
    FROM target t
    WHERE j.id = t.id
      AND t.status = 'failed'
      AND (j.lease_until IS NULL OR j.lease_until <= now())
    RETURNING
      j.id,
      j.status,
      t.status AS before_status,
      t.attempt_count AS before_attempt_count,
      t.failed_at AS before_failed_at,
      t.next_attempt_at AS before_next_attempt_at,
      j.attempt_count AS after_attempt_count,
      j.failed_at AS after_failed_at,
      j.next_attempt_at AS after_next_attempt_at
  ),
  audit AS (
    INSERT INTO public.admin_actions (
      action_type,
      job_id,
      performed_by,
      performed_at,
      before_status,
      before_attempt_count,
      before_failed_at,
      before_next_attempt_at,
      after_status,
      after_attempt_count,
      after_failed_at,
      after_next_attempt_at,
      reason
    )
    SELECT
      'retry_job',
      u.id,
      p_actor,
      now(),
      u.before_status,
      u.before_attempt_count,
      u.before_failed_at,
      u.before_next_attempt_at,
      u.status,
      u.after_attempt_count,
      u.after_failed_at,
      u.after_next_attempt_at,
      p_reason
    FROM updated u
  )
  SELECT
    COALESCE(u.id, t.id) AS job_id,
    COALESCE(u.status, t.status) AS status,
    (u.id IS NOT NULL) AS changed
  FROM target t
  LEFT JOIN updated u ON true;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_job_atomic(p_worker_id text, p_now timestamp with time zone, p_lease_seconds integer)
 RETURNS TABLE(id uuid, manuscript_id bigint, job_type text, policy_family text, voice_preservation_level text, english_variant text, work_type text, phase text, status text, lease_token uuid, lease_until timestamp with time zone, attempt_count integer, max_attempts integer, next_attempt_at timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_job_id UUID;
BEGIN
  SELECT j.id INTO v_job_id
  FROM public.evaluation_jobs j
  WHERE j.status = 'queued'
    AND (j.lease_until IS NULL OR j.lease_until < p_now)
    AND (j.next_attempt_at IS NULL OR j.next_attempt_at <= p_now)
    AND (j.attempt_count < j.max_attempts)
  ORDER BY j.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_job_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.evaluation_jobs
  SET
    status = 'running',
    worker_id = p_worker_id,
    lease_token = gen_random_uuid(),
    lease_until = p_now + make_interval(secs => p_lease_seconds),
    heartbeat_at = p_now,
    started_at = COALESCE(started_at, p_now),
    updated_at = p_now,
    next_attempt_at = NULL,
    attempt_count = public.evaluation_jobs.attempt_count + 1
  WHERE evaluation_jobs.id = v_job_id;

  RETURN QUERY
  SELECT
    j.id AS id,
    j.manuscript_id AS manuscript_id,
    j.job_type AS job_type,
    j.policy_family AS policy_family,
    j.voice_preservation_level AS voice_preservation_level,
    j.english_variant AS english_variant,
    j.work_type AS work_type,
    j.phase AS phase,
    j.status AS status,
    j.lease_token AS lease_token,
    j.lease_until AS lease_until,
    j.attempt_count AS attempt_count,
    j.max_attempts AS max_attempts,
    j.next_attempt_at AS next_attempt_at
  FROM public.evaluation_jobs j
  WHERE j.id = v_job_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.renew_lease(p_job_id uuid, p_worker_id text, p_lease_token uuid, p_now timestamp with time zone, p_lease_seconds integer)
 RETURNS TABLE(success boolean, new_lease_until timestamp with time zone, new_heartbeat_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_current_token UUID;
  v_new_lease_until TIMESTAMPTZ;
BEGIN
  SELECT lease_token INTO v_current_token
  FROM public.evaluation_jobs
  WHERE id = p_job_id
    AND worker_id = p_worker_id
    AND status = 'running'
  FOR UPDATE;

  IF v_current_token IS NULL OR v_current_token != p_lease_token THEN
    RETURN QUERY SELECT FALSE, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  v_new_lease_until := p_now + make_interval(secs => p_lease_seconds);

  UPDATE public.evaluation_jobs
  SET
    lease_until = v_new_lease_until,
    heartbeat_at = p_now,
    updated_at = p_now
  WHERE id = p_job_id
    AND status = 'running'
    AND worker_id = p_worker_id
    AND lease_token = p_lease_token;

  RETURN QUERY SELECT 
    TRUE AS success,
    v_new_lease_until AS new_lease_until,
    p_now AS new_heartbeat_at;
END;
$function$
;


do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'evaluation_jobs'
      and policyname = 'Allow anon insert on evaluation_jobs'
  ) then
    create policy "Allow anon insert on evaluation_jobs"
      on "public"."evaluation_jobs"
      as permissive
      for insert
      to anon, authenticated
    with check (true);
  end if;
end $$;



do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'evaluation_jobs'
      and policyname = 'Enable insert for authenticated users only'
  ) then
    create policy "Enable insert for authenticated users only"
      on "public"."evaluation_jobs"
      as permissive
      for insert
      to authenticated
    with check (true);
  end if;
end $$;



do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'evaluation_jobs'
      and policyname = 'Service role full access'
  ) then
    create policy "Service role full access"
      on "public"."evaluation_jobs"
      as permissive
      for all
      to service_role
    using (true)
    with check (true);
  end if;
end $$;



do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'evaluations'
      and policyname = 'Enable insert for authenticated users only'
  ) then
    create policy "Enable insert for authenticated users only"
      on "public"."evaluations"
      as permissive
      for insert
      to authenticated
    with check (true);
  end if;
end $$;



do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'manuscripts'
      and policyname = 'Service role full access'
  ) then
    create policy "Service role full access"
      on "public"."manuscripts"
      as permissive
      for all
      to service_role
    using (true)
    with check (true);
  end if;
end $$;



