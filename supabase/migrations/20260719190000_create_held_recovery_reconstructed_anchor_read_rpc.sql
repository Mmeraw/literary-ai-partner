-- Precision-safe, read-only authority seam for Held Recovery re-admission.
--
-- Re-admission must never accept reconstructed anchor content from its caller.
-- It reads the immutable row owned by held_recovery_reconstructed_anchors using
-- the unique (held_item_id, held_item_persisted_version) authority key. The
-- bigint manuscript identity is projected as text so it cannot lose precision
-- in JavaScript. This function performs no writes and activates no runtime path.

begin;

create or replace function public.get_held_recovery_reconstructed_anchor(
  p_held_item_id text,
  p_held_item_persisted_version text
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'status', 'loaded',
        'id', anchor_row.id,
        'held_item_id', anchor_row.held_item_id,
        'opportunity_id', anchor_row.opportunity_id,
        'manuscript_id_text', anchor_row.manuscript_id::text,
        'manuscript_version_sha', anchor_row.manuscript_version_sha,
        'held_item_persisted_version', anchor_row.held_item_persisted_version,
        'completion_fingerprint', anchor_row.completion_fingerprint,
        'recovery_method', anchor_row.recovery_method,
        'source_hash', anchor_row.source_hash,
        'source_start_offset', anchor_row.source_start_offset,
        'source_end_offset', anchor_row.source_end_offset,
        'evidence_anchor', anchor_row.evidence_anchor,
        'manuscript_coordinates', anchor_row.manuscript_coordinates
      )
      from public.held_recovery_reconstructed_anchors as anchor_row
      where anchor_row.held_item_id = p_held_item_id
        and anchor_row.held_item_persisted_version = p_held_item_persisted_version
    ),
    jsonb_build_object(
      'status', 'missing',
      'held_item_id', p_held_item_id,
      'held_item_persisted_version', p_held_item_persisted_version
    )
  );
$$;

revoke all on function public.get_held_recovery_reconstructed_anchor(text, text) from public;
revoke all on function public.get_held_recovery_reconstructed_anchor(text, text) from authenticated;
revoke all on function public.get_held_recovery_reconstructed_anchor(text, text) from anon;
grant execute on function public.get_held_recovery_reconstructed_anchor(text, text) to service_role;

comment on function public.get_held_recovery_reconstructed_anchor(text, text) is
  'Read-only, precision-safe lookup of the immutable Held Recovery reconstructed-anchor authority row by (held_item_id, held_item_persisted_version). Projects manuscript_id as text. Performs no queue, attempt, candidate, manuscript, transition, retry, classification, or re-admission mutation.';

commit;
