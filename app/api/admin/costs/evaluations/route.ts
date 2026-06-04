/**
 * Per-Evaluation Cost Ledger API
 *
 * GET /api/admin/costs/evaluations
 *
 * Returns every evaluation job that has cost rows in `job_costs`, with a
 * full per-phase, per-model breakdown. Sorted most-recent first (by the
 * latest LLM call in the job). Running jobs are flagged so the UI can
 * auto-refresh them faster.
 *
 * Auth: Requires admin session via requireAdmin.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";

// ─── Types ──────────────────────────────────────────────────────────

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
  jobs: EvalJobCostRow[];
  totalCostCents: number;
  totalCalls: number;
  runningJobCount: number;
  generatedAt: string;
  warnings: string[];
}

// ─── Helpers ────────────────────────────────────────────────────────

function safeNum(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

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

async function fetchAllCostRows(supabase: ReturnType<typeof createAdminClient>): Promise<RawCostRow[]> {
  const rows: RawCostRow[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("job_costs")
      .select("job_id, phase, model, input_tokens, output_tokens, cost_cents, called_at")
      .range(from, from + pageSize - 1)
      .order("called_at", { ascending: false });

    if (error) throw new Error(`job_costs fetch error: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...(data as RawCostRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

interface RawJobMeta {
  id: string;
  manuscript_id: string | null;
  status: string | null;
  manuscripts: { title: string | null } | null;
}

async function fetchJobMetadata(
  supabase: ReturnType<typeof createAdminClient>,
  jobIds: string[],
): Promise<Map<string, RawJobMeta>> {
  const map = new Map<string, RawJobMeta>();
  if (jobIds.length === 0) return map;

  for (let i = 0; i < jobIds.length; i += 100) {
    const batch = jobIds.slice(i, i + 100);
    const { data, error } = await supabase
      .from("evaluation_jobs")
      .select("id, manuscript_id, status, manuscripts(title)")
      .in("id", batch);

    if (error) {
      console.error("[eval-cost-ledger] job metadata fetch error:", error.message);
      continue;
    }
    for (const row of data ?? []) {
      map.set(row.id, row as unknown as RawJobMeta);
    }
  }

  return map;
}

// ─── Aggregation ────────────────────────────────────────────────────

function buildLedger(
  rows: RawCostRow[],
  jobMeta: Map<string, RawJobMeta>,
): EvalJobCostRow[] {
  // Group raw rows by job_id → phase+model key
  type PhaseKey = string; // `${phase}||${model}`
  const jobMap = new Map<
    string,
    {
      phases: Map<PhaseKey, { calls: number; inTok: number; outTok: number; costCents: number; lastCalledAt: string | null }>;
      totalCostCents: number;
      totalCalls: number;
      totalInputTokens: number;
      totalOutputTokens: number;
      firstCalledAt: string | null;
      lastCalledAt: string | null;
    }
  >();

  for (const r of rows) {
    const jid = r.job_id;
    if (!jid) continue;

    const phaseKey: PhaseKey = `${r.phase ?? "unknown"}||${r.model ?? "unknown"}`;
    const costCents = safeNum(r.cost_cents);
    const inTok = safeNum(r.input_tokens);
    const outTok = safeNum(r.output_tokens);

    const job = jobMap.get(jid) ?? {
      phases: new Map(),
      totalCostCents: 0,
      totalCalls: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      firstCalledAt: null,
      lastCalledAt: null,
    };

    const phase = job.phases.get(phaseKey) ?? { calls: 0, inTok: 0, outTok: 0, costCents: 0, lastCalledAt: null };
    phase.calls += 1;
    phase.inTok += inTok;
    phase.outTok += outTok;
    phase.costCents += costCents;
    if (r.called_at && (!phase.lastCalledAt || r.called_at > phase.lastCalledAt)) {
      phase.lastCalledAt = r.called_at;
    }
    job.phases.set(phaseKey, phase);

    job.totalCostCents += costCents;
    job.totalCalls += 1;
    job.totalInputTokens += inTok;
    job.totalOutputTokens += outTok;

    if (r.called_at) {
      if (!job.firstCalledAt || r.called_at < job.firstCalledAt) job.firstCalledAt = r.called_at;
      if (!job.lastCalledAt || r.called_at > job.lastCalledAt) job.lastCalledAt = r.called_at;
    }

    jobMap.set(jid, job);
  }

  const result: EvalJobCostRow[] = [];

  for (const [jobId, agg] of jobMap.entries()) {
    const meta = jobMeta.get(jobId);
    const warnings: string[] = [];

    // Detect expensive model usage in phases
    const phaseRows: EvalPhaseCostRow[] = [];
    for (const [key, p] of agg.phases.entries()) {
      const [phase, model] = key.split("||");
      if (model && model !== "unknown" && (model.includes("5.1") || model.includes("o1"))) {
        // Flag if expensive model is used in a phase that typically runs cheap
        const cheapPhases = ["pass1", "pass2", "seed", "chunk", "ledger", "polish"];
        if (cheapPhases.some((cp) => phase.toLowerCase().includes(cp))) {
          warnings.push(`Expensive model "${model}" used in phase "${phase}" — verify cheap routing is active.`);
        }
      }
      phaseRows.push({
        phase,
        model,
        calls: p.calls,
        inputTokens: p.inTok,
        outputTokens: p.outTok,
        costCents: p.costCents,
        lastCalledAt: p.lastCalledAt,
      });
    }

    // Sort phases by cost descending
    phaseRows.sort((a, b) => b.costCents - a.costCents);

    const manuscripts = meta?.manuscripts;
    const manuscriptTitle =
      manuscripts && typeof manuscripts === "object" && !Array.isArray(manuscripts)
        ? (manuscripts as { title: string | null }).title
        : Array.isArray(manuscripts) && manuscripts.length > 0
          ? (manuscripts[0] as { title: string | null }).title
          : null;

    result.push({
      jobId,
      manuscriptId: meta?.manuscript_id ?? null,
      manuscriptTitle: manuscriptTitle ?? null,
      status: meta?.status ?? null,
      totalCostCents: agg.totalCostCents,
      totalCalls: agg.totalCalls,
      totalInputTokens: agg.totalInputTokens,
      totalOutputTokens: agg.totalOutputTokens,
      firstCalledAt: agg.firstCalledAt,
      lastCalledAt: agg.lastCalledAt,
      phases: phaseRows,
      warnings,
    });
  }

  // Sort by lastCalledAt descending (most recent activity first)
  result.sort((a, b) => {
    if (!a.lastCalledAt) return 1;
    if (!b.lastCalledAt) return -1;
    return a.lastCalledAt > b.lastCalledAt ? -1 : 1;
  });

  return result;
}

// ─── Route handler ──────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const supabase = createAdminClient();
  const warnings: string[] = [];

  let allRows: RawCostRow[] = [];
  try {
    allRows = await fetchAllCostRows(supabase);
  } catch (err) {
    warnings.push(`Failed to fetch cost rows: ${err instanceof Error ? err.message : String(err)}`);
  }

  const uniqueJobIds = [...new Set(allRows.map((r) => r.job_id).filter(Boolean))];

  let jobMeta: Map<string, RawJobMeta> = new Map();
  try {
    jobMeta = await fetchJobMetadata(supabase, uniqueJobIds);
  } catch (err) {
    warnings.push(`Failed to fetch job metadata: ${err instanceof Error ? err.message : String(err)}`);
  }

  const jobs = buildLedger(allRows, jobMeta);
  const totalCostCents = jobs.reduce((s, j) => s + j.totalCostCents, 0);
  const totalCalls = jobs.reduce((s, j) => s + j.totalCalls, 0);
  const runningJobCount = jobs.filter((j) => j.status === "running" || j.status === "queued").length;

  const payload: EvalCostLedgerPayload = {
    jobs,
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
