-- Align report_shares + A7 RPCs with canonical artifact type: evaluation_result_v1

begin;

-- Canonical default for new share rows
alter table public.report_shares
	alter column artifact_type set default 'evaluation_result_v1';

-- Backfill legacy rows created under previous default
update public.report_shares
set artifact_type = 'evaluation_result_v1'
where artifact_type = 'one_page_summary';

-- A7 create_report_share should revoke/create using canonical artifact type
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
		and artifact_type = 'evaluation_result_v1'
		and revoked_at is null;

	-- Generate token
	v_token := public._rg_generate_share_token();

	-- Hash token for storage (using PostgreSQL's digest function)
	v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

	-- Insert share record with hash
	insert into public.report_shares (token_hash, job_id, artifact_type, created_by, expires_at)
	values (v_token_hash, p_job_id, 'evaluation_result_v1', v_uid, v_expires);

	-- Return plaintext token (only time it's visible) and expiry
	return query select v_token, v_expires;
end;
$$;

-- A7 public share read should fetch canonical evaluation_result_v1 artifact
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
	where a.artifact_type = 'evaluation_result_v1'
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

comment on function public.create_report_share(uuid, int) is
	'A7 canonical: creates report share token bound to evaluation_result_v1 artifact type.';

comment on function public.get_public_report_share(text) is
	'A7 canonical: resolves public share token to evaluation_result_v1 artifact projection.';

commit;

