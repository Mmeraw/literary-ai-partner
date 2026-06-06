import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTrackedCostCents } from "@/lib/jobs/cost";
import { matchesNormalizedPhaseAlias } from "@/lib/admin/phaseAliasMatch";
import {
  getConfiguredOverheadForRange,
  getCostRangeWindow,
  normalizeCostRange,
  type CostOpsProviderCostRow,
  type CostOpsRange,
} from "@/lib/admin/costops";
import {
  fetchDocumentCostRollup,
  fetchRevenueByJob,
  fetchRevenueRollup,
  grossMarginPct,
  grossProfitCents,
  type DocumentCostRollup,
  type JobRevenueRollup,
  type RevenueRollup,
} from "@/lib/admin/revenue";

export interface EvalPhaseCostRow {
  phase: string;
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  lastCalledAt: string | null;
}

export interface EvalPhaseCoverageRow {
  key: string;
  label: string;
  description: string;
  status: "tracked" | "missing_or_not_run" | "not_applicable";
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  models: string[];
  phases: string[];
  note: string;
}

export interface EvalJobCostRow {
  jobId: string;
  manuscriptId: string | null;
  manuscriptTitle: string | null;
  status: string | null;
  llmCostCents: number;
  allocatedOverheadCents: number;
  documentGenerationCents: number;
  totalCostCents: number;
  grossRevenueCents: number;
  stripeFeeCents: number;
  refundCents: number;
  netRevenueCents: number;
  grossProfitCents: number;
  grossMarginPct: number | null;
  hasLinkedRevenue: boolean;
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  firstCalledAt: string | null;
  lastCalledAt: string | null;
  phases: EvalPhaseCostRow[];
  phaseCoverage: EvalPhaseCoverageRow[];
  missingPhaseCount: number;
  warnings: string[];
}

export interface EvalCostLedgerPayload {
  range: CostOpsRange;
  rangeLabel: string;
  rangeStart: string | null;
  rangeEnd: string;
  jobs: EvalJobCostRow[];
  providerCosts: CostOpsProviderCostRow[];
  revenue: RevenueRollup;
  documentCosts: DocumentCostRollup;
  llmCostCents: number;
  allocatedOverheadCents: number;
  documentGenerationCents: number;
  totalCostCents: number;
  grossRevenueCents: number;
  stripeFeeCents: number;
  refundCents: number;
  netRevenueCents: number;
  grossProfitCents: number;
  grossMarginPct: number | null;
  avgCostPerEvaluationCents: number;
  avgRevenuePerEvaluationCents: number;
  highestCostCents: number;
  lowestCostCents: number;
  totalCalls: number;
  runningJobCount: number;
  missingPhaseCount: number;
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

type PhaseCoverageDefinition = {
  key: string;
  label: string;
  description: string;
  aliases: string[];
  noteWhenMissing: string;
  notApplicable?: boolean;
};

const PHASE_COVERAGE_DEFINITIONS: PhaseCoverageDefinition[] = [
  { key: "phase0_intake", label: "Phase 0 / Intake", description: "Canonical job intake, file checks, and routing before model work begins.", aliases: ["phase0", "phase_0", "pass0", "intake"], noteWhenMissing: "No LLM spend is expected for deterministic intake unless a future Phase 0 model call is added.", notApplicable: true },
  { key: "seed_05a_story_ledger", label: "Seed 0.5a / Story Ledger", description: "Full-context or semantic story-ledger seed used as downstream ground truth.", aliases: ["phase05_semantic_seed", "phase05a", "phase_0.5a", "phase0.5a", "0.5a", "full_context_ledger", "story_ledger"], noteWhenMissing: "No 0.5a ledger cost row was found. If this job should have full-context ledger enabled, verify the seed ran and called trackCompletionCost." },
  { key: "seed_05b_dream", label: "Seed 0.5b / DREAM Seed", description: "Full-context editorial DREAM seed/calibration pass.", aliases: ["phase05b", "phase_0.5b", "phase0.5b", "0.5b", "editorial_dream_seed", "dream_seed"], noteWhenMissing: "No 0.5b DREAM seed cost row was found. It may be disabled, not applicable, or missing telemetry." },
  { key: "phase1a_character_sweep", label: "Phase 1A / Character Sweep", description: "Chunked character and evidence sweep.", aliases: ["pass1a", "phase1a", "phase_1a", "character_sweep"], noteWhenMissing: "No Phase 1A cost rows were found. For chunked evaluations, this is a pipeline or telemetry concern." },
  { key: "phase3a_independent_read", label: "Phase 3A / Independent Read", description: "Independent full-manuscript preflight reader and reducer.", aliases: ["pass3a", "phase3a", "phase_3a", "preflight"], noteWhenMissing: "No Phase 3A preflight cost rows were found. If the job was long/full-context, inspect whether Pass 3A ran or only its telemetry is missing." },
  { key: "pass3_read_ahead", label: "Pass 3 Read-Ahead", description: "LLM-heavy whole-manuscript pre-analysis that feeds synthesis.", aliases: ["pass3_read_ahead", "read_ahead", "read-ahead"], noteWhenMissing: "No Pass 3 read-ahead cost row was found. If read-ahead is expected for this evaluation tier, this is either not running or not tracked." },
  { key: "phase3b_dream_document", label: "Phase 3B / DREAM Document", description: "Long-form DREAM synthesis, criterion batches, and synthesis pass.", aliases: ["pass3b", "phase3b", "phase_3b", "dream_document", "longform"], noteWhenMissing: "No Phase 3B/DREAM cost rows were found. This is expected for short evaluations, but not for long-form multi-layer jobs." },
  { key: "wave_revision", label: "WAVE Revision", description: "Post-evaluation WAVE readiness layer and WAVE module execution.", aliases: ["wave_revision", "wave", "execute_wave", "wave_modules", "wave_readiness", "wave_layer"], noteWhenMissing: "No WAVE cost row was found. If WAVE ran deterministically, tracked LLM spend may be $0; if model-backed WAVE calls are expected, verify telemetry." },
  { key: "phase5_revision_queue", label: "Phase 5 / Revision Queue", description: "Post-evaluation revision handoff, Phase 5 planning, and Revise Queue preparation.", aliases: ["phase5", "phase_5", "pass5", "revision_queue", "revise_queue", "revise", "trustedpath", "trusted_path"], noteWhenMissing: "No Phase 5/Revision Queue cost row was found. If Phase 5 should perform model work, this is either not running or not tracked." },
];

function safeNum(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function rowCostCents(row: RawCostRow): number {
  return resolveTrackedCostCents({ model: row.model, inputTokens: row.input_tokens, outputTokens: row.output_tokens, recordedCostCents: row.cost_cents });
}

function readUsdEnvCents(name: string): number | null {
  const raw = process.env[name];
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n * 100 : null;
}

function getDocumentGenerationPerJobCents(): number {
  const pdfPerDoc = readUsdEnvCents("COSTOPS_PDF_GENERATION_PER_DOC_USD") ?? 0;
  const wordPerDoc = readUsdEnvCents("COSTOPS_WORD_GENERATION_PER_DOC_USD") ?? 0;
  return pdfPerDoc + wordPerDoc;
}

async function fetchAllCostRows(supabase: ReturnType<typeof createAdminClient>, start: string | null): Promise<RawCostRow[]> {
  const rows: RawCostRow[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    let query = supabase.from("job_costs").select("job_id, phase, model, input_tokens, output_tokens, cost_cents, called_at").range(from, from + pageSize - 1).order("called_at", { ascending: false });
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
    const { data, error } = await supabase.from("evaluation_jobs").select("id, manuscript_id, status, manuscripts(title)").in("id", jobIds.slice(i, i + 100));
    if (error) continue;
    for (const row of data ?? []) map.set(row.id, row as unknown as RawJobMeta);
  }
  return map;
}

function phaseMatchesDefinition(phase: string, definition: PhaseCoverageDefinition): boolean {
  return definition.aliases.some((alias) => matchesNormalizedPhaseAlias(phase, alias));
}

function buildPhaseCoverage(phases: EvalPhaseCostRow[]): EvalPhaseCoverageRow[] {
  return PHASE_COVERAGE_DEFINITIONS.map((definition) => {
    const matches = phases.filter((phase) => phaseMatchesDefinition(phase.phase, definition));
    const calls = matches.reduce((sum, phase) => sum + phase.calls, 0);
    const inputTokens = matches.reduce((sum, phase) => sum + phase.inputTokens, 0);
    const outputTokens = matches.reduce((sum, phase) => sum + phase.outputTokens, 0);
    const costCents = matches.reduce((sum, phase) => sum + phase.costCents, 0);
    if (matches.length > 0) return { key: definition.key, label: definition.label, description: definition.description, status: "tracked", calls, inputTokens, outputTokens, costCents, models: [...new Set(matches.map((phase) => phase.model).filter(Boolean))], phases: [...new Set(matches.map((phase) => phase.phase))], note: "Tracked in job_costs." };
    return { key: definition.key, label: definition.label, description: definition.description, status: definition.notApplicable ? "not_applicable" : "missing_or_not_run", calls: 0, inputTokens: 0, outputTokens: 0, costCents: 0, models: [], phases: [], note: definition.noteWhenMissing };
  });
}

function emptyRevenue(): JobRevenueRollup {
  return { jobId: "", grossRevenueCents: 0, stripeFeeCents: 0, refundCents: 0, netRevenueCents: 0, eventCount: 0 };
}

function buildLedger(rows: RawCostRow[], jobMeta: Map<string, RawJobMeta>, allocatedOverheadCents: number, revenueByJob: Map<string, JobRevenueRollup>, documentByJob: Map<string, number>): EvalJobCostRow[] {
  type PhaseKey = string;
  const jobMap = new Map<string, { phases: Map<PhaseKey, { calls: number; inTok: number; outTok: number; costCents: number; lastCalledAt: string | null }>; llmCostCents: number; totalCalls: number; totalInputTokens: number; totalOutputTokens: number; firstCalledAt: string | null; lastCalledAt: string | null }>();
  for (const row of rows) {
    const jobId = row.job_id;
    if (!jobId) continue;
    const costCents = rowCostCents(row);
    const phaseKey = `${row.phase ?? "unknown"}||${row.model ?? "unknown"}`;
    const job = jobMap.get(jobId) ?? { phases: new Map(), llmCostCents: 0, totalCalls: 0, totalInputTokens: 0, totalOutputTokens: 0, firstCalledAt: null, lastCalledAt: null };
    const phase = job.phases.get(phaseKey) ?? { calls: 0, inTok: 0, outTok: 0, costCents: 0, lastCalledAt: null };
    phase.calls += 1; phase.inTok += safeNum(row.input_tokens); phase.outTok += safeNum(row.output_tokens); phase.costCents += costCents;
    if (row.called_at && (!phase.lastCalledAt || row.called_at > phase.lastCalledAt)) phase.lastCalledAt = row.called_at;
    job.phases.set(phaseKey, phase);
    job.llmCostCents += costCents; job.totalCalls += 1; job.totalInputTokens += safeNum(row.input_tokens); job.totalOutputTokens += safeNum(row.output_tokens);
    if (row.called_at) { if (!job.firstCalledAt || row.called_at < job.firstCalledAt) job.firstCalledAt = row.called_at; if (!job.lastCalledAt || row.called_at > job.lastCalledAt) job.lastCalledAt = row.called_at; }
    jobMap.set(jobId, job);
  }
  const totalLlm = [...jobMap.values()].reduce((sum, job) => sum + job.llmCostCents, 0);
  const equalShare = jobMap.size > 0 ? allocatedOverheadCents / jobMap.size : 0;
  const jobs: EvalJobCostRow[] = [];
  for (const [jobId, agg] of jobMap.entries()) {
    const phases = [...agg.phases.entries()].map(([key, phaseAgg]) => { const [phase, model] = key.split("||"); return { phase, model, calls: phaseAgg.calls, inputTokens: phaseAgg.inTok, outputTokens: phaseAgg.outTok, costCents: phaseAgg.costCents, lastCalledAt: phaseAgg.lastCalledAt }; }).sort((a, b) => b.costCents - a.costCents);
    const phaseCoverage = buildPhaseCoverage(phases);
    const missingPhaseCount = phaseCoverage.filter((row) => row.status === "missing_or_not_run").length;
    const meta = jobMeta.get(jobId);
    const manuscripts = meta?.manuscripts;
    const manuscriptTitle = manuscripts && typeof manuscripts === "object" && !Array.isArray(manuscripts) ? manuscripts.title : Array.isArray(manuscripts) && manuscripts.length > 0 ? (manuscripts[0] as { title: string | null }).title : null;
    const overhead = totalLlm > 0 ? allocatedOverheadCents * (agg.llmCostCents / totalLlm) : equalShare;
    const linkedRevenue = revenueByJob.get(jobId) ?? { ...emptyRevenue(), jobId };
    const documentGenerationCents = documentByJob.get(jobId) ?? 0;
    const totalCostCents = agg.llmCostCents + overhead + documentGenerationCents;
    const profit = grossProfitCents(linkedRevenue.netRevenueCents, totalCostCents);
    const warnings: string[] = [];
    if (missingPhaseCount > 0) warnings.push(`${missingPhaseCount} expected phase group(s) have no tracked cost rows for this job. They may be not applicable, skipped, or missing telemetry.`);
    if (linkedRevenue.eventCount === 0) warnings.push("No linked revenue event for this job yet.");
    jobs.push({ jobId, manuscriptId: meta?.manuscript_id ?? null, manuscriptTitle: manuscriptTitle ?? null, status: meta?.status ?? null, llmCostCents: agg.llmCostCents, allocatedOverheadCents: overhead, documentGenerationCents, totalCostCents, grossRevenueCents: linkedRevenue.grossRevenueCents, stripeFeeCents: linkedRevenue.stripeFeeCents, refundCents: linkedRevenue.refundCents, netRevenueCents: linkedRevenue.netRevenueCents, grossProfitCents: profit, grossMarginPct: grossMarginPct(linkedRevenue.netRevenueCents, profit), hasLinkedRevenue: linkedRevenue.eventCount > 0, totalCalls: agg.totalCalls, totalInputTokens: agg.totalInputTokens, totalOutputTokens: agg.totalOutputTokens, firstCalledAt: agg.firstCalledAt, lastCalledAt: agg.lastCalledAt, phases, phaseCoverage, missingPhaseCount, warnings });
  }
  return jobs.sort((a, b) => (b.lastCalledAt ?? "").localeCompare(a.lastCalledAt ?? ""));
}

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const supabase = createAdminClient();
  const warnings: string[] = [];
  const range = normalizeCostRange(request.nextUrl.searchParams.get("range"));
  const rangeWindow = getCostRangeWindow(range);
  const overhead = getConfiguredOverheadForRange(range, rangeWindow.days);
  const [revenue, documentCosts, revenueByJob] = await Promise.all([fetchRevenueRollup(range), fetchDocumentCostRollup(range), fetchRevenueByJob(range)]);
  const documentByJob = new Map<string, number>();

  let allRows: RawCostRow[] = [];
  try { allRows = await fetchAllCostRows(supabase, rangeWindow.start); } catch (err) { warnings.push(`Failed to fetch cost rows: ${err instanceof Error ? err.message : String(err)}`); }
  const uniqueJobIds = [...new Set(allRows.map((row) => row.job_id).filter(Boolean))];
  let jobMeta = new Map<string, RawJobMeta>();
  try { jobMeta = await fetchJobMetadata(supabase, uniqueJobIds); } catch (err) { warnings.push(`Failed to fetch job metadata: ${err instanceof Error ? err.message : String(err)}`); }
  if (range === "all" && overhead.rows.some((row) => row.source === "configured_monthly")) warnings.push("All-time ledger includes exact tracked LLM costs only; monthly overhead allocations apply to time-bounded ranges.");
  if (overhead.missingProviders.length > 0) warnings.push(`${overhead.missingProviders.join(", ")} costs are not included until their monthly cost env vars are configured.`);
  if (documentCosts.missing) warnings.push(documentCosts.detail);

  const jobs = buildLedger(allRows, jobMeta, overhead.totalCents, revenueByJob, documentByJob);
  const llmCostCents = jobs.reduce((sum, job) => sum + job.llmCostCents, 0);
  const totalCalls = jobs.reduce((sum, job) => sum + job.totalCalls, 0);
  const runningJobCount = jobs.filter((job) => job.status === "running" || job.status === "queued").length;
  const missingPhaseCount = jobs.reduce((sum, job) => sum + job.missingPhaseCount, 0);
  const totalCostCents = jobs.reduce((sum, job) => sum + job.totalCostCents, 0) + documentCosts.documentGenerationCents;
  const profit = grossProfitCents(revenue.netRevenueCents, totalCostCents);
  const costs = jobs.map((job) => job.totalCostCents).filter((cost) => cost > 0);
  if (missingPhaseCount > 0) warnings.push(`${missingPhaseCount} expected evaluation phase group(s) across this range have no tracked rows. Use the Phase Coverage table to distinguish tracked spend from missing/not-run work.`);

  const payload: EvalCostLedgerPayload = { range, rangeLabel: rangeWindow.label, rangeStart: rangeWindow.start, rangeEnd: rangeWindow.end, jobs, providerCosts: [{ provider: "OpenAI / LLM", usageCents: llmCostCents, fixedAllocatedCents: 0, totalCents: llmCostCents, source: "tracked", detail: "Exact tracked LLM token spend from job_costs." }, { provider: "PDF / Word generation", usageCents: documentCosts.documentGenerationCents, fixedAllocatedCents: 0, totalCents: documentCosts.documentGenerationCents, source: documentCosts.missing ? "manual_required" : documentCosts.estimated ? "configured_monthly" : "tracked", detail: documentCosts.detail }, ...overhead.rows], revenue, documentCosts, llmCostCents, allocatedOverheadCents: overhead.totalCents, documentGenerationCents: documentCosts.documentGenerationCents, totalCostCents, grossRevenueCents: revenue.grossRevenueCents, stripeFeeCents: revenue.stripeFeeCents, refundCents: revenue.refundCents, netRevenueCents: revenue.netRevenueCents, grossProfitCents: profit, grossMarginPct: grossMarginPct(revenue.netRevenueCents, profit), avgCostPerEvaluationCents: jobs.length > 0 ? totalCostCents / jobs.length : 0, avgRevenuePerEvaluationCents: jobs.length > 0 ? revenue.netRevenueCents / jobs.length : 0, highestCostCents: costs.length > 0 ? Math.max(...costs) : 0, lowestCostCents: costs.length > 0 ? Math.min(...costs) : 0, totalCalls, runningJobCount, missingPhaseCount, generatedAt: new Date().toISOString(), warnings };
  return NextResponse.json({ success: true, data: payload });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" } });
}
