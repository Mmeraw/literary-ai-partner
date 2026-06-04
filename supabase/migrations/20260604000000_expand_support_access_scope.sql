-- Expand support access grant scope to include revision data.
-- Allows admin/support to view revision queue and diagnostic findings
-- when the author has granted access.

BEGIN;

-- Widen the CHECK constraint on scope to allow 'revision_data'
ALTER TABLE public.evaluation_support_access_grants
  DROP CONSTRAINT IF EXISTS evaluation_support_access_grants_scope_check;

ALTER TABLE public.evaluation_support_access_grants
  ADD CONSTRAINT evaluation_support_access_grants_scope_check
  CHECK (scope IN ('evaluation_telemetry', 'revision_data', 'full'));

COMMIT;
