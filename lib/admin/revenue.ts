import { createAdminClient } from "@/lib/supabase/admin";
import { getCostRangeWindow, normalizeCostRange } from "@/lib/admin/costops";

export interface RevenueRollup {
  grossRevenueCents: number;
  stripeFeeCents: number;
  refundCents: number;
  netRevenueCents: number;
  eventCount: number;
}

export interface DocumentCostRollup {
  documentGenerationCents: number;
  eventCount: number;
  estimated: boolean;
  missing: boolean;
  detail: string;
}

export interface JobRevenueRollup extends RevenueRollup {
  jobId: string;
}

interface RawRevenueEvent {
  job_id: string | null;
  gross_revenue_cents: number | null;
  stripe_fee_cents: number | null;
  refund_cents: number | null;
  net_revenue_cents?: number | null;
}

function safeNum(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readUsdEnvCents(name: string): number | null {
  const raw = process.env[name];
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
}

function emptyRevenue(): RevenueRollup {
  return { grossRevenueCents: 0, stripeFeeCents: 0, refundCents: 0, netRevenueCents: 0, eventCount: 0 };
}

function applyRevenueEvent(rollup: RevenueRollup, event: RawRevenueEvent): void {
  const gross = safeNum(event.gross_revenue_cents);
  const fee = safeNum(event.stripe_fee_cents);
  const refund = safeNum(event.refund_cents);
  rollup.grossRevenueCents += gross;
  rollup.stripeFeeCents += fee;
  rollup.refundCents += refund;
  rollup.netRevenueCents += typeof event.net_revenue_cents === "number" ? event.net_revenue_cents : gross - fee - refund;
  rollup.eventCount += 1;
}

export function grossProfitCents(netRevenueCents: number, totalCostCents: number): number {
  return netRevenueCents - totalCostCents;
}

export function grossMarginPct(netRevenueCents: number, grossProfit: number): number | null {
  if (netRevenueCents <= 0) return null;
  return (grossProfit / netRevenueCents) * 100;
}

export async function fetchRevenueRollup(rangeInput?: string | null): Promise<RevenueRollup> {
  const window = getCostRangeWindow(normalizeCostRange(rangeInput));
  const supabase = createAdminClient();
  let query = supabase
    .from("revenue_events")
    .select("job_id, gross_revenue_cents, stripe_fee_cents, refund_cents, net_revenue_cents")
    .order("created_at", { ascending: false });

  if (window.start) query = query.gte("created_at", window.start);
  query = query.lte("created_at", window.end);

  const { data, error } = await query;
  if (error) return emptyRevenue();

  const rollup = emptyRevenue();
  for (const event of (data ?? []) as RawRevenueEvent[]) applyRevenueEvent(rollup, event);
  return rollup;
}

export async function fetchRevenueByJob(rangeInput?: string | null): Promise<Map<string, JobRevenueRollup>> {
  const window = getCostRangeWindow(normalizeCostRange(rangeInput));
  const supabase = createAdminClient();
  let query = supabase
    .from("revenue_events")
    .select("job_id, gross_revenue_cents, stripe_fee_cents, refund_cents, net_revenue_cents")
    .not("job_id", "is", null)
    .order("created_at", { ascending: false });

  if (window.start) query = query.gte("created_at", window.start);
  query = query.lte("created_at", window.end);

  const { data, error } = await query;
  const map = new Map<string, JobRevenueRollup>();
  if (error) return map;

  for (const event of (data ?? []) as RawRevenueEvent[]) {
    if (!event.job_id) continue;
    const current = map.get(event.job_id) ?? { jobId: event.job_id, ...emptyRevenue() };
    applyRevenueEvent(current, event);
    map.set(event.job_id, current);
  }
  return map;
}

export async function fetchDocumentCostRollup(rangeInput?: string | null): Promise<DocumentCostRollup> {
  const range = normalizeCostRange(rangeInput);
  const window = getCostRangeWindow(range);
  const supabase = createAdminClient();
  let query = supabase
    .from("document_generation_events")
    .select("job_id, event_type, cost_cents")
    .order("created_at", { ascending: false });

  if (window.start) query = query.gte("created_at", window.start);
  query = query.lte("created_at", window.end);

  const { data, error } = await query;
  if (!error && data) {
    return {
      documentGenerationCents: data.reduce((sum, event) => sum + safeNum(event.cost_cents), 0),
      eventCount: data.length,
      estimated: false,
      missing: false,
      detail: "Exact tracked PDF/Word export cost from document_generation_events.",
    };
  }

  const monthlyEstimate = readUsdEnvCents("COSTOPS_DOCUMENT_GENERATION_MONTHLY_USD");
  if (monthlyEstimate !== null && range !== "all") {
    return {
      documentGenerationCents: Math.round((monthlyEstimate / 30) * (window.days ?? 0)),
      eventCount: 0,
      estimated: true,
      missing: false,
      detail: "Estimated from COSTOPS_DOCUMENT_GENERATION_MONTHLY_USD because exact document_generation_events are not available.",
    };
  }

  return {
    documentGenerationCents: 0,
    eventCount: 0,
    estimated: false,
    missing: true,
    detail: "Document generation cost is not included. Add document_generation_events or configure COSTOPS_DOCUMENT_GENERATION_MONTHLY_USD.",
  };
}
