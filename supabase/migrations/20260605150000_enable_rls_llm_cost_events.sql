-- Enable RLS for llm_cost_events to satisfy table-level protection guardrails.
-- Safe/idempotent: only applies when the table exists.

DO $$
BEGIN
  IF to_regclass('public.llm_cost_events') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.llm_cost_events ENABLE ROW LEVEL SECURITY';

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'llm_cost_events'
        AND policyname = 'llm_cost_events_service_role_all'
    ) THEN
      EXECUTE 'CREATE POLICY llm_cost_events_service_role_all ON public.llm_cost_events FOR ALL TO service_role USING (true) WITH CHECK (true)';
    END IF;
  END IF;
END;
$$;