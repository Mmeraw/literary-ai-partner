-- Migration: execute_query RPC for introspection queries
-- Purpose: Allow tests to query pg_catalog for storage metrics
-- Created: 2026-01-25
-- Security: Service role only (not exposed to application users)

CREATE OR REPLACE FUNCTION public.execute_query(query TEXT)
RETURNS TABLE(result JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY EXECUTE format('SELECT to_jsonb(t) FROM (%s) t', query);
END;
$$;

-- Grant to service role only
REVOKE ALL ON FUNCTION public.execute_query(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_query(TEXT) TO service_role;

COMMENT ON FUNCTION public.execute_query(TEXT) IS
  'Execute introspection queries for testing and monitoring. Service role only.';
