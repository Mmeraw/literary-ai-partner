-- Gate A8: Artifact Index & Discovery
-- Created: 2026-02-17 UTC
-- Preconditions: A5 CLOSED, A6 CLOSED, A7 CI-VERIFIED
-- 
-- GOVERNANCE PRINCIPLES:
-- - Owner-only queries use RLS + SECURITY INVOKER (not DEFINER)
-- - SECURITY DEFINER ONLY for public token-based projections
-- - Canonical artifact type: "one_page_summary"
-- - Ownership derived via: evaluation_jobs -> manuscripts -> created_by

--------------------------------------------------------------------------------
-- 1. QUERY INDEXES ON EVALUATION_JOBS
--------------------------------------------------------------------------------

-- Index for owner-based listing with status filter
-- Supports: WHERE m.created_by = auth.uid() AND ej.status = 'complete' ORDER BY ej.created_at DESC
CREATE INDEX IF NOT EXISTS idx_jobs_manuscript_status_created
  ON evaluation_jobs(manuscript_id, status, created_at DESC);

-- Index for temporal queries (completed jobs)
-- Supports: WHERE m.created_by = auth.uid() AND ej.updated_at >= '...' ORDER BY ej.updated_at DESC
CREATE INDEX IF NOT EXISTS idx_jobs_manuscript_updated
  ON evaluation_jobs(manuscript_id, updated_at DESC);

COMMENT ON INDEX idx_jobs_manuscript_status_created IS
  'A8: Owner artifact listing with status filter';

COMMENT ON INDEX idx_jobs_manuscript_updated IS
  'A8: Temporal queries over user artifacts';

--------------------------------------------------------------------------------
-- 2. ARTIFACT_COLLECTIONS TABLE
--------------------------------------------------------------------------------

CREATE TABLE artifact_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 200),
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Metadata
  is_public boolean NOT NULL DEFAULT false,
  
  -- NO share_token_hash column (violates lifecycle governance)
  -- Shares are separate resources in collection_shares
  
  CONSTRAINT artifact_collections_name_not_empty CHECK (trim(name) <> '')
);

CREATE INDEX idx_collections_created_by ON artifact_collections(created_by, created_at DESC);

COMMENT ON TABLE artifact_collections IS
  'A8: User-organized collections of evaluation artifacts. Shares are separate resources in collection_shares.';

-- RLS: Owner-only access
ALTER TABLE artifact_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner: full access to own collections"
  ON artifact_collections
  FOR ALL
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Service role: full access"
  ON artifact_collections
  FOR ALL
  USING (true);

--------------------------------------------------------------------------------
-- 3. COLLECTION_ARTIFACTS JUNCTION TABLE
--------------------------------------------------------------------------------

CREATE TABLE collection_artifacts (
  collection_id uuid REFERENCES artifact_collections(id) ON DELETE CASCADE NOT NULL,
  job_id uuid REFERENCES evaluation_jobs(id) ON DELETE CASCADE NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  added_by uuid REFERENCES auth.users(id) NOT NULL,
  
  PRIMARY KEY (collection_id, job_id)
);

CREATE INDEX idx_collection_artifacts_job ON collection_artifacts(job_id);

COMMENT ON TABLE collection_artifacts IS
  'A8: Junction table for artifacts in collections. No artifact mutation—read-only projection.';

-- RLS: Owner-only (via collection ownership)
ALTER TABLE collection_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner: manage artifacts in own collections"
  ON collection_artifacts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM artifact_collections
      WHERE id = collection_artifacts.collection_id
        AND created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM artifact_collections
      WHERE id = collection_artifacts.collection_id
        AND created_by = auth.uid()
    )
  );

CREATE POLICY "Service role: full access"
  ON collection_artifacts
  FOR ALL
  USING (true);

--------------------------------------------------------------------------------
-- 4. COLLECTION_SHARES TABLE (A7 PATTERN)
--------------------------------------------------------------------------------

CREATE TABLE collection_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid REFERENCES artifact_collections(id) ON DELETE CASCADE NOT NULL,
  
  -- Token security (SHA-256 hash, never store plaintext)
  token_hash bytea UNIQUE NOT NULL,
  
  -- Ownership & lifecycle
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  
  -- Usage tracking
  view_count int NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,
  
  -- Only one active share per collection
  CONSTRAINT unique_active_collection_share 
    UNIQUE NULLS NOT DISTINCT (collection_id, revoked_at)
    WHERE (revoked_at IS NULL)
);

CREATE INDEX idx_collection_shares_token_hash ON collection_shares(token_hash);
CREATE INDEX idx_collection_shares_collection ON collection_shares(collection_id);
CREATE INDEX idx_collection_shares_created_by ON collection_shares(created_by);

COMMENT ON TABLE collection_shares IS
  'A8: Share tokens for public collection access (extends A7 pattern). Token stored as SHA-256 hash.';

-- RLS: Owner-only for creation/revocation, anon access via RPC only
ALTER TABLE collection_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner: manage own collection shares"
  ON collection_shares
  FOR ALL
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Service role: full access"
  ON collection_shares
  FOR ALL
  USING (true);

--------------------------------------------------------------------------------
-- 5. RPC FUNCTIONS (STRICT GOVERNANCE)
--------------------------------------------------------------------------------

-- ============================================================================
-- 5A. LIST_MY_ARTIFACTS (SECURITY INVOKER, not DEFINER)
-- ============================================================================

CREATE OR REPLACE FUNCTION list_my_artifacts(
  p_status text DEFAULT NULL,
  p_since timestamptz DEFAULT NULL,
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  job_id uuid,
  manuscript_id bigint,
  work_title text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  overall_score numeric,
  credibility_valid boolean,
  artifact_updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER  -- ← GOVERNANCE: Owner queries use RLS, not privilege escalation
STABLE
AS $$
BEGIN
  -- Validate limit
  IF p_limit < 1 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'p_limit must be between 1 and 1000';
  END IF;

  RETURN QUERY
  SELECT 
    ej.id,
    ej.manuscript_id,
    m.title AS work_title,
    ej.status,
    ej.created_at,
    ej.updated_at,
    (ea.content->>'overall_score')::numeric AS overall_score,
    (ea.content->'credibility_metrics'->>'valid')::boolean AS credibility_valid,
    ea.updated_at AS artifact_updated_at
  FROM evaluation_jobs ej
  JOIN manuscripts m ON m.id = ej.manuscript_id
  -- GOVERNANCE: Deterministic canonical artifact selection
  LEFT JOIN evaluation_artifacts ea 
    ON ea.job_id = ej.id::text 
    AND ea.artifact_type = 'one_page_summary'  -- ← Canonical type only
  WHERE 
    m.created_by = auth.uid()  -- ← RLS enforcement (INVOKER mode relies on this)
    AND (p_status IS NULL OR ej.status = p_status)
    AND (p_since IS NULL OR ej.created_at >= p_since)
  ORDER BY ej.created_at DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION list_my_artifacts IS
  'A8: List owner artifacts with filters. SECURITY INVOKER (RLS-based). Canonical artifact type: one_page_summary.';

-- ============================================================================
-- 5B. CREATE_ARTIFACT_COLLECTION (SECURITY INVOKER)
-- ============================================================================

CREATE OR REPLACE FUNCTION create_artifact_collection(
  p_name text,
  p_description text DEFAULT NULL,
  p_artifact_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER  -- ← GOVERNANCE: Owner operation, no privilege escalation
AS $$
DECLARE
  v_collection_id uuid;
  v_artifact_id uuid;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Validate: user owns all artifacts (via manuscripts)
  IF EXISTS (
    SELECT 1 
    FROM unnest(p_artifact_ids) aid
    WHERE NOT EXISTS (
      SELECT 1 
      FROM evaluation_jobs ej
      JOIN manuscripts m ON m.id = ej.manuscript_id
      WHERE ej.id = aid 
        AND m.created_by = v_user_id
    )
  ) THEN
    RAISE EXCEPTION 'Cannot add artifacts not owned by user';
  END IF;
  
  -- Create collection
  INSERT INTO artifact_collections (name, description, created_by)
  VALUES (p_name, p_description, v_user_id)
  RETURNING id INTO v_collection_id;
  
  -- Add artifacts
  FOREACH v_artifact_id IN ARRAY p_artifact_ids LOOP
    INSERT INTO collection_artifacts (collection_id, job_id, added_by)
    VALUES (v_collection_id, v_artifact_id, v_user_id);
  END LOOP;
  
  RETURN v_collection_id;
END;
$$;

COMMENT ON FUNCTION create_artifact_collection IS
  'A8: Create collection with owned artifacts. SECURITY INVOKER (RLS-based ownership validation).';

-- ============================================================================
-- 5C. SHARE_ARTIFACT_COLLECTION (SECURITY DEFINER)
-- ============================================================================

CREATE OR REPLACE FUNCTION share_artifact_collection(
  p_collection_id uuid,
  p_expires_hours int DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER  -- ← GOVERNANCE: Token creation requires privilege to write hash
AS $$
DECLARE
  v_token text;
  v_token_hash bytea;
  v_expires_at timestamptz;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  -- Validate: user owns collection
  IF NOT EXISTS (
    SELECT 1 FROM artifact_collections
    WHERE id = p_collection_id AND created_by = v_user_id
  ) THEN
    RAISE EXCEPTION 'Collection not found or access denied';
  END IF;
  
  -- Generate token (32 bytes, URL-safe base64)
  v_token := encode(gen_random_bytes(32), 'base64');
  v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');
  
  -- Hash token (SHA-256)
  v_token_hash := digest(v_token, 'sha256');
  
  -- Calculate expiry
  IF p_expires_hours IS NOT NULL THEN
    v_expires_at := now() + (p_expires_hours || ' hours')::interval;
  END IF;
  
  -- Revoke existing active share (one active share per collection)
  UPDATE collection_shares
  SET revoked_at = now()
  WHERE collection_id = p_collection_id
    AND revoked_at IS NULL;
  
  -- Create new share
  INSERT INTO collection_shares (
    collection_id,
    token_hash,
    created_by,
    expires_at
  ) VALUES (
    p_collection_id,
    v_token_hash,
    v_user_id,
    v_expires_at
  );
  
  -- Return plaintext token (ONLY TIME it's visible)
  RETURN v_token;
END;
$$;

COMMENT ON FUNCTION share_artifact_collection IS
  'A8: Create share token for collection (extends A7 pattern). SECURITY DEFINER for hash storage. Returns plaintext token once.';

-- ============================================================================
-- 5D. REVOKE_COLLECTION_SHARE (SECURITY DEFINER)
-- ============================================================================

CREATE OR REPLACE FUNCTION revoke_collection_share_by_token(
  p_token text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER  -- ← GOVERNANCE: Token lookup requires privilege
AS $$
DECLARE
  v_token_hash bytea;
  v_user_id uuid;
  v_rows_updated int;
BEGIN
  v_user_id := auth.uid();
  v_token_hash := digest(p_token, 'sha256');
  
  -- Revoke share (owner-only)
  UPDATE collection_shares cs
  SET revoked_at = now()
  FROM artifact_collections ac
  WHERE cs.token_hash = v_token_hash
    AND cs.collection_id = ac.id
    AND ac.created_by = v_user_id
    AND cs.revoked_at IS NULL
  RETURNING 1 INTO v_rows_updated;
  
  RETURN (v_rows_updated = 1);
END;
$$;

COMMENT ON FUNCTION revoke_collection_share_by_token IS
  'A8: Revoke collection share (owner-only). SECURITY DEFINER for token hash lookup. Idempotent.';

-- ============================================================================
-- 5E. GET_PUBLIC_ARTIFACT_COLLECTION (SECURITY DEFINER, ANON-CALLABLE)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_public_artifact_collection(
  p_token text
)
RETURNS TABLE (
  collection_id uuid,
  collection_name text,
  collection_description text,
  artifacts jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER  -- ← GOVERNANCE: Anon access requires privilege bypass
AS $$
DECLARE
  v_token_hash bytea;
  v_share_id uuid;
  v_collection_id uuid;
  v_collection_name text;
  v_collection_description text;
  v_artifacts jsonb;
BEGIN
  v_token_hash := digest(p_token, 'sha256');
  
  -- Lookup share (fail-closed: must be active, not expired, not revoked)
  SELECT 
    cs.id,
    cs.collection_id,
    ac.name,
    ac.description
  INTO 
    v_share_id,
    v_collection_id,
    v_collection_name,
    v_collection_description
  FROM collection_shares cs
  JOIN artifact_collections ac ON ac.id = cs.collection_id
  WHERE cs.token_hash = v_token_hash
    AND cs.revoked_at IS NULL
    AND (cs.expires_at IS NULL OR cs.expires_at > now());
  
  -- Fail-closed: invalid/revoked/expired → no results
  IF v_share_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Build artifacts array (canonical artifacts only)
  SELECT jsonb_agg(
    jsonb_build_object(
      'job_id', ej.id,
      'work_title', m.title,
      'status', ej.status,
      'created_at', ej.created_at,
      'artifact', ea.content
    )
    ORDER BY ca.added_at DESC
  )
  INTO v_artifacts
  FROM collection_artifacts ca
  JOIN evaluation_jobs ej ON ej.id = ca.job_id
  JOIN manuscripts m ON m.id = ej.manuscript_id
  LEFT JOIN evaluation_artifacts ea 
    ON ea.job_id = ej.id::text 
    AND ea.artifact_type = 'one_page_summary'  -- ← Canonical type only
  WHERE ca.collection_id = v_collection_id;
  
  -- Best-effort view tracking (silent failure OK)
  BEGIN
    UPDATE collection_shares
    SET 
      view_count = view_count + 1,
      last_viewed_at = now()
    WHERE id = v_share_id;
  EXCEPTION
    WHEN OTHERS THEN NULL;  -- Silent failure for tracking
  END;
  
  -- Return single row
  RETURN QUERY SELECT v_collection_id, v_collection_name, v_collection_description, COALESCE(v_artifacts, '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION get_public_artifact_collection IS
  'A8: Public collection view via token (anon-callable). SECURITY DEFINER for RLS bypass. Fail-closed on invalid/revoked/expired.';

--------------------------------------------------------------------------------
-- 6. GOVERNANCE VERIFICATION
--------------------------------------------------------------------------------

-- Verify SECURITY INVOKER functions (should NOT appear in pg_proc as DEFINER)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT proname 
    FROM pg_proc 
    WHERE proname IN ('list_my_artifacts', 'create_artifact_collection')
      AND prosecdef = true  -- prosecdef = true means SECURITY DEFINER
  LOOP
    RAISE WARNING 'GOVERNANCE VIOLATION: % should be SECURITY INVOKER, found SECURITY DEFINER', r.proname;
  END LOOP;
END $$;

-- Verify SECURITY DEFINER functions (public projections only)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT proname 
    FROM pg_proc 
    WHERE proname IN ('share_artifact_collection', 'revoke_collection_share_by_token', 'get_public_artifact_collection')
      AND prosecdef = false  -- prosecdef = false means SECURITY INVOKER
  LOOP
    RAISE WARNING 'GOVERNANCE VIOLATION: % should be SECURITY DEFINER, found SECURITY INVOKER', r.proname;
  END LOOP;
END $$;
