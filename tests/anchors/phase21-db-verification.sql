-- Phase 2.1 DB Verification Pack
-- Purpose: prove Anchor Metadata System rollout in target DB.
--
-- Run in target Postgres/Supabase SQL editor after migrations are applied.
-- This script is read-heavy and safe (no persistent writes).

set search_path = public;

-- ---------------------------------------------------------------------------
-- 0) Expected migration is present in migration ledger
-- ---------------------------------------------------------------------------
select
  'migration_present_20260318000000' as check_name,
  exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260318000000'
  ) as passed;

-- ---------------------------------------------------------------------------
-- 1) Required columns exist with expected nullability/defaults
-- ---------------------------------------------------------------------------
with expected(column_name, expected_data_type, expected_nullable, expected_default_like) as (
  values
    ('start_offset', 'integer', 'YES', null::text),
    ('end_offset', 'integer', 'YES', null::text),
    ('before_context', 'text', 'NO', '%'''''::text),
    ('after_context', 'text', 'NO', '%'''''::text),
    ('anchor_text_normalized', 'text', 'YES', null::text),
    ('anchor_version', 'text', 'NO', '%''v1''%'::text)
),
actual as (
  select
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'change_proposals'
)
select
  e.column_name,
  e.expected_data_type,
  a.data_type as actual_data_type,
  e.expected_nullable,
  a.is_nullable as actual_nullable,
  e.expected_default_like,
  a.column_default as actual_default,
  (
    a.column_name is not null
    and a.data_type = e.expected_data_type
    and a.is_nullable = e.expected_nullable
    and (
      e.expected_default_like is null
      or coalesce(a.column_default, '') ilike e.expected_default_like
    )
  ) as passed
from expected e
left join actual a
  on a.column_name = e.column_name
order by e.column_name;

-- ---------------------------------------------------------------------------
-- 2) Required constraints exist
-- Note: convalidated may be false if created NOT VALID (expected during rollout).
-- ---------------------------------------------------------------------------
select
  c.conname,
  c.convalidated,
  pg_get_constraintdef(c.oid) as constraint_def,
  (c.conname is not null) as exists
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and t.relname = 'change_proposals'
  and c.conname in (
    'change_proposals_anchor_contract_required',
    'change_proposals_start_offset_nonnegative',
    'change_proposals_end_offset_gt_start'
  )
order by c.conname;

-- ---------------------------------------------------------------------------
-- 3) Null contract check (global)
-- ---------------------------------------------------------------------------
select
  'bad_rows_global_required_anchor_fields' as check_name,
  count(*)::bigint as bad_rows
from change_proposals
where start_offset is null
   or end_offset is null
   or before_context is null
   or after_context is null;

-- ---------------------------------------------------------------------------
-- 4) Offset invariant check (global)
-- ---------------------------------------------------------------------------
select
  'bad_rows_global_offset_invariants' as check_name,
  count(*)::bigint as bad_rows
from change_proposals
where start_offset is null
   or end_offset is null
   or start_offset < 0
   or end_offset <= start_offset;

-- ---------------------------------------------------------------------------
-- 5) Source-slice consistency check
-- Checks:
--   - extracted slice is non-empty
--   - normalized source slice equals normalized original_text
--   - when anchor_text_normalized is populated, it matches normalized slice
-- ---------------------------------------------------------------------------
with anchored as (
  select
    cp.id,
    cp.revision_session_id,
    cp.original_text,
    cp.start_offset,
    cp.end_offset,
    cp.anchor_text_normalized,
    mv.raw_text as source_text,
    substring(mv.raw_text from cp.start_offset + 1 for (cp.end_offset - cp.start_offset)) as extracted
  from change_proposals cp
  join revision_sessions rs
    on rs.id = cp.revision_session_id
  join manuscript_versions mv
    on mv.id = rs.source_version_id
  where cp.start_offset is not null
    and cp.end_offset is not null
),
normalized as (
  select
    id,
    start_offset,
    end_offset,
    char_length(extracted) as extracted_len,
    replace(replace(coalesce(extracted, ''), E'\r\n', E'\n'), E'\r', E'\n') as norm_extracted,
    replace(replace(coalesce(original_text, ''), E'\r\n', E'\n'), E'\r', E'\n') as norm_original,
    anchor_text_normalized
  from anchored
)
select
  count(*)::bigint as anchored_rows_checked,
  count(*) filter (where extracted_len <= 0)::bigint as empty_slice_rows,
  count(*) filter (where norm_extracted <> norm_original)::bigint as source_slice_mismatch_rows,
  count(*) filter (
    where anchor_text_normalized is not null
      and btrim(anchor_text_normalized) <> ''
      and regexp_replace(norm_extracted, '\\s+', ' ', 'g') <> anchor_text_normalized
  )::bigint as normalized_text_mismatch_rows
from normalized;

-- ---------------------------------------------------------------------------
-- 6) Quick sample for manual inspection
-- ---------------------------------------------------------------------------
select
  cp.id,
  cp.created_at,
  cp.start_offset,
  cp.end_offset,
  (cp.end_offset - cp.start_offset) as span,
  char_length(cp.before_context) as before_context_len,
  char_length(cp.after_context) as after_context_len,
  (cp.anchor_text_normalized is not null and btrim(cp.anchor_text_normalized) <> '') as has_anchor_text_normalized
from change_proposals cp
where cp.start_offset is not null
  and cp.end_offset is not null
order by cp.created_at desc
limit 20;

-- ---------------------------------------------------------------------------
-- 7) CI/automation assertion block
-- Fails hard if closure conditions are not met.
-- ---------------------------------------------------------------------------
do $$
declare
  v_missing_columns int;
  v_missing_constraints int;
  v_bad_required int;
  v_bad_offsets int;
  v_empty_slice int;
  v_slice_mismatch int;
  v_norm_mismatch int;
  v_migration_present boolean;
begin
  select exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260318000000'
  ) into v_migration_present;

  if not v_migration_present then
    raise exception 'Phase 2.1 verification failed: migration 20260318000000 not found in schema_migrations.';
  end if;

  with expected(column_name) as (
    values
      ('start_offset'),
      ('end_offset'),
      ('before_context'),
      ('after_context'),
      ('anchor_text_normalized'),
      ('anchor_version')
  )
  select count(*)
  into v_missing_columns
  from expected e
  left join information_schema.columns c
    on c.table_schema = 'public'
   and c.table_name = 'change_proposals'
   and c.column_name = e.column_name
  where c.column_name is null;

  if v_missing_columns > 0 then
    raise exception 'Phase 2.1 verification failed: required columns missing from public.change_proposals (%).', v_missing_columns;
  end if;

  with expected(conname) as (
    values
      ('change_proposals_anchor_contract_required'),
      ('change_proposals_start_offset_nonnegative'),
      ('change_proposals_end_offset_gt_start')
  )
  select count(*)
  into v_missing_constraints
  from expected e
  left join pg_constraint c
    on c.conname = e.conname
   and c.conrelid = 'public.change_proposals'::regclass
  where c.conname is null;

  if v_missing_constraints > 0 then
    raise exception 'Phase 2.1 verification failed: required constraints missing on public.change_proposals (%).', v_missing_constraints;
  end if;

  select count(*) into v_bad_required
  from change_proposals
  where start_offset is null
     or end_offset is null
     or before_context is null
     or after_context is null;

  if v_bad_required > 0 then
    raise exception 'Phase 2.1 verification failed: % rows violate required anchor field nullability.', v_bad_required;
  end if;

  select count(*) into v_bad_offsets
  from change_proposals
  where start_offset < 0
     or end_offset <= start_offset;

  if v_bad_offsets > 0 then
    raise exception 'Phase 2.1 verification failed: % rows violate offset invariants (start_offset/end_offset).', v_bad_offsets;
  end if;

  with anchored as (
    select
      cp.id,
      cp.original_text,
      cp.anchor_text_normalized,
      substring(mv.raw_text from cp.start_offset + 1 for (cp.end_offset - cp.start_offset)) as extracted
    from change_proposals cp
    join revision_sessions rs on rs.id = cp.revision_session_id
    join manuscript_versions mv on mv.id = rs.source_version_id
    where cp.start_offset is not null
      and cp.end_offset is not null
  ),
  normalized as (
    select
      id,
      char_length(extracted) as extracted_len,
      replace(replace(coalesce(extracted, ''), E'\r\n', E'\n'), E'\r', E'\n') as norm_extracted,
      replace(replace(coalesce(original_text, ''), E'\r\n', E'\n'), E'\r', E'\n') as norm_original,
      anchor_text_normalized
    from anchored
  )
  select
    count(*) filter (where extracted_len <= 0),
    count(*) filter (where norm_extracted <> norm_original),
    count(*) filter (
      where anchor_text_normalized is not null
        and btrim(anchor_text_normalized) <> ''
        and regexp_replace(norm_extracted, '\\s+', ' ', 'g') <> anchor_text_normalized
    )
  into v_empty_slice, v_slice_mismatch, v_norm_mismatch
  from normalized;

  if v_empty_slice > 0 then
    raise exception 'Phase 2.1 verification failed: % rows have empty source slice from offsets.', v_empty_slice;
  end if;

  if v_slice_mismatch > 0 then
    raise exception 'Phase 2.1 verification failed: % rows mismatch source slice vs original_text.', v_slice_mismatch;
  end if;

  if v_norm_mismatch > 0 then
    raise exception 'Phase 2.1 verification failed: % rows mismatch normalized slice vs anchor_text_normalized.', v_norm_mismatch;
  end if;

  raise notice 'Phase 2.1 DB verification passed: migration present, schema complete, constraints present, and anchor rows valid.';
end $$;
