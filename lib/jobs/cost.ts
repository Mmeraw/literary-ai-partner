/**
 * Job Cost Tracker
 *
 * Tracks per-job cost accumulation for LLM API calls. Provides read-only
 * queries for system visibility and CostOps dashboards.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export interface CostEntry {
  jobId: string;
  phase: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  calledAt: string;
}

export interface JobCostSummary {
  jobId: string;
  manuscriptId: string | null;
  totalCostCents: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  callCount: number;
  phases: string[];
  createdAt: string;
  status: string;
}

export interface CostSnapshot {
  totalCostCents: number;
  costLast24hCents: number;
  costLast7dCents: number;
  avgCostPerJobCents: number;
  jobsWithCosts: number;
  topModel: string | null;
  snapshotAt: string;
}

export interface ModelCostBreakdown {
  model: string;
  totalCostCents: number;
  callCount: number;
  avgCostPerCallCents: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

// USD per 1K tokens. Keep in sync with OpenAI pricing when models change.
const MODEL_PRICING_USD_PER_1K: Record<string, { input: number; output: number }> = {
  "gpt-5.1": { input: 0.00125, output: 0.01 },
  "gpt-5": { input: 0.00125, output: 0.01 },
  "gpt-5-mini": { input: 0.00025, output: 0.002 },
  "gpt-5-nano": { input: 0.00005, output: 0.0004 },
  "gpt-5.4": { input: 0.0025, output: 0.015 },
  "gpt-5.5": { input: 0.005, output: 0.03 },
  "gpt-4.1": { input: 0.002, output: 0.008 },
  "gpt-4.1-mini": { input: 0.0004, output: 0.0016 },
  "gpt-4.1-nano": { input: 0.0001, output: 0.0004 },
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4-turbo": { input: 0.01, output: 0.03 },
  "gpt-3.5-turbo": { input: 0.0005, output: 0.0015 },
  "o3": { input: 0.002, output: 0.008 },
  "o3-mini": { input: 0.0011, output: 0.0044 },
};

function normalizeModelForPricing(model: string): string | null {
  const raw = String(model ?? "").trim().toLowerCase();
  if (!raw) return null;

  if (MODEL_PRICING_USD_PER_1K[raw]) return raw;

  if (raw.startsWith("gpt-4.1-mini")) return "gpt-4.1-mini";
  if (raw.startsWith("gpt-4.1-nano")) return "gpt-4.1-nano";
  if (raw.startsWith("gpt-4.1")) return "gpt-4.1";
  if (raw.startsWith("gpt-4o-mini")) return "gpt-4o-mini";
  if (raw.startsWith("gpt-4o")) return "gpt-4o";
  if (raw.startsWith("gpt-5-mini")) return "gpt-5-mini";
  if (raw.startsWith("gpt-5-nano")) return "gpt-5-nano";
  if (raw.startsWith("gpt-5.1")) return "gpt-5.1";
  if (raw.startsWith("gpt-5")) return "gpt-5";
  if (raw.startsWith("o3-mini")) return "o3-mini";
  if (raw.startsWith("o3")) return "o3";
  if (raw.startsWith("gpt-4-turbo")) return "gpt-4-turbo";
  if (raw.startsWith("gpt-3.5-turbo")) return "gpt-3.5-turbo";

  return null;
}

function safeNumber(n: unknown, fallback = 0): number {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

export function calculateCostCents(model: string, inputTokens: number, outputTokens: number): number {
  const normalized = normalizeModelForPricing(model);
  if (!normalized) return 0;
  const pricing = MODEL_PRICING_USD_PER_1K[normalized];
  const inTok = Math.max(0, Math.floor(safeNumber(inputTokens, 0)));
  const outTok = Math.max(0, Math.floor(safeNumber(outputTokens, 0)));
  return Math.round(((inTok / 1000) * pricing.input + (outTok / 1000) * pricing.output) * 100);
}

export function estimateCostCentsPrecise(model: string, inputTokens: number, outputTokens: number): number | null {
  const normalized = normalizeModelForPricing(model);
  if (!normalized) return null;
  const pricing = MODEL_PRICING_USD_PER_1K[normalized];
  const inTok = Math.max(0, Math.floor(safeNumber(inputTokens, 0)));
  const outTok = Math.max(0, Math.floor(safeNumber(outputTokens, 0)));
  return ((inTok / 1000) * pricing.input + (outTok / 1000) * pricing.output) * 100;
}

export function resolveTrackedCostCents(params: {
  model: string | null | undefined;
  inputTokens: number | null | undefined;
  outputTokens: number | null | undefined;
  recordedCostCents: number | null | undefined;
}): number {
  const recorded = safeNumber(params.recordedCostCents, 0);
  const estimated = estimateCostCentsPrecise(params.model ?? "", params.inputTokens ?? 0, params.outputTokens ?? 0);

  if (estimated !== null) {
    if (estimated > 0) return estimated;
    if (recorded > 0) return recorded;
    return estimated;
  }

  return recorded;
}

export function trackCompletionCost(params: {
  jobId: string;
  phase: string;
  model: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
}): void {
  const { jobId, phase, model, usage } = params;
  const inputTokens = usage?.prompt_tokens ?? 0;
  const outputTokens = usage?.completion_tokens ?? 0;
  if (inputTokens === 0 && outputTokens === 0) return;

  recordCost({
    jobId,
    phase,
    model,
    inputTokens,
    outputTokens,
    costCents: calculateCostCents(model, inputTokens, outputTokens),
    calledAt: new Date().toISOString(),
  }).catch(() => {});
}

export async function recordCost(entry: CostEntry): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("job_costs").insert({
    job_id: entry.jobId,
    phase: entry.phase,
    model: entry.model,
    input_tokens: entry.inputTokens,
    output_tokens: entry.outputTokens,
    cost_cents: entry.costCents,
    called_at: entry.calledAt,
  });
  if (error) console.error("[cost] Failed to record cost:", error);
}

export async function getJobCostSummary(jobId: string): Promise<JobCostSummary | null> {
  const supabase = createAdminClient();
  const { data: costs, error: costsError } = await supabase
    .from("job_costs")
    .select("phase, model, input_tokens, output_tokens, cost_cents")
    .eq("job_id", jobId);

  if (costsError) throw costsError;
  if (!costs || costs.length === 0) return null;

  const { data: job } = await supabase
    .from("evaluation_jobs")
    .select("manuscript_id, status, created_at")
    .eq("id", jobId)
    .single();

  const phases = [...new Set(costs.map((cost) => cost.phase))];

  return {
    jobId,
    manuscriptId: job?.manuscript_id ?? null,
    totalCostCents: costs.reduce((sum, cost) => sum + resolveTrackedCostCents({ model: cost.model, inputTokens: cost.input_tokens, outputTokens: cost.output_tokens, recordedCostCents: cost.cost_cents }), 0),
    totalInputTokens: costs.reduce((sum, cost) => sum + (cost.input_tokens ?? 0), 0),
    totalOutputTokens: costs.reduce((sum, cost) => sum + (cost.output_tokens ?? 0), 0),
    callCount: costs.length,
    phases,
    createdAt: job?.created_at ?? "",
    status: job?.status ?? "unknown",
  };
}

export async function getCostSnapshot(): Promise<CostSnapshot> {
  const supabase = createAdminClient();
  const now = new Date();
  const twentyFourHoursAgoIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgoIso = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: allCosts, error } = await supabase
    .from("job_costs")
    .select("job_id, cost_cents, model, input_tokens, output_tokens, called_at");

  if (error) throw error;
  const costs = allCosts ?? [];
  const resolved = (cost: typeof costs[number]) => resolveTrackedCostCents({ model: cost.model, inputTokens: cost.input_tokens, outputTokens: cost.output_tokens, recordedCostCents: cost.cost_cents });
  const totalCostCents = costs.reduce((sum, cost) => sum + resolved(cost), 0);
  const costLast24hCents = costs.filter((cost) => (cost.called_at ?? "") >= twentyFourHoursAgoIso).reduce((sum, cost) => sum + resolved(cost), 0);
  const costLast7dCents = costs.filter((cost) => (cost.called_at ?? "") >= sevenDaysAgoIso).reduce((sum, cost) => sum + resolved(cost), 0);
  const uniqueJobs = new Set(costs.map((cost) => cost.job_id).filter(Boolean));

  const modelCosts = new Map<string, number>();
  for (const cost of costs) {
    const model = cost.model ?? "unknown";
    modelCosts.set(model, (modelCosts.get(model) ?? 0) + resolved(cost));
  }

  let topModel: string | null = null;
  let topModelCost = -1;
  for (const [model, cost] of modelCosts.entries()) {
    if (cost > topModelCost) {
      topModel = model;
      topModelCost = cost;
    }
  }

  return {
    totalCostCents,
    costLast24hCents,
    costLast7dCents,
    avgCostPerJobCents: uniqueJobs.size > 0 ? totalCostCents / uniqueJobs.size : 0,
    jobsWithCosts: uniqueJobs.size,
    topModel,
    snapshotAt: now.toISOString(),
  };
}

export async function getModelCostBreakdown(): Promise<ModelCostBreakdown[]> {
  const supabase = createAdminClient();
  const { data: costs, error } = await supabase
    .from("job_costs")
    .select("model, cost_cents, input_tokens, output_tokens");

  if (error) throw error;

  const modelMap = new Map<string, { totalCost: number; count: number; inputTokens: number; outputTokens: number }>();
  for (const cost of costs ?? []) {
    const model = cost.model ?? "unknown";
    const entry = modelMap.get(model) ?? { totalCost: 0, count: 0, inputTokens: 0, outputTokens: 0 };
    entry.totalCost += resolveTrackedCostCents({ model: cost.model, inputTokens: cost.input_tokens, outputTokens: cost.output_tokens, recordedCostCents: cost.cost_cents });
    entry.count += 1;
    entry.inputTokens += cost.input_tokens ?? 0;
    entry.outputTokens += cost.output_tokens ?? 0;
    modelMap.set(model, entry);
  }

  return [...modelMap.entries()]
    .map(([model, entry]) => ({
      model,
      totalCostCents: entry.totalCost,
      callCount: entry.count,
      avgCostPerCallCents: entry.count > 0 ? entry.totalCost / entry.count : 0,
      totalInputTokens: entry.inputTokens,
      totalOutputTokens: entry.outputTokens,
    }))
    .sort((a, b) => b.totalCostCents - a.totalCostCents);
}
