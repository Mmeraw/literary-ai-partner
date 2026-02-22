-- Align A8 artifact discovery functions with canonical artifact type: evaluation_result_v1
-- Forward-only override of function bodies/comments (do not rewrite historical migrations)

begin;

create or replace function list_my_artifacts(
  p_status text DEFAULT NULL,
  p_since timestamptz DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_policy_family text DEFAULT NULL,
  p_voice_preservation_level text DEFAULT NULL,
  p_english_variant text DEFAULT NULL
)
returns table (
  job_id uuid,
  manuscript_id bigint,
  manuscript_title text,
  job_type text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,

  -- Job configuration
  policy_family text,
  voice_preservation_level text,
  english_variant text,
  work_type text,

  -- Canonical artifact metadata
  artifact_type text,
  artifact_version text,
  artifact_updated_at timestamptz,
  source_phase text,
  source_hash text,

  -- Artifact payload
  overall_score numeric,
  credibility_valid boolean,
  artifact_content jsonb
)
language plpgsql
security invoker
stable
as $$
begin
  if p_limit < 1 or p_limit > 200 then
    raise exception 'p_limit must be between 1 and 200';
  end if;

  return query
  select
    ej.id,
    ej.manuscript_id,
    m.title as manuscript_title,
    ej.job_type,
    ej.status,
    ej.created_at,
    ej.updated_at,

    ej.policy_family,
    ej.voice_preservation_level,
    ej.english_variant,
    ej.work_type,

    ea.artifact_type,
    ea.artifact_version,
    ea.updated_at as artifact_updated_at,
    ea.source_phase,
    ea.source_hash,

    (ea.content->>'overall_score')::numeric as overall_score,
    (ea.content->'credibility_metrics'->>'valid')::boolean as credibility_valid,
    ea.content as artifact_content
  from evaluation_jobs ej
  join manuscripts m on m.id = ej.manuscript_id
  left join evaluation_artifacts ea
    on ea.job_id = ej.id::text
    and ea.artifact_type = 'evaluation_result_v1'
  where
    m.created_by = auth.uid()
    and (p_status is null or ej.status = p_status)
    and (p_since is null or ej.created_at >= p_since)
    and (p_policy_family is null or ej.policy_family = p_policy_family)
    and (p_voice_preservation_level is null or ej.voice_preservation_level = p_voice_preservation_level)
    and (p_english_variant is null or ej.english_variant = p_english_variant)
  order by ej.created_at desc
  limit p_limit;
end;
$$;

comment on function list_my_artifacts is
  'A8 canonical: list owner artifacts with filters. SECURITY INVOKER (RLS-based). Ownership via manuscripts.created_by. Canonical artifact: evaluation_result_v1.';

create or replace function get_public_artifact_collection(
  p_token text
)
returns table (
  collection_id uuid,
  collection_name text,
  collection_description text,
  artifacts jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token_hash bytea;
  v_share_id uuid;
  v_collection_id uuid;
  v_collection_name text;
  v_collection_description text;
  v_artifacts jsonb;
begin
  v_token_hash := extensions.digest(p_token, 'sha256');

  select
    cs.id,
    cs.collection_id,
    ac.name,
    ac.description
  into
    v_share_id,
    v_collection_id,
    v_collection_name,
    v_collection_description
  from collection_shares cs
  join artifact_collections ac on ac.id = cs.collection_id
  where cs.token_hash = v_token_hash
    and cs.revoked_at is null
    and (cs.expires_at is null or cs.expires_at > now());

  if v_share_id is null then
    return;
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'job_id', ej.id,
      'work_title', m.title,
      'status', ej.status,
      'created_at', ej.created_at,
      'artifact', ea.content
    )
    order by ca.added_at desc
  )
  into v_artifacts
  from collection_artifacts ca
  join evaluation_jobs ej on ej.id = ca.job_id
  join manuscripts m on m.id = ej.manuscript_id
  left join evaluation_artifacts ea
    on ea.job_id = ej.id::text
    and ea.artifact_type = 'evaluation_result_v1'
  where ca.collection_id = v_collection_id;

  begin
    update collection_shares
    set
      view_count = view_count + 1,
      last_viewed_at = now()
    where id = v_share_id;
  exception
    when others then null;
  end;

  return query
  select
    v_collection_id,
    v_collection_name,
    v_collection_description,
    coalesce(v_artifacts, '[]'::jsonb);
end;
$$;

comment on function get_public_artifact_collection is
  'A8 canonical: public collection view via token (anon-callable). SECURITY DEFINER for RLS bypass. Canonical artifact projection: evaluation_result_v1. Fail-closed on invalid/revoked/expired.';

commit;
