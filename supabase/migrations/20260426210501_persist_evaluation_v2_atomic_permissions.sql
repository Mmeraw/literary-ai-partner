-- CI compatibility split:
-- Keep 20260426210500 as a single SQL statement (CREATE FUNCTION only), and
-- apply ACL/comment updates in this follow-up migration as one top-level DO
-- command to avoid prepared-statement multi-command failures.

DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.persist_evaluation_v2_atomic(
    uuid,
    bigint,
    text,
    jsonb,
    text,
    text,
    jsonb,
    jsonb,
    timestamptz,
    timestamptz,
    text,
    integer,
    integer,
    timestamptz,
    timestamptz,
    timestamptz
  ) FROM PUBLIC;

  REVOKE ALL ON FUNCTION public.persist_evaluation_v2_atomic(
    uuid,
    bigint,
    text,
    jsonb,
    text,
    text,
    jsonb,
    jsonb,
    timestamptz,
    timestamptz,
    text,
    integer,
    integer,
    timestamptz,
    timestamptz,
    timestamptz
  ) FROM authenticated;

  REVOKE ALL ON FUNCTION public.persist_evaluation_v2_atomic(
    uuid,
    bigint,
    text,
    jsonb,
    text,
    text,
    jsonb,
    jsonb,
    timestamptz,
    timestamptz,
    text,
    integer,
    integer,
    timestamptz,
    timestamptz,
    timestamptz
  ) FROM anon;

  GRANT EXECUTE ON FUNCTION public.persist_evaluation_v2_atomic(
    uuid,
    bigint,
    text,
    jsonb,
    text,
    text,
    jsonb,
    jsonb,
    timestamptz,
    timestamptz,
    text,
    integer,
    integer,
    timestamptz,
    timestamptz,
    timestamptz
  ) TO service_role;

  COMMENT ON FUNCTION public.persist_evaluation_v2_atomic(
    uuid,
    bigint,
    text,
    jsonb,
    text,
    text,
    jsonb,
    jsonb,
    timestamptz,
    timestamptz,
    text,
    integer,
    integer,
    timestamptz,
    timestamptz,
    timestamptz
  ) IS 'Atomic boundary RPC: upsert evaluation_result_v2 artifact and complete evaluation job in one transaction.';
END;
$$;
