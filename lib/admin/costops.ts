/**
 * CostOps Dashboard - Data Layer
 *
 * Aggregates tracked LLM usage from `job_costs` and combines it with optional
 * monthly provider overhead allocations so admin pages can show total operating
 * cost by range without pretending unconfigured provider costs are known.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTrackedCostCents } from "@/lib/jobs/cost";
import { formatUsdFromCents } from "@/lib/admin/formatMoney";

export type CostOpsSeverity = "ok" | "watch" | "danger" | "unknown";
export type CostOpsRange = "24h" | "5d" | "30d" | "all";

export interface CostOpsMoneyBreakdown {
  usageCents: number;
  fixedAllocatedCents: number;
  totalCents: number;
}

export interface CostOpsProviderCostRow {
  provider: string;
  usageCents: number;
  fixedAllocatedCents: number;
  totalCents: number;
  source: "tracked" | "configured_monthly" | "manual_required";
  detail: string;
}

export interface CostOpsSummary {
  currency: "USD";
  range: CostOpsRange;
  rangeLabel: string;
  rangeStart: string | null;
  rangeEnd: string;
  today: CostOpsMoneyBreakdown;
  monthToDate: CostOpsMoneyBreakdown;
  selectedRange: CostOpsMoneyBreakdown;
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
  completeness: "complete_if_overheads_configured" | "llm_only";
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

const EXPECTED_PHASE_BREAKDOWN_KEYS = [
  "Phase 0 / Intake",
  "Seed 0.5a / Story Ledger",
  "Seed 0.5b / DREAM Seed",
  "Phase 1A / Character Sweep",
  "Phase 3A / Independent Read",
  "Pass 3 Read-Ahead",
  "Phase 3B / DREAM Document",
  "WAVE Revision (expected gpt-5.1 if LLM-backed)",
  "Phase 5 / Revision Queue (expected gpt-5.1 if LLM-backed)",
];

function normalizePhaseKey(phase: string | null): string {
  const raw = (phase ?? "unknown").toLowerCase().replace(/[\s-]+/g, "_");
  if (raw === "phase_0" || raw === "phase0" || raw.includes("pass0") || raw.includes("intake")) return "Phase 0 / Intake";
  if (/phase0?\.5a|phase_?0_?5a|phase05a|0_?5a|story_ledger|full_context_ledger/.test(raw)) return "Seed 0.5a / Story Ledger";
  if (/phase0?\.5b|phase_?0_?5b|phase05b|0_?5b|dream_seed|editorial_dream_seed/.test(raw)) return "Seed 0.5b / DREAM Seed";
  if (/phase_?1a|pass1a|character_sweep/.test(raw)) return "Phase 1A / Character Sweep";
  if (/phase_?3a|pass3a|preflight|independent_read/.test(raw)) return "Phase 3A / Independent Read";
  if (/pass3_read_ahead|read_ahead/.test(raw)) return "Pass 3 Read-Ahead";
  if (/phase_?3b|pass3b|dream_document|longform/.test(raw)) return "Phase 3B / DREAM Document";
  if (/wave_revision|execute_wave|wave_modules|wave_readiness|wave_layer/.test(raw) || raw === "wave") return "WAVE Revision (expected gpt-5.1 if LLM-backed)";
  if (/phase_?5|pass5|revision_queue|revise_queue|trustedpath|trusted_path/.test(raw) || raw === "revise" || raw === "rev") return "Phase 5 / Revision Queue (expected gpt-5.1 if LLM-backed)";
  return phase ?? "unknown";
}

function includeExpectedPhaseBreakdownRows(rows: CostOpsBreakdownRow[]): CostOpsBreakdownRow[] {
  const existing = new Set(rows.map((row) => row.key));
  const expectedRows = EXPECTED_PHASE_BREAKDOWN_KEYS
    .filter((key) => !existing.has(key))
    .map((key) => ({
      key,
      usageCents: 0,
      callCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      avgCostPerCallCents: 0,
    }));
  return [...rows, ...expectedRows];
}

export interface CostOpsJobRow {
  jobId: string;
  manuscriptId: string | null;
  status: string | null;
  phase: string | null;
  usageCents: number;
  allocatedOverheadCents: number;
  totalCostCents: number;
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
  providerCosts: CostOpsProviderCostRow[];
  modelBreakdown: CostOpsBreakdownRow[];
  phaseBreakdown: CostOpsBreakdownRow[];
  recentJobs: CostOpsJobRow[];
  providerStatus: CostOpsProviderStatus[];
  alerts: CostOpsAlert[];
  warnings: string[];
}

interface RawCostRow {
  job_id: string;
  phase: string | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_cents: number | null;
  called_at: string | null;
}

interface RawJobRow {
  id: string;
  manuscript_id: string | null;
  status: string | null;
}

const RANGE_LABELS: Record<CostOpsRange, string> = {
  "24h": "Last 24 hours",
  "5d": "Last 5 days",
  "30d": "Last 30 days",
  all: "All time",
};

const MONTHLY_BUDGET_CENTS = readUsdEnvCents("COSTOPS_MONTHLY_BUDGET_USD");

function safeNum(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function readUsdEnvCents(name: string): number | null {
  const raw = process.env[name];
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n * 100 : null;
}

export function normalizeCostRange(value: string | null | undefined): CostOpsRange {
  if (value === "24h" || value === "5d" || value === "30d" || value === "all") return value;
  return "24h";
}

export function getCostRangeWindow(range: CostOpsRange, now = new Date()): { start: string | null; end: string; label: string; days: number | null } {
  const end = now.toISOString();
  if (range === "all") return { start: null, end, label: RANGE_LABELS.all, days: null };
  const days = range === "24h" ? 1 : range === "5d" ? 5 : 30;
  return {
    start: new Date(now.getTime() - days * 86_400_000).toISOString(),
    end,
    label: RANGE_LABELS[range],
    days,
  };
}

function startOfTodayIso(now = new Date()): string {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfMonthIso(now = new Date()): string {
  const d = new Date(now);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function sevenDaysAgoIso(now = new Date()): string {
  return new Date(now.getTime() - 7 * 86_400_000).toISOString();
}

function daysElapsedInMonth(now = new Date()): number {
  return now.getUTCDate();
}

function daysInCurrentMonth(now = new Date()): number {
  return new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).getUTCDate();
}

function rowCostCents(row: RawCostRow): number {
  return resolveTrackedCostCents({
    model: row.model,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    recordedCostCents: row.cost_cents,
  });
}

function filterRowsByStart(rows: RawCostRow[], start: string | null): RawCostRow[] {
  if (!start) return rows;
  return rows.filter((row) => (row.called_at ?? "") >= start);
}

function sumCents(rows: RawCostRow[]): number {
  return rows.reduce((sum, row) => sum + rowCostCents(row), 0);
}

function getMonthlyOverheads(): Array<{ provider: string; cents: number | null; envName: string }> {
  return [
    { provider: "Vercel", cents: readUsdEnvCents("COSTOPS_VERCEL_MONTHLY_USD"), envName: "COSTOPS_VERCEL_MONTHLY_USD" },
    { provider: "Supabase", cents: readUsdEnvCents("COSTOPS_SUPABASE_MONTHLY_USD"), envName: "COSTOPS_SUPABASE_MONTHLY_USD" },
    { provider: "Other", cents: readUsdEnvCents("COSTOPS_OTHER_MONTHLY_USD"), envName: "COSTOPS_OTHER_MONTHLY_USD" },
  ];
}

function allocateMonthlyOverheadCents(range: CostOpsRange, days: number | null, monthlyCents: number | null): number {
  if (!monthlyCents) return 0;
  if (range === "all") return 0;
  return (monthlyCents / 30) * (days ?? 0);
}

export function getConfiguredOverheadForRange(range: CostOpsRange, days: number | null): { rows: CostOpsProviderCostRow[]; totalCents: number; missingProviders: string[] } {
  const rows: CostOpsProviderCostRow[] = [];
  const missingProviders: string[] = [];

  for (const provider of getMonthlyOverheads()) {
    const allocated = allocateMonthlyOverheadCents(range, days, provider.cents);
    if (provider.cents === null) missingProviders.push(provider.provider);
    rows.push({
      provider: provider.provider,
      usageCents: 0,
      fixedAllocatedCents: allocated,
      totalCents: allocated,
      source: provider.cents === null ? "manual_required" : "configured_monthly",
      detail: provider.cents === null
        ? `Set ${provider.envName} to include this provider in total cost.`
        : `${formatUsdFromCents(provider.cents)} monthly allocation prorated into the selected range.`,
    });
  }

  return {
    rows,
    totalCents: rows.reduce((sum, row) => sum + row.totalCents, 0),
    missingProviders,
  };
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

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...(data as RawCostRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function fetchJobMetadata(jobIds: string[]): Promise<Map<string, RawJobRow>> {
  if (jobIds.length === 0) return new Map();
  const supabase = createAdminClient();
  const map = new Map<string, RawJobRow>();

  for (let i = 0; i < jobIds.length; i += 100) {
    const batch = jobIds.slice(i, i + 100);
    const { data, error } = await supabase
      .from("evaluation_jobs")
      .select("id, manuscript_id, status")
      .in("id", batch);

    if (error) continue;
    for (const row of data ?? []) map.set(row.id, row as RawJobRow);
  }

  return map;
}

function buildBreakdown(rows: RawCostRow[], keyFor: (row: RawCostRow) => string): CostOpsBreakdownRow[] {
  const map = new Map<string, { cost: number; calls: number; inTok: number; outTok: number }>();

  for (const row of rows) {
    const key = keyFor(row);
    const entry = map.get(key) ?? { cost: 0, calls: 0, inTok: 0, outTok: 0 };
    entry.cost += rowCostCents(row);
    entry.calls += 1;
    entry.inTok += safeNum(row.input_tokens);
    entry.outTok += safeNum(row.output_tokens);
    map.set(key, entry);
  }

  return [...map.entries()]
    .map(([key, value]) => ({
      key,
      usageCents: value.cost,
      callCount: value.calls,
      inputTokens: value.inTok,
      outputTokens: value.outTok,
      avgCostPerCallCents: value.calls > 0 ? value.cost / value.calls : 0,
    }))
    .sort((a, b) => b.usageCents - a.usageCents);
}

function buildJobRows(rows: RawCostRow[], jobMeta: Map<string, RawJobRow>, allocatedOverheadCents: number): CostOpsJobRow[] {
  const jobMap = new Map<string, { cost: number; calls: number; inTok: number; outTok: number; phases: Set<string>; first: string | null; last: string | null }>();

  for (const row of rows) {
    const jobId = row.job_id;
    if (!jobId) continue;
    const entry = jobMap.get(jobId) ?? { cost: 0, calls: 0, inTok: 0, outTok: 0, phases: new Set<string>(), first: null, last: null };
    entry.cost += rowCostCents(row);
    entry.calls += 1;
    entry.inTok += safeNum(row.input_tokens);
    entry.outTok += safeNum(row.output_tokens);
    if (row.phase) entry.phases.add(row.phase);
    if (row.called_at) {
      if (!entry.first || row.called_at < entry.first) entry.first = row.called_at;
      if (!entry.last || row.called_at > entry.last) entry.last = row.called_at;
    }
    jobMap.set(jobId, entry);
  }

  const jobs = [...jobMap.entries()];
  const totalLlm = jobs.reduce((sum, [, value]) => sum + value.cost, 0);
  const equalShare = jobs.length > 0 ? allocatedOverheadCents / jobs.length : 0;

  return jobs
    .map(([jobId, value]) => {
      const meta = jobMeta.get(jobId);
      const overhead = totalLlm > 0 ? allocatedOverheadCents * (value.cost / totalLlm) : equalShare;
      return {
        jobId,
        manuscriptId: meta?.manuscript_id ?? null,
        status: meta?.status ?? null,
        phase: [...value.phases].join(", ") || null,
        usageCents: value.cost,
        allocatedOverheadCents: overhead,
        totalCostCents: value.cost + overhead,
        callCount: value.calls,
        inputTokens: value.inTok,
        outputTokens: value.outTok,
        firstCalledAt: value.first,
        lastCalledAt: value.last,
      };
    })
    .sort((a, b) => b.totalCostCents - a.totalCostCents)
    .slice(0, 50);
}

function buildAlerts(params: { selectedTotalCents: number; mtdTotalCents: number; projectedCents: number; budgetCents: number | null; failedCents: number; topModelPct: number; missingProviders: string[] }): CostOpsAlert[] {
  const alerts: CostOpsAlert[] = [];

  if (params.budgetCents !== null && params.mtdTotalCents > params.budgetCents) {
    alerts.push({ code: "OVER_BUDGET", severity: "danger", title: "Over monthly budget", detail: `Month-to-date total cost (${formatUsdFromCents(params.mtdTotalCents)}) exceeds the ${formatUsdFromCents(params.budgetCents)} budget.` });
  } else if (params.budgetCents !== null && params.projectedCents > params.budgetCents) {
    alerts.push({ code: "PROJECTED_OVER_BUDGET", severity: "watch", title: "Projected to exceed budget", detail: `At current pace, month-end total cost will be ~${formatUsdFromCents(params.projectedCents)}.` });
  }

  if (params.selectedTotalCents > 500) {
    alerts.push({ code: "HIGH_RANGE_SPEND", severity: "watch", title: "High selected-range spend", detail: `Selected range total is ${formatUsdFromCents(params.selectedTotalCents)}.` });
  }

  if (params.failedCents > 100) {
    alerts.push({ code: "WASTED_ON_FAILURES", severity: "watch", title: "Spend on failed jobs", detail: `${formatUsdFromCents(params.failedCents)} spent on failed jobs this month.` });
  }

  if (params.topModelPct > 80) {
    alerts.push({ code: "MODEL_CONCENTRATION", severity: "watch", title: "Model concentration risk", detail: `Over ${Math.round(params.topModelPct)}% of tracked LLM spend is on one model.` });
  }

  if (params.missingProviders.length > 0) {
    alerts.push({ code: "MANUAL_COSTS_MISSING", severity: "watch", title: "Provider costs need configuration", detail: `${params.missingProviders.join(", ")} are not included until their monthly cost env vars are set.` });
  }

  if (alerts.length === 0) {
    alerts.push({ code: "ALL_CLEAR", severity: "ok", title: "All clear", detail: "No spend anomalies detected for this range." });
  }

  return alerts;
}

function getProviderStatus(): CostOpsProviderStatus[] {
  return [
    {
      provider: "OpenAI",
      status: process.env.OPENAI_API_KEY ? "configured" : "missing_env",
      detail: process.env.OPENAI_API_KEY ? "Tracked from job_costs token telemetry." : "OPENAI_API_KEY not set.",
    },
    {
      provider: "Supabase",
      status: process.env.COSTOPS_SUPABASE_MONTHLY_USD ? "configured" : "manual",
      detail: process.env.COSTOPS_SUPABASE_MONTHLY_USD ? "Monthly overhead allocation configured." : "Set COSTOPS_SUPABASE_MONTHLY_USD to include billing allocation.",
    },
    {
      provider: "Vercel",
      status: process.env.COSTOPS_VERCEL_MONTHLY_USD ? "configured" : "manual",
      detail: process.env.COSTOPS_VERCEL_MONTHLY_USD ? "Monthly overhead allocation configured." : "Set COSTOPS_VERCEL_MONTHLY_USD to include billing allocation.",
    },
  ];
}

export async function getCostOpsDashboardData(rangeInput?: string | null): Promise<CostOpsDashboardData> {
  const supabase = createAdminClient();
  const warnings: string[] = [];
  const now = new Date();
  const range = normalizeCostRange(rangeInput);
  const rangeWindow = getCostRangeWindow(range, now);

  let allRows: RawCostRow[] = [];
  try {
    allRows = await fetchAllCosts();
  } catch {
    warnings.push("Failed to fetch cost data from Supabase. Showing zeros.");
  }

  const selectedRows = filterRowsByStart(allRows, rangeWindow.start);
  const todayRows = filterRowsByStart(allRows, startOfTodayIso(now));
  const mtdRows = filterRowsByStart(allRows, startOfMonthIso(now));
  const last7dRows = filterRowsByStart(allRows, sevenDaysAgoIso(now));

  const selectedLlmCents = sumCents(selectedRows);
  const todayLlmCents = sumCents(todayRows);
  const mtdLlmCents = sumCents(mtdRows);
  const last7dCents = sumCents(last7dRows);
  const allTimeLlmCents = sumCents(allRows);
  const totalCalls = selectedRows.length;

  const overhead = getConfiguredOverheadForRange(range, rangeWindow.days);
  const mtdOverhead = getConfiguredOverheadForRange("30d", daysElapsedInMonth(now));
  const todayOverhead = getConfiguredOverheadForRange("24h", 1);

  const providerCosts: CostOpsProviderCostRow[] = [
    {
      provider: "OpenAI",
      usageCents: selectedLlmCents,
      fixedAllocatedCents: 0,
      totalCents: selectedLlmCents,
      source: "tracked",
      detail: "Exact tracked LLM token spend from job_costs.",
    },
    ...overhead.rows,
  ];

  const uniqueJobIds = [...new Set(selectedRows.map((row) => row.job_id).filter(Boolean))];
  const allUniqueJobIds = [...new Set(allRows.map((row) => row.job_id).filter(Boolean))];
  const jobsWithCosts = allUniqueJobIds.length;

  let jobMeta = new Map<string, RawJobRow>();
  try {
    jobMeta = await fetchJobMetadata(uniqueJobIds);
  } catch {
    warnings.push("Failed to fetch job metadata.");
  }

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

  const failedJobIds = new Set<string>();
  for (const [jobId, meta] of jobMeta.entries()) {
    if (meta.status === "failed") failedJobIds.add(jobId);
  }
  const failedCents = sumCents(mtdRows.filter((row) => failedJobIds.has(row.job_id)));

  const selectedJobIds = new Set(selectedRows.map((row) => row.job_id).filter(Boolean));
  const avgUsageCostPerJobCents = selectedJobIds.size > 0 ? (selectedLlmCents + overhead.totalCents) / selectedJobIds.size : 0;

  const elapsed = daysElapsedInMonth(now);
  const totalDays = daysInCurrentMonth(now);
  const projectedCents = elapsed > 0 ? Math.round(((mtdLlmCents + mtdOverhead.totalCents) / elapsed) * totalDays) : 0;

  const modelBreakdown = buildBreakdown(selectedRows, (row) => row.model ?? "unknown");
  const phaseBreakdown = includeExpectedPhaseBreakdownRows(buildBreakdown(selectedRows, (row) => normalizePhaseKey(row.phase)));
  const topModel = modelBreakdown[0]?.key ?? null;
  const topPhase = phaseBreakdown.find((row) => row.callCount > 0)?.key ?? null;
  const topModelPct = modelBreakdown[0] && selectedLlmCents > 0 ? (modelBreakdown[0].usageCents / selectedLlmCents) * 100 : 0;

  const jobRows = buildJobRows(selectedRows, jobMeta, overhead.totalCents);
  const mostExpensiveJob = jobRows[0] ?? null;
  const selectedTotalCents = selectedLlmCents + overhead.totalCents;
  const mtdTotalCents = mtdLlmCents + mtdOverhead.totalCents;

  const summary: CostOpsSummary = {
    currency: "USD",
    range,
    rangeLabel: rangeWindow.label,
    rangeStart: rangeWindow.start,
    rangeEnd: rangeWindow.end,
    today: { usageCents: todayLlmCents, fixedAllocatedCents: todayOverhead.totalCents, totalCents: todayLlmCents + todayOverhead.totalCents },
    monthToDate: { usageCents: mtdLlmCents, fixedAllocatedCents: mtdOverhead.totalCents, totalCents: mtdTotalCents },
    selectedRange: { usageCents: selectedLlmCents, fixedAllocatedCents: overhead.totalCents, totalCents: selectedTotalCents },
    projectedMonthEndCents: projectedCents,
    monthlyBudgetCents: MONTHLY_BUDGET_CENTS,
    budgetRemainingCents: MONTHLY_BUDGET_CENTS !== null ? MONTHLY_BUDGET_CENTS - mtdTotalCents : null,
    budgetUsedPct: MONTHLY_BUDGET_CENTS !== null && MONTHLY_BUDGET_CENTS > 0 ? Math.round((mtdTotalCents / MONTHLY_BUDGET_CENTS) * 100) : null,
    allTimeTotalCents: allTimeLlmCents,
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
    mostExpensiveJobCostCents: mostExpensiveJob?.totalCostCents ?? 0,
    completeness: overhead.missingProviders.length === 0 ? "complete_if_overheads_configured" : "llm_only",
    generatedAt: now.toISOString(),
  };

  if (range === "all" && overhead.rows.some((row) => row.source === "configured_monthly")) {
    warnings.push("All-time view includes exact tracked LLM costs only; monthly overhead allocations apply to time-bounded ranges.");
  }

  const alerts = buildAlerts({
    selectedTotalCents,
    mtdTotalCents,
    projectedCents,
    budgetCents: MONTHLY_BUDGET_CENTS,
    failedCents,
    topModelPct,
    missingProviders: overhead.missingProviders,
  });

  return {
    summary,
    providerCosts,
    modelBreakdown,
    phaseBreakdown,
    recentJobs: jobRows,
    providerStatus: getProviderStatus(),
    alerts,
    warnings,
  };
}

export interface BackfillResult {
  backfilledCount: number;
  estimatedTotalCents: number;
  skippedCount: number;
  errors: string[];
}

export async function backfillHistoricalCosts(): Promise<BackfillResult> {
  const supabase = createAdminClient();
  const errors: string[] = [];
  const trackedJobIds = new Set<string>();
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase.from("job_costs").select("job_id").range(from, from + pageSize - 1);
    if (error) {
      errors.push(`Error fetching tracked job IDs: ${error.message}`);
      break;
    }
    if (!data || data.length === 0) break;
    for (const row of data) trackedJobIds.add(row.job_id);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  let avgCostCentsPerJob = 564;
  if (trackedJobIds.size > 0) {
    const { data: costSums } = await supabase.from("job_costs").select("cost_cents");
    if (costSums && costSums.length > 0) {
      const totalTracked = costSums.reduce((sum, row) => sum + safeNum(row.cost_cents), 0);
      avgCostCentsPerJob = Math.max(1, Math.round(totalTracked / trackedJobIds.size));
    }
  }

  const { data: allJobs, error: jobsError } = await supabase
    .from("evaluation_jobs")
    .select("id, status, created_at")
    .in("status", ["complete", "failed"])
    .order("created_at", { ascending: true });

  if (jobsError) {
    errors.push(`Error fetching evaluation jobs: ${jobsError.message}`);
    return { backfilledCount: 0, estimatedTotalCents: 0, skippedCount: 0, errors };
  }

  const untrackedJobs = (allJobs ?? []).filter((job) => !trackedJobIds.has(job.id));
  if (untrackedJobs.length === 0) return { backfilledCount: 0, estimatedTotalCents: 0, skippedCount: 0, errors };

  let backfilledCount = 0;
  let estimatedTotalCents = 0;
  let skippedCount = 0;

  for (let i = 0; i < untrackedJobs.length; i += 50) {
    const batch = untrackedJobs.slice(i, i + 50);
    const rows = batch.map((job) => ({
      job_id: job.id,
      phase: "backfill_estimate",
      model: "gpt-5.1",
      input_tokens: 0,
      output_tokens: 0,
      cost_cents: avgCostCentsPerJob,
      called_at: job.created_at ?? new Date().toISOString(),
    }));

    const { error: insertError } = await supabase.from("job_costs").insert(rows);
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
