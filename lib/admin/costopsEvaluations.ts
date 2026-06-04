/**
 * CostOps Per-Evaluation Data Layer
 *
 * Builds a job-level and phase-level ledger from `job_costs` so admins can
 * inspect exactly which models and phases are accruing cost for each
 * evaluation job.
 *
 * Monetary values are stored and returned as integer USD cents.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTrackedCostCents } from "@/lib/jobs/cost";

export interface CostOpsEvaluationSummary {
  currency: "USD";
  generatedAt: string;
  jobFilter: string | null;
  costRowCount: number;
  jobCount: number;
  activeJobCount: number;
  totalCostCents: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCallCount: number;
  mostExpensiveJobId: string | null;
  mostExpensiveJobCostCents: number;
}

export interface CostOpsEvaluationPhaseRow {
  jobId: string;
  phase: string;
  model: string;
  usageCents: number;
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  avgCostPerCallCents: number;
  firstCalledAt: string | null;
  lastCalledAt: string | null;
}

export interface CostOpsEvaluationJobRow {
  jobId: string;
  manuscriptId: string | null;
  status: string | null;
  validityStatus: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  usageCents: number;
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  firstCalledAt: string | null;
  lastCalledAt: string | null;
  models: string[];
  phases: string[];
  phaseRows: CostOpsEvaluationPhaseRow[];
}

export interface CostOpsEvaluationDashboardData {
  summary: CostOpsEvaluationSummary;
  jobs: CostOpsEvaluationJobRow[];
  selectedJob: CostOpsEvaluationJobRow | null;
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
  validity_status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface MutablePhaseAccumulator {
  jobId: string;
  phase: string;
  model: string;
  usageCents: number;
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  firstCalledAt: string | null;
  lastCalledAt: string | null;
}

interface MutableJobAccumulator {
  jobId: string;
  manuscriptId: string | null;
  status: string | null;
  validityStatus: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  usageCents: number;
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  firstCalledAt: string | null;
  lastCalledAt: string | null;
  models: Set<string>;
  phases: Set<string>;
  phaseMap: Map<string, MutablePhaseAccumulator>;
}

function safeNum(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeLimit(value: string | null | undefined): number {
  const parsed = Number(value ?? "");
  if (!Number.isFinite(parsed) || parsed <= 0) return 2000;
  return Math.min(Math.floor(parsed), 5000);
}

function isActiveStatus(status: string | null): boolean {
  if (!status) return false;
  return ["queued", "running", "processing", "review_gate", "awaiting_approval"].includes(status);
}

function updateTimeRange(entry: { firstCalledAt: string | null; lastCalledAt: string | null }, calledAt: string | null): void {
  if (!calledAt) return;
  if (!entry.firstCalledAt || calledAt < entry.firstCalledAt) entry.firstCalledAt = calledAt;
  if (!entry.lastCalledAt || calledAt > entry.lastCalledAt) entry.lastCalledAt = calledAt;
}

async function fetchCostRows(jobId: string | null, limit: number): Promise<RawCostRow[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("job_costs")
    .select("job_id, phase, model, input_tokens, output_tokens, cost_cents, called_at")
    .order("called_at", { ascending: false })
    .limit(limit);

  if (jobId) {
    query = query.eq("job_id", jobId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as RawCostRow[];
}

async function fetchJobMetadata(jobIds: string[]): Promise<Map<string, RawJobRow>> {
  const map = new Map<string, RawJobRow>();
  if (jobIds.length === 0) return map;

  const supabase = createAdminClient();
  for (let i = 0; i < jobIds.length; i += 100) {
    const batch = jobIds.slice(i, i + 100);
    const { data, error } = await supabase
      .from("evaluation_jobs")
      .select("id, manuscript_id, status, validity_status, created_at, updated_at")
      .in("id", batch);

    if (error) throw error;
    for (const row of data ?? []) {
      const typed = row as RawJobRow;
      map.set(typed.id, typed);
    }
  }

  return map;
}

function buildJobRows(costRows: RawCostRow[], jobMeta: Map<string, RawJobRow>): CostOpsEvaluationJobRow[] {
  const jobMap = new Map<string, MutableJobAccumulator>();

  for (const row of costRows) {
    const jobId = row.job_id;
    if (!jobId) continue;

    const meta = jobMeta.get(jobId);
    const jobEntry = jobMap.get(jobId) ?? {
      jobId,
      manuscriptId: meta?.manuscript_id ?? null,
      status: meta?.status ?? null,
      validityStatus: meta?.validity_status ?? null,
      createdAt: meta?.created_at ?? null,
      updatedAt: meta?.updated_at ?? null,
      usageCents: 0,
      callCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      firstCalledAt: null,
      lastCalledAt: null,
      models: new Set<string>(),
      phases: new Set<string>(),
      phaseMap: new Map<string, MutablePhaseAccumulator>(),
    };

    const phase = row.phase ?? "unknown_phase";
    const model = row.model ?? "unknown_model";
    const cost = resolveTrackedCostCents({
      model: row.model,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      recordedCostCents: row.cost_cents,
    });
    const inputTokens = safeNum(row.input_tokens);
    const outputTokens = safeNum(row.output_tokens);

    jobEntry.usageCents += cost;
    jobEntry.callCount += 1;
    jobEntry.inputTokens += inputTokens;
    jobEntry.outputTokens += outputTokens;
    jobEntry.models.add(model);
    jobEntry.phases.add(phase);
    updateTimeRange(jobEntry, row.called_at);

    const phaseKey = `${phase}\u0000${model}`;
    const phaseEntry = jobEntry.phaseMap.get(phaseKey) ?? {
      jobId,
      phase,
      model,
      usageCents: 0,
      callCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      firstCalledAt: null,
      lastCalledAt: null,
    };

    phaseEntry.usageCents += cost;
    phaseEntry.callCount += 1;
    phaseEntry.inputTokens += inputTokens;
    phaseEntry.outputTokens += outputTokens;
    updateTimeRange(phaseEntry, row.called_at);
    jobEntry.phaseMap.set(phaseKey, phaseEntry);
    jobMap.set(jobId, jobEntry);
  }

  return [...jobMap.values()]
    .map((job) => {
      const phaseRows = [...job.phaseMap.values()]
        .map((phase) => ({
          jobId: phase.jobId,
          phase: phase.phase,
          model: phase.model,
          usageCents: phase.usageCents,
          callCount: phase.callCount,
          inputTokens: phase.inputTokens,
          outputTokens: phase.outputTokens,
          avgCostPerCallCents: phase.callCount > 0 ? phase.usageCents / phase.callCount : 0,
          firstCalledAt: phase.firstCalledAt,
          lastCalledAt: phase.lastCalledAt,
        }))
        .sort((a, b) => (a.lastCalledAt ?? "").localeCompare(b.lastCalledAt ?? "") * -1);

      return {
        jobId: job.jobId,
        manuscriptId: job.manuscriptId,
        status: job.status,
        validityStatus: job.validityStatus,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        usageCents: job.usageCents,
        callCount: job.callCount,
        inputTokens: job.inputTokens,
        outputTokens: job.outputTokens,
        firstCalledAt: job.firstCalledAt,
        lastCalledAt: job.lastCalledAt,
        models: [...job.models].sort(),
        phases: [...job.phases].sort(),
        phaseRows,
      };
    })
    .sort((a, b) => {
      const byLastCall = (b.lastCalledAt ?? "").localeCompare(a.lastCalledAt ?? "");
      if (byLastCall !== 0) return byLastCall;
      return b.usageCents - a.usageCents;
    });
}

export async function getCostOpsEvaluationsData(params: {
  jobId?: string | null;
  limit?: string | null;
} = {}): Promise<CostOpsEvaluationDashboardData> {
  const warnings: string[] = [];
  const jobFilter = normalizeText(params.jobId);
  const limit = normalizeLimit(params.limit);

  let costRows: RawCostRow[] = [];
  try {
    costRows = await fetchCostRows(jobFilter, limit);
  } catch (error) {
    warnings.push(`Failed to fetch job_costs rows: ${error instanceof Error ? error.message : "Unknown error"}`);
  }

  const jobIds = [...new Set(costRows.map((row) => row.job_id).filter(Boolean))];
  let jobMeta = new Map<string, RawJobRow>();
  try {
    jobMeta = await fetchJobMetadata(jobIds);
  } catch (error) {
    warnings.push(`Failed to fetch evaluation job metadata: ${error instanceof Error ? error.message : "Unknown error"}`);
  }

  const jobs = buildJobRows(costRows, jobMeta);
  const selectedJob = jobFilter
    ? jobs.find((job) => job.jobId === jobFilter) ?? null
    : jobs[0] ?? null;

  if (jobFilter && !selectedJob) {
    warnings.push(`No cost rows found for job ${jobFilter}. The job may not have reached a tracked LLM phase yet, or telemetry may not be wired for its path.`);
  }

  const totalCostCents = jobs.reduce((sum, job) => sum + job.usageCents, 0);
  const totalInputTokens = jobs.reduce((sum, job) => sum + job.inputTokens, 0);
  const totalOutputTokens = jobs.reduce((sum, job) => sum + job.outputTokens, 0);
  const totalCallCount = jobs.reduce((sum, job) => sum + job.callCount, 0);
  const mostExpensiveJob = [...jobs].sort((a, b) => b.usageCents - a.usageCents)[0] ?? null;

  return {
    summary: {
      currency: "USD",
      generatedAt: new Date().toISOString(),
      jobFilter,
      costRowCount: costRows.length,
      jobCount: jobs.length,
      activeJobCount: jobs.filter((job) => isActiveStatus(job.status)).length,
      totalCostCents,
      totalInputTokens,
      totalOutputTokens,
      totalCallCount,
      mostExpensiveJobId: mostExpensiveJob?.jobId ?? null,
      mostExpensiveJobCostCents: mostExpensiveJob?.usageCents ?? 0,
    },
    jobs,
    selectedJob,
    warnings,
  };
}
