-- Migration: Finalizer completion authority RPC permissions and comments
-- Purpose: Apply execute grants and function documentation in a runner-safe single statement.
-- Scope: #89 write-authority only

DO $migration$
BEGIN
  EXECUTE 'REVOKE ALL ON FUNCTION public.finalizer_complete_job_atomic(uuid, text, text, text, jsonb, jsonb) FROM public';
  EXECUTE 'REVOKE ALL ON FUNCTION public.finalizer_mark_job_failed(uuid, text, text, text) FROM public';

  EXECUTE 'GRANT EXECUTE ON FUNCTION public.finalizer_complete_job_atomic(uuid, text, text, text, jsonb, jsonb) TO service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.finalizer_mark_job_failed(uuid, text, text, text) TO service_role';

  EXECUTE $sql$
COMMENT ON FUNCTION public.finalizer_complete_job_atomic(uuid, text, text, text, jsonb, jsonb)
IS 'Finalizer #89 authority: atomic canonical+summary persistence and terminal completion in one transaction. Fails closed on any mismatch.'
  $sql$;

  EXECUTE $sql$
COMMENT ON FUNCTION public.finalizer_mark_job_failed(uuid, text, text, text)
IS 'Finalizer #89 authority: fail-closed terminal failure transition with claim + phase + status checks.'
  $sql$;
END
$migration$;
