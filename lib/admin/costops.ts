/**
 * CostOps Dashboard — Data Layer
 *
 * Aggregates LLM usage from the `job_costs` table into a single dashboard
 * payload: KPI summary, model/phase breakdowns, recent jobs, alerts, and
 * provider status.
 *
 * All monetary values are **integer USD cents** to avoid floating-point drift.
 *
 * @module lib/admin/costops
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTrackedCostCents } from "@/lib/jobs/cost";
import { formatUsdFromCents } from "@/lib/admin/formatMoney";

// ─── Types ──────────────────────────────────────────────────────────

export type CostOpsSeverity = "ok" | "watch" | "danger" | "unknown";

export interface CostOpsMoneyBreakdown {
  usageCents: number;
  fixedAllocatedCents: number;
  totalCents: number;
}

export interface CostOpsSummary {
  currency: "USD";
  today: CostOpsMoneyBreakdown;
  monthToDate: CostOpsMoneyBreakdown;
  projectedMonthEndCents: number;
  monthlyBudgetCents: number | null;
  budgetRemainingCents: number | null;
  budgetUsedPct: number | null;
  allTimeTotalCents: number;
  last7dUsageCents: number;
  jobsWithCosts: number;
  totalEvaluationJobs: number;
  untrackedJobs: number;
  callCount: number;
  avgUsageCostPerJobCents: number;
  failedJobUsageCents: number;
  retriedUsageCents: number;
  topModel: string | null;
  topPhase: string | null;
  mostExpensiveJobId: string | null;
  mostExpensiveJobCostCents: number;
  generatedAt: string;
}

export interface CostOpsBreakdownRow {
  key: string;
  usageCents: number;
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  avgCostPerCallCents: number;
}

export interface CostOpsJobRow {
  jobId: string;
  manuscriptId: string | null;
  status: string | null;
  phase: string | null;
  usageCents: number;
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  firstCalledAt: string | null;
  lastCalledAt: string | null;
}

export interface CostOpsAlert {
  code: string;
  severity: CostOpsSeverity;
  title: string;
  detail: string;
}

export interface CostOpsProviderStatus {
  provider: string;
  status: "configured" | "missing_env" | "manual";
  detail: string;
}

export interface CostOpsDashboardData {
  summary: CostOpsSummary;
  modelBreakdown: CostOpsBreakdownRow[];
  phaseBreakdown: CostOpsBreakdownRow[];
  recentJobs: CostOpsJobRow[];
  providerStatus: CostOpsProviderStatus[];
  alerts: CostOpsAlert[];
  warnings: string[];
}

// ─── Helpers ────────────────────────────────────────────────────────

function safeNum(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function startOfTodayIso(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfMonthIso(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function sevenDaysAgoIso(): string {
  return new Date(Date.now() - 7 * 86_400_000).toISOString();
}

function daysElapsedInMonth(): number {
  const now = new Date();
  return now.getUTCDate();
}

function daysInCurrentMonth(): number {
  const now = new Date();
  return new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).getUTCDate();
}

// ─── Monthly budget (env-configurable) ──────────────────────────────

const MONTHLY_BUDGET_CENTS: number | null = (() => {
  const raw = process.env.COSTOPS_MONTHLY_BUDGET_USD;
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
})();

// ─── Data fetching ──────────────────────────────────────────────────

interface RawCostRow {
  job_id: string;
  phase: string | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_cents: number | null;
  called_at: string | null;
}

async function fetchAllCosts(): Promise<RawCostRow[]> {
  const supabase = createAdminClient();
  const rows: RawCostRow[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("job_costs")
      .select("job_id, phase, model, input_tokens, output_tokens, cost_cents, called_at")
      .range(from, from + pageSize - 1)
      .order("called_at", { ascending: false });

    if (error) {
      console.error("[costops] Error fetching costs:", error);
      break;
    }
    if (!data || data.length === 0) break;
    rows.push(...(data as RawCostRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

interface RawJobRow {
  id: string;
  manuscript_id: string | null;
  status: string | null;
}

async function fetchJobMetadata(jobIds: string[]): Promise<Map<string, RawJobRow>> {
  if (jobIds.length === 0) return new Map();
  const supabase = createAdminClient();
  const map = new Map<string, RawJobRow>();

  // Batch in groups of 100 for IN-filter safety
  for (let i = 0; i < jobIds.length; i += 100) {
    const batch = jobIds.slice(i, i + 100);
    const { data, error } = await supabase
      .from("evaluation_jobs")
      .select("id, manuscript_id, status")
      .in("id", batch);

    if (error) {
      console.error("[costops] Error fetching job metadata:", error);
      continue;
    }
    for (const row of data ?? []) {
      map.set(row.id, row as RawJobRow);
    }
  }

  return map;
}

// ─── Aggregation ────────────────────────────────────────────────────

function buildModelBreakdown(rows: RawCostRow[]): CostOpsBreakdownRow[] {
  const map = new Map<string, { cost: number; calls: number; inTok: number; outTok: number }>();

  for (const r of rows) {
    const key = r.model ?? "unknown";
    const entry = map.get(key) ?? { cost: 0, calls: 0, inTok: 0, outTok: 0 };
    entry.cost += resolveTrackedCostCents({
      model: r.model,
      inputTokens: r.input_tokens,
      outputTokens: r.output_tokens,
      recordedCostCents: r.cost_cents,
    });
    entry.calls += 1;
    entry.inTok += safeNum(r.input_tokens);
    entry.outTok += safeNum(r.output_tokens);
    map.set(key, entry);
  }

  return [...map.entries()]
    .map(([key, v]) => ({
      key,
      usageCents: v.cost,
      callCount: v.calls,
      inputTokens: v.inTok,
      outputTokens: v.outTok,
      avgCostPerCallCents: v.calls > 0 ? v.cost / v.calls : 0,
    }))
    .sort((a, b) => b.usageCents - a.usageCents);
}

function buildPhaseBreakdown(rows: RawCostRow[]): CostOpsBreakdownRow[] {
  const map = new Map<string, { cost: number; calls: number; inTok: number; outTok: number }>();

  for (const r of rows) {
    const key = r.phase ?? "unknown";
    const entry = map.get(key) ?? { cost: 0, calls: 0, inTok: 0, outTok: 0 };
    entry.cost += resolveTrackedCostCents({
      model: r.model,
      inputTokens: r.input_tokens,
      outputTokens: r.output_tokens,
      recordedCostCents: r.cost_cents,
    });
    entry.calls += 1;
    entry.inTok += safeNum(r.input_tokens);
    entry.outTok += safeNum(r.output_tokens);
    map.set(key, entry);
  }

  return [...map.entries()]
    .map(([key, v]) => ({
      key,
      usageCents: v.cost,
      callCount: v.calls,
      inputTokens: v.inTok,
      outputTokens: v.outTok,
      avgCostPerCallCents: v.calls > 0 ? v.cost / v.calls : 0,
    }))
    .sort((a, b) => b.usageCents - a.usageCents);
}

function buildJobRows(
  rows: RawCostRow[],
  jobMeta: Map<string, RawJobRow>,
): CostOpsJobRow[] {
  const jobMap = new Map<
    string,
    {
      cost: number;
      calls: number;
      inTok: number;
      outTok: number;
      phases: Set<string>;
      first: string | null;
      last: string | null;
    }
  >();

  for (const r of rows) {
    const jid = r.job_id;
    const entry = jobMap.get(jid) ?? {
      cost: 0,
      calls: 0,
      inTok: 0,
      outTok: 0,
      phases: new Set<string>(),
      first: null,
      last: null,
    };
    entry.cost += resolveTrackedCostCents({
      model: r.model,
      inputTokens: r.input_tokens,
      outputTokens: r.output_tokens,
      recordedCostCents: r.cost_cents,
    });
    entry.calls += 1;
    entry.inTok += safeNum(r.input_tokens);
    entry.outTok += safeNum(r.output_tokens);
    if (r.phase) entry.phases.add(r.phase);
    if (r.called_at) {
      if (!entry.first || r.called_at < entry.first) entry.first = r.called_at;
      if (!entry.last || r.called_at > entry.last) entry.last = r.called_at;
    }
    jobMap.set(jid, entry);
  }

  return [...jobMap.entries()]
    .map(([jobId, v]) => {
      const meta = jobMeta.get(jobId);
      return {
        jobId,
        manuscriptId: meta?.manuscript_id ?? null,
        status: meta?.status ?? null,
        phase: [...v.phases].join(", ") || null,
        usageCents: v.cost,
        callCount: v.calls,
        inputTokens: v.inTok,
        outputTokens: v.outTok,
        firstCalledAt: v.first,
        lastCalledAt: v.last,
      };
    })
    .sort((a, b) => b.usageCents - a.usageCents)
    .slice(0, 50);
}

// ─── Alerts ─────────────────────────────────────────────────────────

function buildAlerts(
  todayCents: number,
  mtdCents: number,
  projectedCents: number,
  budgetCents: number | null,
  failedCents: number,
  topModelPct: number,
): CostOpsAlert[] {
  const alerts: CostOpsAlert[] = [];

  if (budgetCents !== null && mtdCents > budgetCents) {
    alerts.push({
      code: "OVER_BUDGET",
      severity: "danger",
      title: "Over monthly budget",
      detail: `Month-to-date spend (${formatUsdFromCents(mtdCents)}) exceeds the ${formatUsdFromCents(budgetCents)} budget.`,
    });
  } else if (budgetCents !== null && projectedCents > budgetCents) {
    alerts.push({
      code: "PROJECTED_OVER_BUDGET",
      severity: "watch",
      title: "Projected to exceed budget",
      detail: `At current pace, month-end spend will be ~${formatUsdFromCents(projectedCents)} vs ${formatUsdFromCents(budgetCents)} budget.`,
    });
  }

  if (todayCents > 500) {
    alerts.push({
      code: "HIGH_DAILY_SPEND",
      severity: "watch",
      title: "High daily spend",
      detail: `Today's spend is ${formatUsdFromCents(todayCents)}. Review recent jobs for unexpected volume.`,
    });
  }

  if (failedCents > 100) {
    alerts.push({
      code: "WASTED_ON_FAILURES",
      severity: "watch",
      title: "Spend on failed jobs",
      detail: `${formatUsdFromCents(failedCents)} wasted on failed evaluation jobs this month.`,
    });
  }

  if (topModelPct > 80) {
    alerts.push({
      code: "MODEL_CONCENTRATION",
      severity: "watch",
      title: "Model concentration risk",
      detail: `Over ${Math.round(topModelPct)}% of spend is on a single model. Consider routing more phases to cheaper models.`,
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      code: "ALL_CLEAR",
      severity: "ok",
      title: "All clear",
      detail: "No spend anomalies detected.",
    });
  }

  return alerts;
}

// ─── Provider status ────────────────────────────────────────────────

function getProviderStatus(): CostOpsProviderStatus[] {
  const statuses: CostOpsProviderStatus[] = [];

  statuses.push({
    provider: "OpenAI",
    status: process.env.OPENAI_API_KEY ? "configured" : "missing_env",
    detail: process.env.OPENAI_API_KEY
      ? "API key set. Cost data from job_costs table."
      : "OPENAI_API_KEY not set.",
  });

  statuses.push({
    provider: "Supabase",
    status: process.env.SUPABASE_SERVICE_ROLE_KEY ? "configured" : "missing_env",
    detail: process.env.SUPABASE_SERVICE_ROLE_KEY
      ? "Service role key set."
      : "SUPABASE_SERVICE_ROLE_KEY not set.",
  });

  statuses.push({
    provider: "Vercel",
    status: "manual",
    detail: "Vercel hosting costs tracked manually. Check your Vercel billing dashboard.",
  });

  return statuses;
}

// ─── Main entry point ───────────────────────────────────────────────

export async function getCostOpsDashboardData(): Promise<CostOpsDashboardData> {
  const supabase = createAdminClient();
  const warnings: string[] = [];
  const now = new Date();

  let allRows: RawCostRow[];
  try {
    allRows = await fetchAllCosts();
  } catch {
    warnings.push("Failed to fetch cost data from Supabase. Showing zeros.");
    allRows = [];
  }

  const todayIso = startOfTodayIso();
  const monthIso = startOfMonthIso();
  const sevenDaysIso = sevenDaysAgoIso();

  const todayRows = allRows.filter((r) => (r.called_at ?? "") >= todayIso);
  const mtdRows = allRows.filter((r) => (r.called_at ?? "") >= monthIso);
  const last7dRows = allRows.filter((r) => (r.called_at ?? "") >= sevenDaysIso);

  const sumCents = (rows: RawCostRow[]) => rows.reduce((s, r) => s + resolveTrackedCostCents({
    model: r.model,
    inputTokens: r.input_tokens,
    outputTokens: r.output_tokens,
    recordedCostCents: r.cost_cents,
  }), 0);

  const todayCents = sumCents(todayRows);
  const mtdCents = sumCents(mtdRows);
  const last7dCents = sumCents(last7dRows);
  const allTimeTotalCents = sumCents(allRows);
  const totalCalls = allRows.length;

  const uniqueJobIds = [...new Set(allRows.map((r) => r.job_id).filter(Boolean))];
  const jobsWithCosts = uniqueJobIds.length;

  let jobMeta: Map<string, RawJobRow>;
  try {
    jobMeta = await fetchJobMetadata(uniqueJobIds);
  } catch {
    warnings.push("Failed to fetch job metadata.");
    jobMeta = new Map();
  }

  // Count total evaluation jobs and untracked ones
  let totalEvaluationJobs = 0;
  let untrackedJobs = 0;
  try {
    const { count: totalCount } = await supabase
      .from("evaluation_jobs")
      .select("id", { count: "exact", head: true })
      .in("status", ["complete", "failed"]);
    totalEvaluationJobs = totalCount ?? 0;
    untrackedJobs = Math.max(0, totalEvaluationJobs - jobsWithCosts);
  } catch {
    warnings.push("Could not count total evaluation jobs.");
  }

  // Failed job spend (MTD)
  const failedJobIds = new Set<string>();
  for (const [jid, meta] of jobMeta.entries()) {
    if (meta.status === "failed") failedJobIds.add(jid);
  }
  const failedCents = sumCents(mtdRows.filter((r) => failedJobIds.has(r.job_id)));

  // Avg cost per job (MTD)
  const mtdJobIds = new Set(mtdRows.map((r) => r.job_id));
  const avgUsageCostPerJobCents = mtdJobIds.size > 0 ? mtdCents / mtdJobIds.size : 0;

  // Month-end projection
  const elapsed = daysElapsedInMonth();
  const totalDays = daysInCurrentMonth();
  const projectedCents = elapsed > 0 ? Math.round((mtdCents / elapsed) * totalDays) : 0;

  // Top model + top phase
  const modelBreakdown = buildModelBreakdown(allRows);
  const phaseBreakdown = buildPhaseBreakdown(allRows);
  const topModel = modelBreakdown[0]?.key ?? null;
  const topPhase = phaseBreakdown[0]?.key ?? null;

  const totalAllCents = sumCents(allRows);
  const topModelPct = modelBreakdown[0] && totalAllCents > 0
    ? (modelBreakdown[0].usageCents / totalAllCents) * 100
    : 0;

  // Most expensive job
  const jobRows = buildJobRows(allRows, jobMeta);
  const mostExpensiveJob = jobRows[0] ?? null;

  const summary: CostOpsSummary = {
    currency: "USD",
    today: { usageCents: todayCents, fixedAllocatedCents: 0, totalCents: todayCents },
    monthToDate: { usageCents: mtdCents, fixedAllocatedCents: 0, totalCents: mtdCents },
    projectedMonthEndCents: projectedCents,
    monthlyBudgetCents: MONTHLY_BUDGET_CENTS,
    budgetRemainingCents: MONTHLY_BUDGET_CENTS !== null ? MONTHLY_BUDGET_CENTS - mtdCents : null,
    budgetUsedPct: MONTHLY_BUDGET_CENTS !== null && MONTHLY_BUDGET_CENTS > 0
      ? Math.round((mtdCents / MONTHLY_BUDGET_CENTS) * 100)
      : null,
    allTimeTotalCents,
    last7dUsageCents: last7dCents,
    jobsWithCosts,
    totalEvaluationJobs,
    untrackedJobs,
    callCount: totalCalls,
    avgUsageCostPerJobCents,
    failedJobUsageCents: failedCents,
    retriedUsageCents: 0,
    topModel,
    topPhase,
    mostExpensiveJobId: mostExpensiveJob?.jobId ?? null,
    mostExpensiveJobCostCents: mostExpensiveJob?.usageCents ?? 0,
    generatedAt: now.toISOString(),
  };

  const alerts = buildAlerts(
    todayCents,
    mtdCents,
    projectedCents,
    MONTHLY_BUDGET_CENTS,
    failedCents,
    topModelPct,
  );

  return {
    summary,
    modelBreakdown,
    phaseBreakdown,
    recentJobs: jobRows,
    providerStatus: getProviderStatus(),
    alerts,
    warnings,
  };
}

// ─── Backfill ───────────────────────────────────────────────────────

export interface BackfillResult {
  backfilledCount: number;
  estimatedTotalCents: number;
  skippedCount: number;
  errors: string[];
}

/**
 * Backfill estimated costs for completed evaluation jobs that have no
 * `job_costs` entries. Uses the average cost per tracked evaluation
 * (from existing data) or a configurable fallback.
 *
 * Inserts a single summary row per untracked job with phase="backfill_estimate"
 * so the data is clearly distinguishable from real tracked costs.
 *
 * Safe to call multiple times — skips jobs that already have cost entries.
 */
export async function backfillHistoricalCosts(): Promise<BackfillResult> {
  const supabase = createAdminClient();
  const errors: string[] = [];

  // 1. Get all job IDs that already have cost entries
  const trackedJobIds = new Set<string>();
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("job_costs")
      .select("job_id")
      .range(from, from + pageSize - 1);
    if (error) {
      errors.push(`Error fetching tracked job IDs: ${error.message}`);
      break;
    }
    if (!data || data.length === 0) break;
    for (const row of data) trackedJobIds.add(row.job_id);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  // 2. Calculate average cost per tracked evaluation
  let avgCostCentsPerJob = 564; // fallback: $5.64 (reasonable estimate)
  if (trackedJobIds.size > 0) {
    const { data: costSums } = await supabase
      .from("job_costs")
      .select("cost_cents");
    if (costSums && costSums.length > 0) {
      const totalTracked = costSums.reduce((s, r) => s + safeNum(r.cost_cents), 0);
      avgCostCentsPerJob = Math.max(1, Math.round(totalTracked / trackedJobIds.size));
    }
  }

  // 3. Get all completed/failed evaluation jobs
  const { data: allJobs, error: jobsError } = await supabase
    .from("evaluation_jobs")
    .select("id, status, created_at")
    .in("status", ["complete", "failed"])
    .order("created_at", { ascending: true });

  if (jobsError) {
    errors.push(`Error fetching evaluation jobs: ${jobsError.message}`);
    return { backfilledCount: 0, estimatedTotalCents: 0, skippedCount: 0, errors };
  }

  // 4. Filter to untracked jobs
  const untrackedJobs = (allJobs ?? []).filter((j) => !trackedJobIds.has(j.id));

  if (untrackedJobs.length === 0) {
    return { backfilledCount: 0, estimatedTotalCents: 0, skippedCount: 0, errors };
  }

  // 5. Insert backfill estimates in batches
  let backfilledCount = 0;
  let estimatedTotalCents = 0;
  let skippedCount = 0;

  for (let i = 0; i < untrackedJobs.length; i += 50) {
    const batch = untrackedJobs.slice(i, i + 50);
    const rows = batch.map((j) => ({
      job_id: j.id,
      phase: "backfill_estimate",
      model: "gpt-5.1",
      input_tokens: 0,
      output_tokens: 0,
      cost_cents: avgCostCentsPerJob,
      called_at: j.created_at ?? new Date().toISOString(),
    }));

    const { error: insertError } = await supabase
      .from("job_costs")
      .insert(rows);

    if (insertError) {
      errors.push(`Batch insert error (offset ${i}): ${insertError.message}`);
      skippedCount += batch.length;
    } else {
      backfilledCount += batch.length;
      estimatedTotalCents += avgCostCentsPerJob * batch.length;
    }
  }

  return { backfilledCount, estimatedTotalCents, skippedCount, errors };
}
