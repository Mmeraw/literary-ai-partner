-- Narrow read RPC for the Held Recovery reconstructed-anchor path.
--
-- Purpose: return the manuscript_chunks read model that the Held Recovery
-- reconstruction path consumes, with manuscript_id projected as TEXT so the
-- exact bigint identity survives the persistence boundary. manuscript_chunks.
-- manuscript_id is a bigint (see 20260129000000_fix_manuscript_chunks_fk_type);
-- reading it through a JS number in the client would risk IEEE-754 precision
-- loss for values above 2^53. The cast to text happens here, in SQL, at the
-- database boundary — the TypeScript layer accepts only the canonical string and
-- never converts from a number.
--
-- Scope fence: this migration adds ONLY a read RPC. It returns exactly the nine
-- columns the two Held Recovery reads already consume (id, manuscript_id as
-- text, chunk_index, char_start, char_end, overlap_chars, label, content,
-- content_hash) ordered by chunk_index. It is not a general manuscript-chunk
-- retrieval API. It performs no mutation of any kind — no insert, update, delete,
-- queue transition, attempt write, candidate or manuscript mutation, retry
-- scheduling, re-admission, or feature flag.

begin;

create or replace function public.get_held_recovery_manuscript_chunks(
  p_manuscript_id bigint
)
returns table (
  id uuid,
  manuscript_id_text text,
  chunk_index integer,
  char_start integer,
  char_end integer,
  overlap_chars integer,
  label text,
  content text,
  content_hash text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    mc.id,
    mc.manuscript_id::text as manuscript_id_text,
    mc.chunk_index,
    mc.char_start,
    mc.char_end,
    mc.overlap_chars,
    mc.label,
    mc.content,
    mc.content_hash
  from public.manuscript_chunks mc
  where mc.manuscript_id = p_manuscript_id
  order by mc.chunk_index asc;
$$;

revoke all on function public.get_held_recovery_manuscript_chunks(bigint) from public;
revoke all on function public.get_held_recovery_manuscript_chunks(bigint) from authenticated;
revoke all on function public.get_held_recovery_manuscript_chunks(bigint) from anon;
grant execute on function public.get_held_recovery_manuscript_chunks(bigint) to service_role;

comment on function public.get_held_recovery_manuscript_chunks(bigint) is
  'Narrow read for the Held Recovery reconstructed-anchor path. Returns the manuscript_chunks read model (id, manuscript_id as TEXT, chunk_index, char_start, char_end, overlap_chars, label, content, content_hash) for one manuscript, ordered by chunk_index. manuscript_id is projected as text so the exact bigint identity survives to the persistence boundary without IEEE-754 precision loss in the client. Read-only; performs no mutation and is not a general chunk-retrieval API.';

commit;
