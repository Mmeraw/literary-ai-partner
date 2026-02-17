/**
 * Job Cost Tracker
 *
 * Tracks per-job cost accumulation for LLM API calls.
 * Provides read-only queries for system visibility (diagnostics).
 *
 * Cost is tracked in **USD cents** (integer) to avoid floating point drift.
 * Each job can accumulate costs across multiple phases.
 *
 * @module lib/jobs/cost
 * @see docs/PHASE_A5_DAY2_BACKPRESSURE_COST.md
 */

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cost entry for a single LLM call within a job
 */
export interface CostEntry {
  /** Job ID */
  jobId: string;
  /** Processing phase (e.g., "evaluation", "revision", "conversion") */
  phase: string;
  /** LLM model used (e.g., "gpt-4o", "gpt-4o-mini") */
  model: string;
  /** Input tokens consumed */
  inputTokens: number;
  /** Output tokens consumed */
  outputTokens: number;
  /** Cost in USD cents (integer) */
  costCents: number;
  /** Timestamp of the API call (ISO string preferred) */
  calledAt: string;
}

/**
 * Aggregated cost summary for a single job
 */
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

/**
 * System-wide cost snapshot
 */
export interface CostSnapshot {
  /** Total cost in USD cents across all jobs */
  totalCostCents: number;
  /** Cost in the last 24 hours (cents) */
  costLast24hCents: number;
  /** Cost in the last 7 days (cents) */
  costLast7dCents: number;
  /** Average cost per job (cents) */
  avgCostPerJobCents: number;
  /** Number of jobs with cost data */
  jobsWithCosts: number;
  /** Most expensive model */
  topModel: string | null;
  /** Snapshot timestamp */
  snapshotAt: string;
}

/**
 * Cost breakdown by model
 */
export interface ModelCostBreakdown {
  model: string;
  totalCostCents: number;
  callCount: number;
  avgCostPerCallCents: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

// ─── Model Pricing (USD per 1K tokens) ─────────────────────────────
//
// NOTE: These values are treated as configuration constants for relative tracking,
// not a billing authority. Cost calculation returns an integer number of cents.
//
const MODEL_PRICING_USD_PER_1K: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 0.25, output: 1.0 },
  "gpt-4o-mini": { input: 0.015, output: 0.06 },
  "gpt-4-turbo": { input: 1.0, output: 3.0 },
  "gpt-3.5-turbo": { input: 0.05, output: 0.15 },
};

function safeNumber(n: unknown, fallback = 0): number {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

/**
 * Calculate cost in USD cents (integer) for a given model and token usage.
 */
export function calculateCostCents(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing =
    MODEL_PRICING_USD_PER_1K[model] ?? MODEL_PRICING_USD_PER_1K["gpt-4o-mini"];

  const inTok = Math.max(0, Math.floor(safeNumber(inputTokens, 0)));
  const outTok = Math.max(0, Math.floor(safeNumber(outputTokens, 0)));

  const inputUsd = (inTok / 1000) * pricing.input;
  const outputUsd = (outTok / 1000) * pricing.output;

  // Return integer cents.
  return Math.round((inputUsd + outputUsd) * 100);
}

/**
 * Record a cost entry for a job.
 *
 * Inserts into the job_costs table. Non-blocking — errors are logged
 * but do not fail the calling operation.
 */
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

  if (error) {
    console.error("[cost] Failed to record cost:", error);
    // Non-blocking: don't throw
  }
}

/**
 * Get cost summary for a specific job.
 */
export async function getJobCostSummary(jobId: string): Promise<JobCostSummary | null> {
  const supabase = createAdminClient();

  const { data: costs, error: costsError } = await supabase
    .from("job_costs")
    .select("phase, model, input_tokens, output_tokens, cost_cents")
    .eq("job_id", jobId);

  if (costsError) {
    console.error("[cost] Error fetching job costs:", costsError);
    throw costsError;
  }

  if (!costs || costs.length === 0) return null;

  const { data: job, error: jobError } = await supabase
    .from("evaluation_jobs")
    .select("manuscript_id, status, created_at")
    .eq("id", jobId)
    .single();

  if (jobError) {
    console.error("[cost] Error fetching job:", jobError);
  }

  const phases = [...new Set(costs.map((c) => c.phase))];

  return {
    jobId,
    manuscriptId: job?.manuscript_id ?? null,
    totalCostCents: costs.reduce((sum, c) => sum + (c.cost_cents ?? 0), 0),
    totalInputTokens: costs.reduce((sum, c) => sum + (c.input_tokens ?? 0), 0),
    totalOutputTokens: costs.reduce((sum, c) => sum + (c.output_tokens ?? 0), 0),
    callCount: costs.length,
    phases,
    createdAt: job?.created_at ?? "",
    status: job?.status ?? "unknown",
  };
}

/**
 * Get system-wide cost snapshot.
 */
export async function getCostSnapshot(): Promise<CostSnapshot> {
  const supabase = createAdminClient();
  const now = new Date();

  const twentyFourHoursAgoIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgoIso = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch all costs (simple + predictable for Day 2 scope).
  const { data: allCosts, error: allError } = await supabase
    .from("job_costs")
    .select("job_id, cost_cents, model, called_at");

  if (allError) {
    console.error("[cost] Error fetching all costs:", allError);
    throw allError;
  }

  const costs = allCosts ?? [];

  const totalCostCents = costs.reduce((sum, c) => sum + (c.cost_cents ?? 0), 0);

  // Because called_at is expected to be ISO timestamps, string compare is safe here.
  const costLast24hCents = costs
    .filter((c) => (c.called_at ?? "") >= twentyFourHoursAgoIso)
    .reduce((sum, c) => sum + (c.cost_cents ?? 0), 0);

  const costLast7dCents = costs
    .filter((c) => (c.called_at ?? "") >= sevenDaysAgoIso)
    .reduce((sum, c) => sum + (c.cost_cents ?? 0), 0);

  const uniqueJobs = new Set(costs.map((c) => c.job_id).filter(Boolean));
  const jobsWithCosts = uniqueJobs.size;

  const avgCostPerJobCents =
    jobsWithCosts > 0 ? Math.round(totalCostCents / jobsWithCosts) : 0;

  // Top model by total cost
  const modelCosts = new Map<string, number>();
  for (const c of costs) {
    const model = c.model ?? "unknown";
    modelCosts.set(model, (modelCosts.get(model) ?? 0) + (c.cost_cents ?? 0));
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
    avgCostPerJobCents,
    jobsWithCosts,
    topModel,
    snapshotAt: now.toISOString(),
  };
}

/**
 * Get cost breakdown by model.
 */
export async function getModelCostBreakdown(): Promise<ModelCostBreakdown[]> {
  const supabase = createAdminClient();

  const { data: costs, error } = await supabase
    .from("job_costs")
    .select("model, cost_cents, input_tokens, output_tokens");

  if (error) {
    console.error("[cost] Error fetching model costs:", error);
    throw error;
  }

  const modelMap = new Map<
    string,
    { totalCost: number; count: number; inputTokens: number; outputTokens: number }
  >();

  for (const c of costs ?? []) {
    const model = c.model ?? "unknown";
    const entry = modelMap.get(model) ?? {
      totalCost: 0,
      count: 0,
      inputTokens: 0,
      outputTokens: 0,
    };

    entry.totalCost += c.cost_cents ?? 0;
    entry.count += 1;
    entry.inputTokens += c.input_tokens ?? 0;
    entry.outputTokens += c.output_tokens ?? 0;

    modelMap.set(model, entry);
  }

  const breakdown: ModelCostBreakdown[] = [];
  modelMap.forEach((entry, model) => {
    breakdown.push({
      model,
      totalCostCents: entry.totalCost,
      callCount: entry.count,
      avgCostPerCallCents: entry.count > 0 ? Math.round(entry.totalCost / entry.count) : 0,
      totalInputTokens: entry.inputTokens,
      totalOutputTokens: entry.outputTokens,
    });
  });

  return breakdown.sort((a, b) => b.totalCostCents - a.totalCostCents);
}
