/**
 * CostOps — llm_cost_events data layer
 *
 * Queries the llm_cost_events table to support dedicated admin pages for
 * Agent Readiness and Revise Queue cost tracking, plus rollup totals for
 * the main CostOps dashboard.
 *
 * Privacy: raw text content (manuscripts, queries, synopses, bios) is
 * never stored in llm_cost_events. Only cost telemetry is persisted.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTrackedCostCents } from "@/lib/jobs/cost";
import { getCostRangeWindow, normalizeCostRange, type CostOpsRange } from "./costops";

export type LlmEventSource = "agent_readiness" | "revise_queue" | "evaluation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LlmCostEventRow {
  id: string;
  createdAt: string;
  source: LlmEventSource;
  activity: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  userId: string | null;
  evaluationJobId: string | null;
  manuscriptId: number | null;
  metadata: Record<string, unknown>;
}

export interface LlmEventActivityRow {
  activity: string;
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  avgCostPerCallCents: number;
  lastCalledAt: string | null;
}

export interface LlmEventModelRow {
  model: string;
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  avgCostPerCallCents: number;
}

export interface LlmEventSummary {
  source: LlmEventSource;
  range: CostOpsRange;
  rangeLabel: string;
  rangeStart: string | null;
  rangeEnd: string;
  totalCostCents: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCallCount: number;
  uniqueActivities: number;
  mostExpensiveActivity: string | null;
  topModel: string | null;
  generatedAt: string;
}

export interface LlmEventDashboardData {
  summary: LlmEventSummary;
  activityBreakdown: LlmEventActivityRow[];
  modelBreakdown: LlmEventModelRow[];
  recentEvents: LlmCostEventRow[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface RawEventRow {
  id: string;
  created_at: string;
  source: string;
  activity: string;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_cents: string | number | null;
  user_id: string | null;
  evaluation_job_id: string | null;
  manuscript_id: number | null;
  metadata: Record<string, unknown> | null;
}

function safeNum(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const parsed = Number(v);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function rowCost(row: RawEventRow): number {
  return resolveTrackedCostCents({
    model: row.model,
    inputTokens: safeNum(row.input_tokens),
    outputTokens: safeNum(row.output_tokens),
    recordedCostCents: safeNum(row.cost_cents),
  });
}

async function fetchEvents(source: LlmEventSource, start: string | null): Promise<RawEventRow[]> {
  const supabase = createAdminClient();
  const rows: RawEventRow[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    let query = supabase
      .from("llm_cost_events")
      .select("id, created_at, source, activity, model, input_tokens, output_tokens, cost_cents, user_id, evaluation_job_id, manuscript_id, metadata")
      .eq("source", source)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (start) query = query.gte("created_at", start);

    const { data, error } = await query;
    if (error) throw new Error(`llm_cost_events fetch error: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...(data as RawEventRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

function buildActivityBreakdown(rows: RawEventRow[]): LlmEventActivityRow[] {
  const map = new Map<string, { calls: number; inTok: number; outTok: number; cost: number; lastAt: string | null }>();

  for (const row of rows) {
    const activity = row.activity ?? "unknown";
    const entry = map.get(activity) ?? { calls: 0, inTok: 0, outTok: 0, cost: 0, lastAt: null };
    entry.calls += 1;
    entry.inTok += safeNum(row.input_tokens);
    entry.outTok += safeNum(row.output_tokens);
    entry.cost += rowCost(row);
    if (row.created_at && (!entry.lastAt || row.created_at > entry.lastAt)) entry.lastAt = row.created_at;
    map.set(activity, entry);
  }

  return [...map.entries()]
    .map(([activity, e]) => ({
      activity,
      callCount: e.calls,
      inputTokens: e.inTok,
      outputTokens: e.outTok,
      costCents: e.cost,
      avgCostPerCallCents: e.calls > 0 ? e.cost / e.calls : 0,
      lastCalledAt: e.lastAt,
    }))
    .sort((a, b) => b.costCents - a.costCents);
}

function buildModelBreakdown(rows: RawEventRow[]): LlmEventModelRow[] {
  const map = new Map<string, { calls: number; inTok: number; outTok: number; cost: number }>();

  for (const row of rows) {
    const model = row.model ?? "unknown";
    const entry = map.get(model) ?? { calls: 0, inTok: 0, outTok: 0, cost: 0 };
    entry.calls += 1;
    entry.inTok += safeNum(row.input_tokens);
    entry.outTok += safeNum(row.output_tokens);
    entry.cost += rowCost(row);
    map.set(model, entry);
  }

  return [...map.entries()]
    .map(([model, e]) => ({
      model,
      callCount: e.calls,
      inputTokens: e.inTok,
      outputTokens: e.outTok,
      costCents: e.cost,
      avgCostPerCallCents: e.calls > 0 ? e.cost / e.calls : 0,
    }))
    .sort((a, b) => b.costCents - a.costCents);
}

function toPublicRow(row: RawEventRow): LlmCostEventRow {
  return {
    id: row.id,
    createdAt: row.created_at,
    source: row.source as LlmEventSource,
    activity: row.activity,
    model: row.model,
    inputTokens: safeNum(row.input_tokens),
    outputTokens: safeNum(row.output_tokens),
    costCents: rowCost(row),
    userId: row.user_id,
    evaluationJobId: row.evaluation_job_id,
    manuscriptId: row.manuscript_id,
    metadata: row.metadata ?? {},
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getLlmEventDashboardData(
  source: LlmEventSource,
  rangeInput?: string | null,
): Promise<LlmEventDashboardData> {
  const warnings: string[] = [];
  const now = new Date();
  const range = normalizeCostRange(rangeInput);
  const rangeWindow = getCostRangeWindow(range, now);

  let rows: RawEventRow[] = [];
  try {
    rows = await fetchEvents(source, rangeWindow.start);
  } catch (err) {
    warnings.push(`Failed to fetch llm_cost_events: ${err instanceof Error ? err.message : "Unknown error"}`);
  }

  const activityBreakdown = buildActivityBreakdown(rows);
  const modelBreakdown = buildModelBreakdown(rows);
  const totalCostCents = rows.reduce((sum, row) => sum + rowCost(row), 0);
  const totalInputTokens = rows.reduce((sum, row) => sum + safeNum(row.input_tokens), 0);
  const totalOutputTokens = rows.reduce((sum, row) => sum + safeNum(row.output_tokens), 0);

  const summary: LlmEventSummary = {
    source,
    range,
    rangeLabel: rangeWindow.label,
    rangeStart: rangeWindow.start,
    rangeEnd: rangeWindow.end,
    totalCostCents,
    totalInputTokens,
    totalOutputTokens,
    totalCallCount: rows.length,
    uniqueActivities: activityBreakdown.length,
    mostExpensiveActivity: activityBreakdown[0]?.activity ?? null,
    topModel: modelBreakdown[0]?.model ?? null,
    generatedAt: now.toISOString(),
  };

  return {
    summary,
    activityBreakdown,
    modelBreakdown,
    recentEvents: rows.slice(0, 200).map(toPublicRow),
    warnings,
  };
}

export interface LlmEventRollupRow {
  source: LlmEventSource;
  totalCostCents: number;
  totalCallCount: number;
}

/** Lightweight rollup for the CostOps dashboard — totals by source for the selected range. */
export async function getLlmEventRollup(rangeInput?: string | null): Promise<LlmEventRollupRow[]> {
  const now = new Date();
  const range = normalizeCostRange(rangeInput);
  const rangeWindow = getCostRangeWindow(range, now);
  const supabase = createAdminClient();

  let query = supabase
    .from("llm_cost_events")
    .select("source, cost_cents, input_tokens, output_tokens, model");

  if (rangeWindow.start) query = query.gte("created_at", rangeWindow.start);

  const { data, error } = await query;
  if (error) return [];

  const map = new Map<string, { cost: number; count: number }>();
  for (const row of data ?? []) {
    const src = String(row.source ?? "unknown");
    const cost = resolveTrackedCostCents({
      model: row.model,
      inputTokens: safeNum(row.input_tokens),
      outputTokens: safeNum(row.output_tokens),
      recordedCostCents: safeNum(row.cost_cents),
    });
    const entry = map.get(src) ?? { cost: 0, count: 0 };
    entry.cost += cost;
    entry.count += 1;
    map.set(src, entry);
  }

  return [...map.entries()].map(([source, e]) => ({
    source: source as LlmEventSource,
    totalCostCents: e.cost,
    totalCallCount: e.count,
  }));
}
