-- Author-controlled support access for evaluation data.
-- Authors can grant temporary, revocable access for admin/support
-- to view evaluation telemetry for troubleshooting.
-- Every support view is logged to an append-only audit table.

BEGIN;

-- ─── Grant table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evaluation_support_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_job_id uuid NOT NULL REFERENCES public.evaluation_jobs(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'evaluation_telemetry'
    CHECK (scope IN ('evaluation_telemetry')),
  reason text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.evaluation_support_access_grants IS
  'Author-controlled grants allowing support/admin to view evaluation telemetry. '
  'Grants expire after 7 days by default and can be revoked at any time.';

CREATE INDEX IF NOT EXISTS idx_support_access_grants_job_id
  ON public.evaluation_support_access_grants(evaluation_job_id);

CREATE INDEX IF NOT EXISTS idx_support_access_grants_owner
  ON public.evaluation_support_access_grants(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_support_access_grants_active
  ON public.evaluation_support_access_grants(evaluation_job_id, expires_at DESC)
  WHERE revoked_at IS NULL;

ALTER TABLE public.evaluation_support_access_grants ENABLE ROW LEVEL SECURITY;

-- Authors can see and manage their own grants
DROP POLICY IF EXISTS support_access_grants_select_own ON public.evaluation_support_access_grants;
CREATE POLICY support_access_grants_select_own
  ON public.evaluation_support_access_grants
  FOR SELECT
  USING (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS support_access_grants_insert_own ON public.evaluation_support_access_grants;
CREATE POLICY support_access_grants_insert_own
  ON public.evaluation_support_access_grants
  FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id AND auth.uid() = granted_by_user_id);

DROP POLICY IF EXISTS support_access_grants_update_own ON public.evaluation_support_access_grants;
CREATE POLICY support_access_grants_update_own
  ON public.evaluation_support_access_grants
  FOR UPDATE
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

-- ─── Audit log table (append-only) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.evaluation_support_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_job_id uuid NOT NULL REFERENCES public.evaluation_jobs(id) ON DELETE CASCADE,
  viewer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grant_id uuid REFERENCES public.evaluation_support_access_grants(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('view', 'grant_created', 'grant_revoked')),
  viewed_at timestamptz NOT NULL DEFAULT now(),
  ip_hash text,
  user_agent text
);

COMMENT ON TABLE public.evaluation_support_access_log IS
  'Append-only audit trail for all support/admin access to evaluation data. '
  'Records every view, grant creation, and revocation.';

CREATE INDEX IF NOT EXISTS idx_support_access_log_job_id
  ON public.evaluation_support_access_log(evaluation_job_id);

CREATE INDEX IF NOT EXISTS idx_support_access_log_viewer
  ON public.evaluation_support_access_log(viewer_user_id);

CREATE INDEX IF NOT EXISTS idx_support_access_log_viewed_at
  ON public.evaluation_support_access_log(viewed_at DESC);

ALTER TABLE public.evaluation_support_access_log ENABLE ROW LEVEL SECURITY;

-- Authors can see audit log entries for their own evaluations
DROP POLICY IF EXISTS support_access_log_select_owner ON public.evaluation_support_access_log;
CREATE POLICY support_access_log_select_owner
  ON public.evaluation_support_access_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.evaluation_jobs ej
      WHERE ej.id = evaluation_job_id
        AND ej.user_id = auth.uid()
    )
  );

-- Service role inserts audit entries (via admin client)
-- No INSERT policy for regular users — audit log is append-only via server

COMMIT;
