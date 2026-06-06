import { createAdminClient } from '@/lib/supabase/admin';
import type { CostOpsRange } from '@/lib/admin/costops';
import { getCostRangeWindow } from '@/lib/admin/costops';

export type RevenueTotals = {
  grossRevenueCents: number;
  stripeFeesCents: number;
  refundCents: number;
  netRevenueCents: number;
};

export type RevenueByJob = Map<string, RevenueTotals>;

type RevenueRow = {
  job_id: string | null;
  gross_revenue_cents: number | null;
  stripe_fee_cents: number | null;
  refund_cents: number | null;
  net_revenue_cents: number | null;
};

function n(v: number | null | undefined): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export async function getRevenueForRange(range: CostOpsRange): Promise<{ totals: RevenueTotals; byJob: RevenueByJob }> {
  const supabase = createAdminClient();
  const { start } = getCostRangeWindow(range);

  let query = supabase
    .from('revenue_events')
    .select('job_id, gross_revenue_cents, stripe_fee_cents, refund_cents, net_revenue_cents');

  if (start) query = query.gte('created_at', start);

  const { data, error } = await query;
  if (error) {
    return {
      totals: { grossRevenueCents: 0, stripeFeesCents: 0, refundCents: 0, netRevenueCents: 0 },
      byJob: new Map(),
    };
  }

  const rows = (data ?? []) as RevenueRow[];
  const totals: RevenueTotals = { grossRevenueCents: 0, stripeFeesCents: 0, refundCents: 0, netRevenueCents: 0 };
  const byJob: RevenueByJob = new Map();

  for (const row of rows) {
    const gross = n(row.gross_revenue_cents);
    const fees = n(row.stripe_fee_cents);
    const refunds = n(row.refund_cents);
    const net = typeof row.net_revenue_cents === 'number' ? row.net_revenue_cents : gross - fees - refunds;

    totals.grossRevenueCents += gross;
    totals.stripeFeesCents += fees;
    totals.refundCents += refunds;
    totals.netRevenueCents += net;

    if (!row.job_id) continue;
    const existing = byJob.get(row.job_id) ?? { grossRevenueCents: 0, stripeFeesCents: 0, refundCents: 0, netRevenueCents: 0 };
    existing.grossRevenueCents += gross;
    existing.stripeFeesCents += fees;
    existing.refundCents += refunds;
    existing.netRevenueCents += net;
    byJob.set(row.job_id, existing);
  }

  return { totals, byJob };
}
