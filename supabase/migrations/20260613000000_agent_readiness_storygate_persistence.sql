-- Durable governance persistence for Agent Readiness Package and Storygate Studio.
-- Canon authority: AI_GOVERNANCE.md, docs/NOMENCLATURE_CANON_v1.md,
-- lib/agent-readiness/agentReadinessRegistry.ts, lib/storygate/storygateRegistry.ts.

BEGIN;

-- ─── Agent Readiness section substrate hardening ───────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_readiness_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manuscript_id bigint NOT NULL,
  evaluation_job_id uuid NOT NULL REFERENCES public.evaluation_jobs(id) ON DELETE CASCADE,
  section_type text NOT NULL CHECK (section_type IN ('query_letter', 'what_makes_unique', 'synopsis', 'query_pitch', 'comparables', 'author_bio')),
  content text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved')),
  generated_at timestamptz,
  approved_at timestamptz,
  model_used text,
  mode text CHECK (mode IS NULL OR mode IN ('generate', 'regenerate', 'improve')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, manuscript_id, section_type)
);

ALTER TABLE public.agent_readiness_sections
  ADD COLUMN IF NOT EXISTS evaluation_job_id uuid REFERENCES public.evaluation_jobs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agent_readiness_sections_section_type_check'
      AND conrelid = 'public.agent_readiness_sections'::regclass
  ) THEN
    ALTER TABLE public.agent_readiness_sections
      ADD CONSTRAINT agent_readiness_sections_section_type_check
      CHECK (section_type IN ('query_letter', 'what_makes_unique', 'synopsis', 'query_pitch', 'comparables', 'author_bio'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agent_readiness_sections_status_check'
      AND conrelid = 'public.agent_readiness_sections'::regclass
  ) THEN
    ALTER TABLE public.agent_readiness_sections
      ADD CONSTRAINT agent_readiness_sections_status_check
      CHECK (status IN ('draft', 'approved'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agent_readiness_sections_user_manuscript
  ON public.agent_readiness_sections(user_id, manuscript_id);

CREATE INDEX IF NOT EXISTS idx_agent_readiness_sections_approved
  ON public.agent_readiness_sections(user_id, manuscript_id, evaluation_job_id, section_type)
  WHERE status = 'approved';

ALTER TABLE public.agent_readiness_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_readiness_sections_select_own ON public.agent_readiness_sections;
CREATE POLICY agent_readiness_sections_select_own
  ON public.agent_readiness_sections
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS agent_readiness_sections_insert_own ON public.agent_readiness_sections;
CREATE POLICY agent_readiness_sections_insert_own
  ON public.agent_readiness_sections
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS agent_readiness_sections_update_own ON public.agent_readiness_sections;
CREATE POLICY agent_readiness_sections_update_own
  ON public.agent_readiness_sections
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── Explicit author review decisions ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_readiness_author_review_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manuscript_id bigint NOT NULL,
  evaluation_job_id uuid NOT NULL REFERENCES public.evaluation_jobs(id) ON DELETE CASCADE,
  section_type text NOT NULL CHECK (section_type IN ('query_letter', 'what_makes_unique', 'synopsis', 'query_pitch', 'comparables', 'author_bio')),
  decision text NOT NULL CHECK (decision IN ('approved')),
  decided_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_readiness_author_review_decisions_lookup
  ON public.agent_readiness_author_review_decisions(user_id, manuscript_id, evaluation_job_id, section_type, decided_at DESC);

ALTER TABLE public.agent_readiness_author_review_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_readiness_author_review_decisions_select_own ON public.agent_readiness_author_review_decisions;
CREATE POLICY agent_readiness_author_review_decisions_select_own
  ON public.agent_readiness_author_review_decisions
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS agent_readiness_author_review_decisions_insert_own ON public.agent_readiness_author_review_decisions;
CREATE POLICY agent_readiness_author_review_decisions_insert_own
  ON public.agent_readiness_author_review_decisions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ─── Package versions and export history ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_readiness_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manuscript_id bigint NOT NULL,
  evaluation_job_id uuid NOT NULL REFERENCES public.evaluation_jobs(id) ON DELETE CASCADE,
  manuscript_title text NOT NULL,
  package_version integer NOT NULL CHECK (package_version > 0),
  package_hash text NOT NULL,
  artifact_type text NOT NULL DEFAULT 'agent_readiness_package_v1' CHECK (artifact_type = 'agent_readiness_package_v1'),
  artifact_version text NOT NULL DEFAULT 'agent_readiness_package_v1' CHECK (artifact_version = 'agent_readiness_package_v1'),
  sections jsonb NOT NULL,
  section_hashes jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, manuscript_id, evaluation_job_id, package_version),
  UNIQUE (package_hash)
);

CREATE INDEX IF NOT EXISTS idx_agent_readiness_packages_history
  ON public.agent_readiness_packages(user_id, manuscript_id, created_at DESC);

ALTER TABLE public.agent_readiness_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_readiness_packages_select_own ON public.agent_readiness_packages;
CREATE POLICY agent_readiness_packages_select_own
  ON public.agent_readiness_packages
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS agent_readiness_packages_insert_own ON public.agent_readiness_packages;
CREATE POLICY agent_readiness_packages_insert_own
  ON public.agent_readiness_packages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.agent_readiness_package_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.agent_readiness_packages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manuscript_id bigint NOT NULL,
  evaluation_job_id uuid NOT NULL REFERENCES public.evaluation_jobs(id) ON DELETE CASCADE,
  package_hash text NOT NULL,
  format text NOT NULL CHECK (format IN ('txt', 'docx')),
  filename text NOT NULL,
  exported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_readiness_package_exports_history
  ON public.agent_readiness_package_exports(user_id, manuscript_id, exported_at DESC);

ALTER TABLE public.agent_readiness_package_exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_readiness_package_exports_select_own ON public.agent_readiness_package_exports;
CREATE POLICY agent_readiness_package_exports_select_own
  ON public.agent_readiness_package_exports
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS agent_readiness_package_exports_insert_own ON public.agent_readiness_package_exports;
CREATE POLICY agent_readiness_package_exports_insert_own
  ON public.agent_readiness_package_exports
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.agent_readiness_creator_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.agent_readiness_packages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manuscript_id bigint NOT NULL,
  evaluation_job_id uuid NOT NULL REFERENCES public.evaluation_jobs(id) ON DELETE CASCADE,
  package_hash text NOT NULL,
  artifact_type text NOT NULL DEFAULT 'creator_approval_v1' CHECK (artifact_type = 'creator_approval_v1'),
  artifact_version text NOT NULL DEFAULT 'creator_approval_v1' CHECK (artifact_version = 'creator_approval_v1'),
  approval_state text NOT NULL CHECK (approval_state IN ('pending', 'approved', 'rejected')),
  approved boolean NOT NULL,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (approved = (approval_state = 'approved'))
);

CREATE INDEX IF NOT EXISTS idx_agent_readiness_creator_approvals_package
  ON public.agent_readiness_creator_approvals(package_hash, created_at DESC);

ALTER TABLE public.agent_readiness_creator_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_readiness_creator_approvals_select_own ON public.agent_readiness_creator_approvals;
CREATE POLICY agent_readiness_creator_approvals_select_own
  ON public.agent_readiness_creator_approvals
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS agent_readiness_creator_approvals_insert_own ON public.agent_readiness_creator_approvals;
CREATE POLICY agent_readiness_creator_approvals_insert_own
  ON public.agent_readiness_creator_approvals
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ─── Storygate durable submission and access control substrate ─────────────
CREATE TABLE IF NOT EXISTS public.storygate_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manuscript_id bigint NOT NULL,
  evaluation_job_id uuid NOT NULL REFERENCES public.evaluation_jobs(id) ON DELETE CASCADE,
  package_hash text NOT NULL,
  submission_hash text NOT NULL UNIQUE,
  artifact_type text NOT NULL DEFAULT 'storygate_submission_request_v1' CHECK (artifact_type = 'storygate_submission_request_v1'),
  artifact_version text NOT NULL DEFAULT 'storygate_submission_request_v1' CHECK (artifact_version = 'storygate_submission_request_v1'),
  project_title text NOT NULL,
  primary_genre text NOT NULL,
  creator_name text NOT NULL,
  creator_email text NOT NULL,
  package_fields jsonb NOT NULL,
  readiness_score numeric,
  qualified_professional_equivalent boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'REVIEWING', 'DECLINED', 'HOLD', 'APPROVED')),
  validation_result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_storygate_submissions_creator
  ON public.storygate_submissions(creator_user_id, created_at DESC);

ALTER TABLE public.storygate_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS storygate_submissions_select_creator ON public.storygate_submissions;
CREATE POLICY storygate_submissions_select_creator
  ON public.storygate_submissions
  FOR SELECT
  USING (auth.uid() = creator_user_id);

DROP POLICY IF EXISTS storygate_submissions_insert_creator ON public.storygate_submissions;
CREATE POLICY storygate_submissions_insert_creator
  ON public.storygate_submissions
  FOR INSERT
  WITH CHECK (auth.uid() = creator_user_id);

CREATE TABLE IF NOT EXISTS public.storygate_project_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.storygate_submissions(id) ON DELETE CASCADE,
  creator_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manuscript_id bigint NOT NULL,
  creator_email text NOT NULL,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'restricted', 'active')),
  access_requires_approval boolean NOT NULL DEFAULT true CHECK (access_requires_approval = true),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (creator_user_id, manuscript_id)
);

ALTER TABLE public.storygate_project_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS storygate_project_listings_select_creator ON public.storygate_project_listings;
CREATE POLICY storygate_project_listings_select_creator
  ON public.storygate_project_listings
  FOR SELECT
  USING (auth.uid() = creator_user_id);

CREATE TABLE IF NOT EXISTS public.storygate_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.storygate_project_listings(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verification_state text NOT NULL CHECK (verification_state IN ('verified', 'unverified')),
  decision text NOT NULL DEFAULT 'requested' CHECK (decision IN ('requested', 'approved', 'denied', 'revoked')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  UNIQUE (listing_id, requester_id)
);

CREATE INDEX IF NOT EXISTS idx_storygate_access_requests_listing
  ON public.storygate_access_requests(listing_id, requested_at DESC);

ALTER TABLE public.storygate_access_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS storygate_access_requests_select_requester ON public.storygate_access_requests;
CREATE POLICY storygate_access_requests_select_requester
  ON public.storygate_access_requests
  FOR SELECT
  USING (auth.uid() = requester_id);

DROP POLICY IF EXISTS storygate_access_requests_insert_requester ON public.storygate_access_requests;
CREATE POLICY storygate_access_requests_insert_requester
  ON public.storygate_access_requests
  FOR INSERT
  WITH CHECK (auth.uid() = requester_id AND decision = 'requested');

CREATE TABLE IF NOT EXISTS public.storygate_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.storygate_access_requests(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.storygate_project_listings(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  allowed_artifacts text[] NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_storygate_access_grants_active
  ON public.storygate_access_grants(listing_id, requester_id, granted_at DESC)
  WHERE revoked_at IS NULL;

ALTER TABLE public.storygate_access_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS storygate_access_grants_select_requester ON public.storygate_access_grants;
CREATE POLICY storygate_access_grants_select_requester
  ON public.storygate_access_grants
  FOR SELECT
  USING (auth.uid() = requester_id);

CREATE TABLE IF NOT EXISTS public.storygate_access_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL CHECK (action_type IN ('listing_created', 'request_access', 'grant_access', 'deny_access', 'view', 'download', 'verify_industry', 'revoke_access')),
  listing_id uuid REFERENCES public.storygate_project_listings(id) ON DELETE SET NULL,
  requester_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  validators_run text[] NOT NULL,
  failure_codes text[] NOT NULL DEFAULT '{}',
  verification_state text CHECK (verification_state IS NULL OR verification_state IN ('verified', 'unverified')),
  canon_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_storygate_access_audit_events_listing
  ON public.storygate_access_audit_events(listing_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_storygate_access_audit_events_actor
  ON public.storygate_access_audit_events(actor_user_id, created_at DESC);

ALTER TABLE public.storygate_access_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS storygate_access_audit_events_select_actor ON public.storygate_access_audit_events;
CREATE POLICY storygate_access_audit_events_select_actor
  ON public.storygate_access_audit_events
  FOR SELECT
  USING (auth.uid() = actor_user_id OR auth.uid() = requester_id);

COMMIT;
