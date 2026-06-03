import { createAdminClient } from "@/lib/supabase/admin";

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
  last7dUsageCents: number;
  jobsWithCosts: number;
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

export interface CostOpsManualSubscription {
  id: string;
  vendor: string;
  category: string;
  label: string;
  amountCents: number;
  currency: string;
  billingDay: number | null;
  active: boolean;
  notes: string | null;
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
  manualSubscriptions: CostOpsManualSubscription[];
  providerStatus: CostOpsProviderStatus[];
  alerts: CostOpsAlert[];
  warnings: string[];
}

type CostRow = {
  job_id?: string | null;
  phase?: string | null;
  model?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  cost_cents?: number | null;
  called_at?: string | null;
  retry_attempt?: number | null;
};

type JobRow = {
  id?: string | null;
  manuscript_id?: string | null;
  status?: string | null;
  phase?: string | null;
  created_at?: string | null;
};

type ManualSubscriptionRow = {
  id?: string | null;
  vendor?: string | null;
  category?: string | null;
  label?: string | null;
  amount_cents?: number | null;
  currency?: string | null;
  billing_day?: number | null;
  active?: boolean | null;
  notes?: string | null;
};

function centsFromEnv(value: string | undefined): number | null {
  if (!value) return null;
  const normalized = value.trim().replace(/^\$/, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isoStartOfUtcDay(date: Date): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString();
}

function isoStartOfUtcMonth(date: Date): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString();
}

function daysInUtcMonth(date: Date): number {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

function isIsoOnOrAfter(value: string | null | undefined, floorIso: string): boolean {
  return typeof value === "string" && value >= floorIso;
}

function makeEmptyBreakdown(totalFixedAllocatedCents = 0): CostOpsMoneyBreakdown {
  return {
    usageCents: 0,
    fixedAllocatedCents: totalFixedAllocatedCents,
    totalCents: totalFixedAllocatedCents,
  };
}

function addToBreakdown(
  map: Map<string, { usageCents: number; callCount: number; inputTokens: number; outputTokens: number }>,
  key: string,
  row: CostRow
): void {
  const existing = map.get(key) ?? {
    usageCents: 0,
    callCount: 0,
    inputTokens: 0,
    outputTokens: 0,
  };

  existing.usageCents += Math.max(0, Math.round(numberOrZero(row.cost_cents)));
  existing.callCount += 1;
  existing.inputTokens += Math.max(0, Math.round(numberOrZero(row.input_tokens)));
  existing.outputTokens += Math.max(0, Math.round(numberOrZero(row.output_tokens)));
  map.set(key, existing);
}

function toBreakdownRows(
  map: Map<string, { usageCents: number; callCount: number; inputTokens: number; outputTokens: number }>
): CostOpsBreakdownRow[] {
  return [...map.entries()]
    .map(([key, value]) => ({
      key,
      usageCents: value.usageCents,
      callCount: value.callCount,
      inputTokens: value.inputTokens,
      outputTokens: value.outputTokens,
      avgCostPerCallCents:
        value.callCount > 0 ? Math.round(value.usageCents / value.callCount) : 0,
    }))
    .sort((a, b) => b.usageCents - a.usageCents);
}

function buildProviderStatus(): CostOpsProviderStatus[] {
  return [
    {
      provider: "OpenAI API",
      status: process.env.OPENAI_ADMIN_API_KEY ? "configured" : "missing_env",
      detail: process.env.OPENAI_ADMIN_API_KEY
        ? "Ready for official usage/cost reconciliation. MVP currently displays internal job telemetry."
        : "Set OPENAI_ADMIN_API_KEY to reconcile internal estimates against official organization cost data.",
    },
    {
      provider: "Vercel",
      status: process.env.VERCEL_API_TOKEN ? "configured" : "missing_env",
      detail: process.env.VERCEL_API_TOKEN
        ? "Token present. Add provider poller when billing endpoints are enabled for the team."
        : "Set VERCEL_API_TOKEN and VERCEL_TEAM_ID before automated Vercel spend import.",
    },
    {
      provider: "Supabase",
      status: process.env.SUPABASE_ACCESS_TOKEN ? "configured" : "missing_env",
      detail: process.env.SUPABASE_ACCESS_TOKEN
        ? "Token present. Use Management API metrics plus manual invoices for dollar-level reconciliation."
        : "Set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF before automated Supabase usage import.",
    },
    {
      provider: "ChatGPT / other subscriptions",
      status: "manual",
      detail: "Track fixed monthly costs in costops_manual_subscriptions until a reliable billing API is available.",
    },
  ];
}

function subscriptionToPublic(row: ManualSubscriptionRow): CostOpsManualSubscription {
  return {
    id: row.id ?? "unknown",
    vendor: row.vendor ?? "Unknown vendor",
    category: row.category ?? "subscription",
    label: row.label ?? "Manual subscription",
    amountCents: Math.max(0, Math.round(numberOrZero(row.amount_cents))),
    currency: (row.currency ?? "USD").toUpperCase(),
    billingDay: typeof row.billing_day === "number" ? row.billing_day : null,
    active: row.active !== false,
    notes: row.notes ?? null,
  };
}

export function formatUsdFromCents(cents: number | null | undefined): string {
  const value = (Math.max(0, Math.round(numberOrZero(cents))) / 100).toFixed(2);
  return `$${value}`;
}

export async function getCostOpsDashboardData(): Promise<CostOpsDashboardData> {
  const supabase = createAdminClient();
  const warnings: string[] = [];
  const now = new Date();
  const todayIso = isoStartOfUtcDay(now);
  const monthIso = isoStartOfUtcMonth(now);
  const last7dIso = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const dayOfMonth = now.getUTCDate();
  const daysThisMonth = daysInUtcMonth(now);
  const monthProgressRatio = daysThisMonth > 0 ? dayOfMonth / daysThisMonth : 1;

  const { data: rawCosts, error: costError } = await supabase
    .from("job_costs")
    .select("job_id, phase, model, input_tokens, output_tokens, cost_cents, called_at, retry_attempt")
    .order("called_at", { ascending: false })
    .limit(10000);

  if (costError) {
    warnings.push(`Could not read job_costs: ${costError.message}`);
  }

  const costs = (rawCosts ?? []) as CostRow[];
  const jobIds = [...new Set(costs.map((row) => row.job_id).filter(Boolean) as string[])];

  let jobMap = new Map<string, JobRow>();
  if (jobIds.length > 0) {
    const { data: rawJobs, error: jobsError } = await supabase
      .from("evaluation_jobs")
      .select("id, manuscript_id, status, phase, created_at")
      .in("id", jobIds.slice(0, 1000));

    if (jobsError) {
      warnings.push(`Could not read evaluation_jobs for CostOps join: ${jobsError.message}`);
    } else {
      jobMap = new Map(((rawJobs ?? []) as JobRow[]).map((job) => [job.id ?? "", job]));
    }
  }

  const { data: rawSubscriptions, error: subscriptionError } = await supabase
    .from("costops_manual_subscriptions")
    .select("id, vendor, category, label, amount_cents, currency, billing_day, active, notes")
    .eq("active", true)
    .order("vendor", { ascending: true });

  if (subscriptionError) {
    warnings.push(
      "Manual subscription table not available yet. Apply supabase/migrations/20260603_costops_dashboard.sql to track ChatGPT, Vercel, Supabase plans, domains, email, and other fixed costs."
    );
  }

  const manualSubscriptions = ((rawSubscriptions ?? []) as ManualSubscriptionRow[])
    .map(subscriptionToPublic)
    .filter((row) => row.currency === "USD" && row.active);

  const fixedMonthlyCents = manualSubscriptions.reduce((sum, row) => sum + row.amountCents, 0);
  const fixedAllocatedTodayCents = Math.round(fixedMonthlyCents / Math.max(1, daysThisMonth));
  const fixedAllocatedMtdCents = Math.round(fixedMonthlyCents * monthProgressRatio);

  const usageTodayCents = costs
    .filter((row) => isIsoOnOrAfter(row.called_at, todayIso))
    .reduce((sum, row) => sum + Math.max(0, Math.round(numberOrZero(row.cost_cents))), 0);

  const usageMtdCents = costs
    .filter((row) => isIsoOnOrAfter(row.called_at, monthIso))
    .reduce((sum, row) => sum + Math.max(0, Math.round(numberOrZero(row.cost_cents))), 0);

  const last7dUsageCents = costs
    .filter((row) => isIsoOnOrAfter(row.called_at, last7dIso))
    .reduce((sum, row) => sum + Math.max(0, Math.round(numberOrZero(row.cost_cents))), 0);

  const jobAgg = new Map<
    string,
    { usageCents: number; callCount: number; inputTokens: number; outputTokens: number; first: string | null; last: string | null }
  >();
  const modelMap = new Map<string, { usageCents: number; callCount: number; inputTokens: number; outputTokens: number }>();
  const phaseMap = new Map<string, { usageCents: number; callCount: number; inputTokens: number; outputTokens: number }>();

  let retriedUsageCents = 0;
  let failedJobUsageCents = 0;

  for (const row of costs) {
    const model = row.model?.trim() || "unknown_model";
    const phase = row.phase?.trim() || "unknown_phase";
    const costCents = Math.max(0, Math.round(numberOrZero(row.cost_cents)));

    addToBreakdown(modelMap, model, row);
    addToBreakdown(phaseMap, phase, row);

    if (numberOrZero(row.retry_attempt) > 0) {
      retriedUsageCents += costCents;
    }

    const jobId = row.job_id ?? "unknown_job";
    const existing = jobAgg.get(jobId) ?? {
      usageCents: 0,
      callCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      first: null,
      last: null,
    };

    existing.usageCents += costCents;
    existing.callCount += 1;
    existing.inputTokens += Math.max(0, Math.round(numberOrZero(row.input_tokens)));
    existing.outputTokens += Math.max(0, Math.round(numberOrZero(row.output_tokens)));

    if (row.called_at) {
      existing.first = existing.first && existing.first < row.called_at ? existing.first : row.called_at;
      existing.last = existing.last && existing.last > row.called_at ? existing.last : row.called_at;
    }

    jobAgg.set(jobId, existing);
  }

  const recentJobs = [...jobAgg.entries()]
    .map(([jobId, value]) => {
      const job = jobMap.get(jobId);
      return {
        jobId,
        manuscriptId: job?.manuscript_id ?? null,
        status: job?.status ?? null,
        phase: job?.phase ?? null,
        usageCents: value.usageCents,
        callCount: value.callCount,
        inputTokens: value.inputTokens,
        outputTokens: value.outputTokens,
        firstCalledAt: value.first,
        lastCalledAt: value.last,
      } satisfies CostOpsJobRow;
    })
    .sort((a, b) => b.usageCents - a.usageCents)
    .slice(0, 20);

  for (const job of recentJobs) {
    if (job.status === "failed") {
      failedJobUsageCents += job.usageCents;
    }
  }

  const modelBreakdown = toBreakdownRows(modelMap);
  const phaseBreakdown = toBreakdownRows(phaseMap);
  const jobsWithCosts = jobAgg.size;
  const callCount = costs.length;
  const variableProjectedCents =
    dayOfMonth > 0 ? Math.round((usageMtdCents / dayOfMonth) * daysThisMonth) : usageMtdCents;
  const projectedMonthEndCents = variableProjectedCents + fixedMonthlyCents;
  const monthlyBudgetCents = centsFromEnv(process.env.COSTOPS_MONTHLY_BUDGET_USD);
  const budgetRemainingCents =
    monthlyBudgetCents === null ? null : monthlyBudgetCents - projectedMonthEndCents;
  const budgetUsedPct =
    monthlyBudgetCents && monthlyBudgetCents > 0
      ? Math.round((projectedMonthEndCents / monthlyBudgetCents) * 1000) / 10
      : null;

  const alerts: CostOpsAlert[] = [];
  const dailyBudgetCents = centsFromEnv(process.env.COSTOPS_DAILY_BUDGET_USD);
  const todayTotalCents = usageTodayCents + fixedAllocatedTodayCents;

  if (dailyBudgetCents !== null && todayTotalCents > dailyBudgetCents) {
    alerts.push({
      code: "daily_budget_exceeded",
      severity: "danger",
      title: "Daily budget exceeded",
      detail: `${formatUsdFromCents(todayTotalCents)} spent/allocated today vs ${formatUsdFromCents(dailyBudgetCents)} budget.`,
    });
  }

  if (monthlyBudgetCents !== null && projectedMonthEndCents > monthlyBudgetCents) {
    alerts.push({
      code: "monthly_projection_over_budget",
      severity: "danger",
      title: "Projected month-end spend is over budget",
      detail: `${formatUsdFromCents(projectedMonthEndCents)} projected vs ${formatUsdFromCents(monthlyBudgetCents)} monthly budget.`,
    });
  }

  const expensiveJob = recentJobs[0] ?? null;
  const singleJobAlertCents = centsFromEnv(process.env.COSTOPS_SINGLE_JOB_ALERT_USD) ?? 500;
  if (expensiveJob && expensiveJob.usageCents > singleJobAlertCents) {
    alerts.push({
      code: "single_job_cost_spike",
      severity: "watch",
      title: "Single evaluation cost spike",
      detail: `Job ${expensiveJob.jobId} has ${formatUsdFromCents(expensiveJob.usageCents)} in estimated LLM usage cost.`,
    });
  }

  const topModel = modelBreakdown[0]?.key ?? null;
  const topPhase = phaseBreakdown[0]?.key ?? null;

  if (topModel && /gpt-5\.5/i.test(topModel)) {
    alerts.push({
      code: "flagship_model_cost_watch",
      severity: "watch",
      title: "GPT-5.5 usage detected",
      detail: "Confirm every GPT-5.5 call has an escalation reason and cannot be routed to a cheaper workhorse/infrastructure model.",
    });
  }

  if (retriedUsageCents > 0) {
    alerts.push({
      code: "retry_cost_waste_detected",
      severity: "watch",
      title: "Retry cost waste detected",
      detail: `${formatUsdFromCents(retriedUsageCents)} is associated with retried LLM calls where retry_attempt is recorded.`,
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      code: "costops_nominal",
      severity: "ok",
      title: "CostOps nominal",
      detail: "No budget, retry, or model-escalation alerts were detected from available telemetry.",
    });
  }

  const mostExpensiveJob = recentJobs[0] ?? null;

  return {
    summary: {
      currency: "USD",
      today: {
        usageCents: usageTodayCents,
        fixedAllocatedCents: fixedAllocatedTodayCents,
        totalCents: todayTotalCents,
      },
      monthToDate: costs.length
        ? {
            usageCents: usageMtdCents,
            fixedAllocatedCents: fixedAllocatedMtdCents,
            totalCents: usageMtdCents + fixedAllocatedMtdCents,
          }
        : makeEmptyBreakdown(fixedAllocatedMtdCents),
      projectedMonthEndCents,
      monthlyBudgetCents,
      budgetRemainingCents,
      budgetUsedPct,
      last7dUsageCents,
      jobsWithCosts,
      callCount,
      avgUsageCostPerJobCents:
        jobsWithCosts > 0 ? Math.round(costs.reduce((sum, row) => sum + Math.max(0, Math.round(numberOrZero(row.cost_cents))), 0) / jobsWithCosts) : 0,
      failedJobUsageCents,
      retriedUsageCents,
      topModel,
      topPhase,
      mostExpensiveJobId: mostExpensiveJob?.jobId ?? null,
      mostExpensiveJobCostCents: mostExpensiveJob?.usageCents ?? 0,
      generatedAt: now.toISOString(),
    },
    modelBreakdown,
    phaseBreakdown,
    recentJobs,
    manualSubscriptions,
    providerStatus: buildProviderStatus(),
    alerts,
    warnings,
  };
}
