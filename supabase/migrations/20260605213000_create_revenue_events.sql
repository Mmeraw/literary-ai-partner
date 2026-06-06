-- Revenue ledger for CostOps profitability reporting.
-- Stores immutable financial event facts from Stripe + trusted internal/manual sources.

CREATE TABLE IF NOT EXISTS public.revenue_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  event_type text NOT NULL,
  stripe_event_id text UNIQUE,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  stripe_customer_id text,
  user_id uuid,
  job_id uuid,
  manuscript_id uuid,
  product_code text,
  tier text,
  gross_revenue_cents integer NOT NULL DEFAULT 0,
  stripe_fee_cents integer NOT NULL DEFAULT 0,
  refund_cents integer NOT NULL DEFAULT 0,
  net_revenue_cents integer GENERATED ALWAYS AS (gross_revenue_cents - stripe_fee_cents - refund_cents) STORED,
  currency text NOT NULL DEFAULT 'usd',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT revenue_events_source_check CHECK (source IN ('stripe', 'manual', 'internal_checkout')),
  CONSTRAINT revenue_events_event_type_check CHECK (
    event_type IN ('checkout_completed', 'payment_succeeded', 'refund', 'chargeback', 'manual_adjustment')
  ),
  CONSTRAINT revenue_events_nonnegative_gross CHECK (gross_revenue_cents >= 0),
  CONSTRAINT revenue_events_nonnegative_fees CHECK (stripe_fee_cents >= 0),
  CONSTRAINT revenue_events_nonnegative_refunds CHECK (refund_cents >= 0)
);

CREATE INDEX IF NOT EXISTS idx_revenue_events_created_at ON public.revenue_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_events_job_id ON public.revenue_events (job_id);
CREATE INDEX IF NOT EXISTS idx_revenue_events_event_type ON public.revenue_events (event_type);
CREATE INDEX IF NOT EXISTS idx_revenue_events_source ON public.revenue_events (source);
CREATE INDEX IF NOT EXISTS idx_revenue_events_tier ON public.revenue_events (tier);
CREATE INDEX IF NOT EXISTS idx_revenue_events_product_code ON public.revenue_events (product_code);

ALTER TABLE public.revenue_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'revenue_events'
      AND policyname = 'revenue_events_service_role_all'
  ) THEN
    CREATE POLICY revenue_events_service_role_all
      ON public.revenue_events
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;
