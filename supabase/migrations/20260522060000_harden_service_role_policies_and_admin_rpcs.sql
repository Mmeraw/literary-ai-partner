-- =============================================================================
-- Round 3 Hardening: Service-role policy scoping + admin RPC lock-down
-- =============================================================================
--
-- WHAT THIS FIXES:
--
-- 1. Five RLS policies named "Service role: full access" / "Service role full
--    access" were scoped to {public}, meaning their USING (true) WITH CHECK (true)
--    applied to EVERY role including anon. They are DROPped and recreated
--    explicitly TO service_role.
--
--    Tables affected:
--      • artifact_collections
--      • collection_artifacts
--      • collection_shares
--      • evaluation_artifacts
--      • wave_execution_attempts  (extra {public} policy — correct one already exists)
--
-- 2. admin_list_jobs and admin_retry_job (both overloads) have no role check
--    inside their bodies. Any authenticated user can list ALL jobs or re-queue
--    any job across all users. REVOKE EXECUTE from authenticated; service_role
--    callers (Next.js admin routes) are unaffected.
--
-- WHAT IS NOT CHANGED:
--
--   • vector extension stays in public schema — migration uses unqualified
--     vector(1536) type references; moving to extensions schema would require
--     rewriting every CREATE TABLE that uses the type. Advisor warning accepted.
--
--   • get_public_artifact_collection, get_public_report_share — token-gated
--     share links, must remain anon-accessible by design.
--
--   • create_report_share, share_artifact_collection, revoke_*_by_token —
--     all have auth.uid() null-check + ownership verification inside.
--     authenticated_security_definer warnings are correct-by-design.
--
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SECTION 1: Fix service-role policies scoped to {public}
-- -----------------------------------------------------------------------------

-- artifact_collections
DO $$
BEGIN
  IF to_regclass('public.artifact_collections') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Service role: full access" ON public.artifact_collections;
    CREATE POLICY "Service role: full access"
      ON public.artifact_collections
      TO service_role
      USING (true)
      WITH CHECK (true);
  ELSE
    RAISE NOTICE 'Skipping policy hardening: public.artifact_collections is absent';
  END IF;
END;
$$;

-- collection_artifacts
DO $$
BEGIN
  IF to_regclass('public.collection_artifacts') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Service role: full access" ON public.collection_artifacts;
    CREATE POLICY "Service role: full access"
      ON public.collection_artifacts
      TO service_role
      USING (true)
      WITH CHECK (true);
  ELSE
    RAISE NOTICE 'Skipping policy hardening: public.collection_artifacts is absent';
  END IF;
END;
$$;

-- collection_shares
DO $$
BEGIN
  IF to_regclass('public.collection_shares') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Service role: full access" ON public.collection_shares;
    CREATE POLICY "Service role: full access"
      ON public.collection_shares
      TO service_role
      USING (true)
      WITH CHECK (true);
  ELSE
    RAISE NOTICE 'Skipping policy hardening: public.collection_shares is absent';
  END IF;
END;
$$;

-- evaluation_artifacts (note: policy name has no colon — "Service role full access")
DO $$
BEGIN
  IF to_regclass('public.evaluation_artifacts') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Service role full access" ON public.evaluation_artifacts;
    CREATE POLICY "Service role full access"
      ON public.evaluation_artifacts
      TO service_role
      USING (true)
      WITH CHECK (true);
  ELSE
    RAISE NOTICE 'Skipping policy hardening: public.evaluation_artifacts is absent';
  END IF;
END;
$$;

-- wave_execution_attempts
-- A correct {service_role} policy "wave_execution_attempts_service_role_all"
-- already exists. DROP only the bad {public} duplicate.
DO $$
BEGIN
  IF to_regclass('public.wave_execution_attempts') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Service role full access" ON public.wave_execution_attempts;
  ELSE
    RAISE NOTICE 'Skipping policy cleanup: public.wave_execution_attempts is absent';
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- SECTION 2: Lock down admin RPCs — REVOKE from authenticated
-- -----------------------------------------------------------------------------

-- admin_list_jobs (single overload, 12-param signature)
DO $$
BEGIN
  IF to_regprocedure('public.admin_list_jobs(text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz,uuid,integer)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.admin_list_jobs(
      text,                        -- p_status
      text,                        -- p_job_type
      text,                        -- p_phase
      text,                        -- p_policy_family
      timestamp with time zone,    -- p_created_after
      timestamp with time zone,    -- p_created_before
      timestamp with time zone,    -- p_failed_after
      timestamp with time zone,    -- p_failed_before
      timestamp with time zone,    -- p_cursor_failed_at
      timestamp with time zone,    -- p_cursor_created_at
      uuid,                        -- p_cursor_id
      integer                      -- p_limit
    ) FROM authenticated;
  ELSE
    RAISE NOTICE 'Skipping revoke: admin_list_jobs overload is absent';
  END IF;
END;
$$;

-- admin_retry_job — overload 1: (p_job_id uuid)
DO $$
BEGIN
  IF to_regprocedure('public.admin_retry_job(uuid)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.admin_retry_job(uuid) FROM authenticated;
  ELSE
    RAISE NOTICE 'Skipping revoke: admin_retry_job(uuid) overload is absent';
  END IF;
END;
$$;

-- admin_retry_job — overload 2: (p_job_id uuid, p_reason text, p_actor uuid)
DO $$
BEGIN
  IF to_regprocedure('public.admin_retry_job(uuid,text,uuid)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.admin_retry_job(uuid, text, uuid) FROM authenticated;
  ELSE
    RAISE NOTICE 'Skipping revoke: admin_retry_job(uuid,text,uuid) overload is absent';
  END IF;
END;
$$;
