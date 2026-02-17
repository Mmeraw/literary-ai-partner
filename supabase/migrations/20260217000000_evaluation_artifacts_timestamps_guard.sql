-- Migration: Timestamp guards for evaluation_artifacts
-- Purpose: Prevent created_at drift on upserts, ensure updated_at always advances
-- Context: Day 2 A5 artifact writer (lib/artifacts/writeArtifact.ts)
--
-- Semantics:
--   - created_at: immutable after first insert
--   - updated_at: always bumped on any update
--   - Prevents regression if code accidentally sends created_at in upsert

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- UPDATE guard: preserve created_at, always bump updated_at
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.evaluation_artifacts_timestamps_guard()
returns trigger
language plpgsql
as $$
begin
  -- created_at should never change once set
  new.created_at := old.created_at;

  -- always bump updated_at on any update
  new.updated_at := now();

  return new;
end;
$$;

drop trigger if exists trg_evaluation_artifacts_timestamps_guard
on public.evaluation_artifacts;

create trigger trg_evaluation_artifacts_timestamps_guard
before update on public.evaluation_artifacts
for each row
execute function public.evaluation_artifacts_timestamps_guard();

-- ─────────────────────────────────────────────────────────────────────────────
-- INSERT guard: ensure timestamps are set if NULL
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.evaluation_artifacts_timestamps_insert()
returns trigger
language plpgsql
as $$
begin
  if new.created_at is null then
    new.created_at := now();
  end if;

  if new.updated_at is null then
    new.updated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_evaluation_artifacts_timestamps_insert
on public.evaluation_artifacts;

create trigger trg_evaluation_artifacts_timestamps_insert
before insert on public.evaluation_artifacts
for each row
execute function public.evaluation_artifacts_timestamps_insert();

commit;
