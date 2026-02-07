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

-- CANONICAL RPC DROPS REMOVED: These functions are contract surface and must not be deleted by drift files
-- - claim_job_atomic: Phase 2D lease/claim contract (created by 20260205000001)
-- - admin_list_jobs: Admin API surface (created by 20260201000000)  
-- - admin_retry_job: Admin retry atomicity (created by 20260131000000, fixed by 20260206000000)
-- - increment_job_attempt_count: Retry tracking (created by 20260205000011)
-- Drift files reconcile schema; canonical migrations own contract surface.

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

-- NOTE: manuscript_chunks.manuscript_id type changes and RLS policies are handled by:
-- - 20260129000000_fix_manuscript_chunks_fk_type.sql (converts type to bigint, recreates policies)
-- Remote schema reconciliation should NOT attempt destructive refactors with policy dependencies

CREATE INDEX IF NOT EXISTS evaluation_artifacts_job_id_idx ON public.evaluation_artifacts USING btree (job_id);

CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_phase_1_locked ON public.evaluation_jobs USING btree (phase_1_locked_at) WHERE (phase_1_locked_at IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_phase_1_status ON public.evaluation_jobs USING btree (phase_1_status);

CREATE INDEX IF NOT EXISTS idx_manuscript_chunks_lease_expires_at ON public.manuscript_chunks USING btree (lease_expires_at) WHERE (status = 'processing'::public.chunk_status);

CREATE INDEX IF NOT EXISTS idx_manuscript_chunks_manuscript_id ON public.manuscript_chunks USING btree (manuscript_id);

CREATE INDEX IF NOT EXISTS idx_manuscript_chunks_status_lease ON public.manuscript_chunks USING btree (status, lease_expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS uq_eval_jobs_active_phase1 ON public.evaluation_jobs USING btree (manuscript_id, job_type) WHERE ((phase = 'phase_1'::text) AND (status = ANY (ARRAY['queued'::text, 'running'::text])));

CREATE UNIQUE INDEX IF NOT EXISTS uq_eval_jobs_active_phase1_worktype ON public.evaluation_jobs USING btree (manuscript_id, job_type, work_type) WHERE ((phase = 'phase_1'::text) AND (status = ANY (ARRAY['queued'::text, 'running'::text])));

