-- Gate A7 — Report Shares RPC Functions (Security Definer)
-- Preferred hardening: removes admin client reads from app code
-- Public access only via controlled RPC; no direct table access for anon

begin;

-- ---------------------------------------------------------------------------
-- Helper: generate a URL-safe token (base64-ish, no + / =)
-- ---------------------------------------------------------------------------
create or replace function public._rg_generate_share_token()
returns text
language sql
stable
as $$
  select translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '___');
$$;

-- ---------------------------------------------------------------------------
-- - Auth required (auth.uid())
-- - Enforces job ownership via manuscripts join (evaluation_jobs.manuscript_id -> manuscripts.user_id = auth.uid())
-- - Creates token + expiry
-- - Returns plaintext token (only time it's visible)
-- ---------------------------------------------------------------------------
create or replace function public.create_report_share(
  p_job_id uuid,
  p_expires_hours int default 24
)
returns table (
  token text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_owner uuid;
  v_token text;
  v_token_hash text;
  v_expires timestamptz;
  v_hours int;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'unauthorized';
  end if;

  v_hours := greatest(1, least(coalesce(p_expires_hours, 24), 168)); -- 1h..168h
  v_expires := now() + make_interval(hours => v_hours);

  -- Fail-closed: check ownership
  select m.user_id into v_owner
  from public.evaluation_jobs j
  join public.manuscripts m on m.id = j.manuscript_id
  where j.id = p_job_id;

  if v_owner is null then
    raise exception 'job_not_found';
  end if;
  if v_owner <> v_uid then
    raise exception 'job_not_found'; -- fail-closed (no leak)
  end if;

  -- Revoke any existing active share for this job (one active share per job invariant)
  update public.report_shares
  set revoked_at = coalesce(revoked_at, now())
  where job_id = p_job_id
    and artifact_type = 'one_page_summary'
    and revoked_at is null;

  -- Generate token
  v_token := public._rg_generate_share_token();
  
  -- Hash token for storage (using PostgreSQL's digest function)
  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  -- Insert share record with hash
  insert into public.report_shares (token_hash, job_id, created_by, expires_at)
  values (v_token_hash, p_job_id, v_uid, v_expires);

  -- Return plaintext token (only time it's visible) and expiry
  return query select v_token, v_expires;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: revoke_report_share_by_token
-- - Auth required
-- - Only owner can revoke
-- - Idempotent: revoking twice still returns success
-- ---------------------------------------------------------------------------
create or replace function public.revoke_report_share_by_token(
  p_token text
)
returns table (ok boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_token_hash text;
  v_owner uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'unauthorized';
  end if;

  -- Hash the provided token to lookup
  v_token_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  -- Check ownership
  select created_by into v_owner
  from public.report_shares
  where token_hash = v_token_hash;

  if v_owner is null or v_owner <> v_uid then
    raise exception 'share_not_found'; -- fail-closed
  end if;

  -- Revoke (idempotent)
  update public.report_shares
  set revoked_at = coalesce(revoked_at, now())
  where token_hash = v_token_hash;

  return query select true;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: get_public_report_share
-- - Public/anon callable
-- - Enforces: token exists AND not revoked AND not expired
-- - Returns: canonical A6 report artifact (content + provenance) for that job
-- - Fail-closed: returns zero rows when invalid (caller should 404)
-- ---------------------------------------------------------------------------
create or replace function public.get_public_report_share(
  p_token text
)
returns table (
  job_id uuid,
  artifact_type text,
  artifact_version text,
  content jsonb,
  updated_at timestamptz,
  source_hash text,
  source_phase text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token_hash text;
begin
  -- Hash the provided token
  v_token_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  -- Return artifact if share is valid
  return query
  with s as (
    select rs.job_id
    from public.report_shares rs
    where rs.token_hash = v_token_hash
      and rs.revoked_at is null
      and (rs.expires_at is null or rs.expires_at > now())
    limit 1
  )
  select
    a.job_id,
    a.artifact_type,
    a.artifact_version,
    a.content,
    a.updated_at,
    a.source_hash,
    a.source_phase
  from public.evaluation_artifacts a
  join s on s.job_id = a.job_id
  where a.artifact_type = 'one_page_summary'
  limit 1;

  -- Best-effort view tracking (must not block on failure)
  begin
    update public.report_shares
    set view_count = view_count + 1,
        last_viewed_at = now()
    where token_hash = v_token_hash
      and revoked_at is null
      and (expires_at is null or expires_at > now());
  exception when others then
    -- Fail-safe: metrics failure must not block
    null;
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: allow anon/auth to call public read RPC; auth to call create/revoke
-- NOTE: We do NOT grant table SELECT to anon (RPC only access)
-- ---------------------------------------------------------------------------
revoke all on table public.report_shares from anon, authenticated;
grant execute on function public.get_public_report_share(text) to anon, authenticated;
grant execute on function public.create_report_share(uuid, int) to authenticated;
grant execute on function public.revoke_report_share_by_token(text) to authenticated;

commit;
