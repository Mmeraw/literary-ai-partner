-- Free diagnostic abuse guard: one claim per account/email and one claim per IP hash.
-- Raw IP addresses are intentionally never stored.

CREATE TABLE IF NOT EXISTS public.free_diagnostic_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  normalized_email text NOT NULL,
  ip_hash text NULL,
  manuscript_id text NULL,
  job_id uuid NULL REFERENCES public.evaluation_jobs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT free_diagnostic_claims_normalized_email_lowercase
    CHECK (normalized_email = lower(btrim(normalized_email))),
  CONSTRAINT free_diagnostic_claims_normalized_email_not_blank
    CHECK (length(btrim(normalized_email)) > 3)
);

CREATE UNIQUE INDEX IF NOT EXISTS free_diagnostic_claims_user_id_key
  ON public.free_diagnostic_claims (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS free_diagnostic_claims_normalized_email_key
  ON public.free_diagnostic_claims (normalized_email);

CREATE UNIQUE INDEX IF NOT EXISTS free_diagnostic_claims_ip_hash_key
  ON public.free_diagnostic_claims (ip_hash)
  WHERE ip_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_free_diagnostic_claims_created_at
  ON public.free_diagnostic_claims (created_at DESC);

ALTER TABLE public.free_diagnostic_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own free diagnostic claim" ON public.free_diagnostic_claims;
CREATE POLICY "Users can view own free diagnostic claim"
  ON public.free_diagnostic_claims
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON public.free_diagnostic_claims FROM anon;
REVOKE ALL ON public.free_diagnostic_claims FROM authenticated;
GRANT SELECT ON public.free_diagnostic_claims TO authenticated;
