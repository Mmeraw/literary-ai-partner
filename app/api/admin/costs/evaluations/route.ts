/**
 * Per-Evaluation Cost Ledger API
 *
 * GET /api/admin/costs/evaluations?range=24h|5d|30d|all
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTrackedCostCents } from "@/lib/jobs/cost";
import {
  getConfiguredOverheadForRange,
  getCostRangeWindow,
  normalizeCostRange,
  type CostOpsProviderCostRow,
  type CostOpsRange,
} from "@/lib/admin/costops";

export interface EvalPhaseCostRow {
  phase: string;
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  lastCalledAt: string | null;
}

export interface EvalJobCostRow {
  jobId: string;
  manuscriptId: string | null;
  manuscriptTitle: string | null;
  status: string | null;
  llmCostCents: number;
  allocatedOverheadCents: number;
  totalCostCents: number;
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  firstCalledAt: string | null;
  lastCalledAt: string | null;
  phases: EvalPhaseCostRow[];
  warnings: string[];
}

export interface EvalCostLedgerPayload {
  range: CostOpsRange;
  rangeLabel: string;
  rangeStart: string | null;
  rangeEnd: string;
  jobs: EvalJobCostRow[];
  providerCosts: CostOpsProviderCostRow[];
  llmCostCents: number;
  allocatedOverheadCents: number;
  totalCostCents: number;
  totalCalls: number;
  runningJobCount: number;
  generatedAt: string;
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

interface RawJobMeta {
  id: string;
  manuscript_id: string | null;
  status: string | null;
  manuscripts: { title: string | null } | null;
}

function safeNum(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function rowCostCents(row: RawCostRow): number {
  return resolveTrackedCostCents({
    model: row.model,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    recordedCostCents: row.cost_cents,
  });
}

async function fetchAllCostRows(supabase: ReturnType<typeof createAdminClient>, start: string | null): Promise<RawCostRow[]> {
  const rows: RawCostRow[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    let query = supabase
      .from("job_costs")
      .select("job_id, phase, model, input_tokens, output_tokens, cost_cents, called_at")
      .range(from, from + pageSize - 1)
      .order("called_at", { ascending: false });

    if (start) query = query.gte("called_at", start);

    const { data, error } = await query;
    if (error) throw new Error(`job_costs fetch error: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...(data as RawCostRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function fetchJobMetadata(supabase: ReturnType<typeof createAdminClient>, jobIds: string[]): Promise<Map<string, RawJobMeta>> {
  const map = new Map<string, RawJobMeta>();
  if (jobIds.length === 0) return map;

  for (let i = 0; i < jobIds.length; i += 100) {
    const batch = jobIds.slice(i, i + 100);
    const { data, error } = await supabase
      .from("evaluation_jobs")
      .select("id, manuscript_id, status, manuscripts(title)")
      .in("id", batch);

    if (error) continue;
    for (const row of data ?? []) map.set(row.id, row as unknown as RawJobMeta);
  }

  return map;
}

function buildLedger(rows: RawCostRow[], jobMeta: Map<string, RawJobMeta>, allocatedOverheadCents: number): EvalJobCostRow[] {
  type PhaseKey = string;
  const jobMap = new Map<string, {
    phases: Map<PhaseKey, { calls: number; inTok: number; outTok: number; costCents: number; lastCalledAt: string | null }>;
    llmCostCents: number;
    totalCalls: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    firstCalledAt: string | null;
    lastCalledAt: string | null;
  }>();

  for (const row of rows) {
    const jobId = row.job_id;
    if (!jobId) continue;

    const costCents = rowCostCents(row);
    const inputTokens = safeNum(row.input_tokens);
    const outputTokens = safeNum(row.output_tokens);
    const phaseKey: PhaseKey = `${row.phase ?? "unknown"}||${row.model ?? "unknown"}`;

    const job = jobMap.get(jobId) ?? {
      phases: new Map(),
      llmCostCents: 0,
      totalCalls: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      firstCalledAt: null,
      lastCalledAt: null,
    };

    const phase = job.phases.get(phaseKey) ?? { calls: 0, inTok: 0, outTok: 0, costCents: 0, lastCalledAt: null };
    phase.calls += 1;
    phase.inTok += inputTokens;
    phase.outTok += outputTokens;
    phase.costCents += costCents;
    if (row.called_at && (!phase.lastCalledAt || row.called_at > phase.lastCalledAt)) phase.lastCalledAt = row.called_at;
    job.phases.set(phaseKey, phase);

    job.llmCostCents += costCents;
    job.totalCalls += 1;
    job.totalInputTokens += inputTokens;
    job.totalOutputTokens += outputTokens;

    if (row.called_at) {
      if (!job.firstCalledAt || row.called_at < job.firstCalledAt) job.firstCalledAt = row.called_at;
      if (!job.lastCalledAt || row.called_at > job.lastCalledAt) job.lastCalledAt = row.called_at;
    }

    jobMap.set(jobId, job);
  }

  const totalLlm = [...jobMap.values()].reduce((sum, job) => sum + job.llmCostCents, 0);
  const equalShare = jobMap.size > 0 ? allocatedOverheadCents / jobMap.size : 0;
  const jobs: EvalJobCostRow[] = [];

  for (const [jobId, agg] of jobMap.entries()) {
    const meta = jobMeta.get(jobId);
    const warnings: string[] = [];
    const phases: EvalPhaseCostRow[] = [];

    for (const [key, phaseAgg] of agg.phases.entries()) {
      const [phase, model] = key.split("||");
      if (model && model !== "unknown" && (model.includes("5.1") || model.includes("o1"))) {
        const cheapPhases = ["pass1", "pass2", "seed", "chunk", "ledger", "polish"];
        if (cheapPhases.some((cheapPhase) => phase.toLowerCase().includes(cheapPhase))) {
          warnings.push(`Expensive model "${model}" used in phase "${phase}" - verify cheap routing is active.`);
        }
      }
      phases.push({
        phase,
        model,
        calls: phaseAgg.calls,
        inputTokens: phaseAgg.inTok,
        outputTokens: phaseAgg.outTok,
        costCents: phaseAgg.costCents,
        lastCalledAt: phaseAgg.lastCalledAt,
      });
    }

    phases.sort((a, b) => b.costCents - a.costCents);

    const manuscripts = meta?.manuscripts;
    const manuscriptTitle = manuscripts && typeof manuscripts === "object" && !Array.isArray(manuscripts)
      ? manuscripts.title
      : Array.isArray(manuscripts) && manuscripts.length > 0
        ? (manuscripts[0] as { title: string | null }).title
        : null;

    const overhead = totalLlm > 0 ? allocatedOverheadCents * (agg.llmCostCents / totalLlm) : equalShare;

    jobs.push({
      jobId,
      manuscriptId: meta?.manuscript_id ?? null,
      manuscriptTitle: manuscriptTitle ?? null,
      status: meta?.status ?? null,
      llmCostCents: agg.llmCostCents,
      allocatedOverheadCents: overhead,
      totalCostCents: agg.llmCostCents + overhead,
      totalCalls: agg.totalCalls,
      totalInputTokens: agg.totalInputTokens,
      totalOutputTokens: agg.totalOutputTokens,
      firstCalledAt: agg.firstCalledAt,
      lastCalledAt: agg.lastCalledAt,
      phases,
      warnings,
    });
  }

  return jobs.sort((a, b) => {
    if (!a.lastCalledAt) return 1;
    if (!b.lastCalledAt) return -1;
    return a.lastCalledAt > b.lastCalledAt ? -1 : 1;
  });
}

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const supabase = createAdminClient();
  const warnings: string[] = [];
  const range = normalizeCostRange(request.nextUrl.searchParams.get("range"));
  const rangeWindow = getCostRangeWindow(range);
  const overhead = getConfiguredOverheadForRange(range, rangeWindow.days);

  let allRows: RawCostRow[] = [];
  try {
    allRows = await fetchAllCostRows(supabase, rangeWindow.start);
  } catch (err) {
    warnings.push(`Failed to fetch cost rows: ${err instanceof Error ? err.message : String(err)}`);
  }

  const uniqueJobIds = [...new Set(allRows.map((row) => row.job_id).filter(Boolean))];

  let jobMeta = new Map<string, RawJobMeta>();
  try {
    jobMeta = await fetchJobMetadata(supabase, uniqueJobIds);
  } catch (err) {
    warnings.push(`Failed to fetch job metadata: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (range === "all" && overhead.rows.some((row) => row.source === "configured_monthly")) {
    warnings.push("All-time ledger includes exact tracked LLM costs only; monthly overhead allocations apply to time-bounded ranges.");
  }

  if (overhead.missingProviders.length > 0) {
    warnings.push(`${overhead.missingProviders.join(", ")} costs are not included until their monthly cost env vars are configured.`);
  }

  const jobs = buildLedger(allRows, jobMeta, overhead.totalCents);
  const llmCostCents = jobs.reduce((sum, job) => sum + job.llmCostCents, 0);
  const totalCostCents = jobs.reduce((sum, job) => sum + job.totalCostCents, 0);
  const totalCalls = jobs.reduce((sum, job) => sum + job.totalCalls, 0);
  const runningJobCount = jobs.filter((job) => job.status === "running" || job.status === "queued").length;

  const payload: EvalCostLedgerPayload = {
    range,
    rangeLabel: rangeWindow.label,
    rangeStart: rangeWindow.start,
    rangeEnd: rangeWindow.end,
    jobs,
    providerCosts: [
      { provider: "OpenAI", usageCents: llmCostCents, fixedAllocatedCents: 0, totalCents: llmCostCents, source: "tracked", detail: "Exact tracked LLM token spend from job_costs." },
      ...overhead.rows,
    ],
    llmCostCents,
    allocatedOverheadCents: overhead.totalCents,
    totalCostCents,
    totalCalls,
    runningJobCount,
    generatedAt: new Date().toISOString(),
    warnings,
  };

  return NextResponse.json({ success: true, data: payload });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
