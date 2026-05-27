/**
 * Revise Repair Cross-Check — Perplexity Verification Layer
 *
 * Verifies Option A repair proposals against the original text and diagnosis
 * using an independent Perplexity model call. Does NOT generate repairs.
 *
 * Feature-flagged via REVISION_REPAIR_CROSSCHECK_ENABLED.
 * Designed for durable/idempotent background execution, not synchronous
 * workbench load. Results are cached in the revision_repair_cross_checks
 * sidecar table, keyed by content hashes for invalidation.
 *
 * TrustedPath contract: only `approve` verdicts may be auto-applied.
 * All other verdicts require manual author review.
 */

import { createHash } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase";

// ─── Constants ──────────────────────────────────────────────────────────────

const PERPLEXITY_BASE_URL = "https://api.perplexity.ai";
const PERPLEXITY_MODEL = "sonar-reasoning-pro";
const PERPLEXITY_TEMPERATURE = 0.1;
const PERPLEXITY_MAX_TOKENS = 4000;
const PERPLEXITY_TIMEOUT_MS = 60_000;

const PROMPT_VERSION = "repair-cross-check-v1";

// ─── Types ──────────────────────────────────────────────────────────────────

export type CrossCheckVerdict = "approve" | "flag" | "reject" | "unavailable" | "pending";

export interface CrossCheckResult {
  verdict: CrossCheckVerdict;
  rationale: string | null;
  concerns: string[];
  confidence: number | null;
  improvedRepair: string | null;
  promptVersion: string;
  model: string;
  modelVersion: string | null;
}

export interface CrossCheckInput {
  evaluationJobId: string;
  findingId: string;
  optionKey: "A" | "B" | "C";
  originalText: string;
  evidenceExcerpt: string;
  diagnosis: string;
  proposedRepair: string;
  criterionKey: string;
}

export interface StoredCrossCheck {
  id: string;
  evaluation_job_id: string;
  finding_id: string;
  option_key: string;
  verdict: CrossCheckVerdict;
  rationale: string | null;
  concerns: string[];
  confidence: number | null;
  improved_repair: string | null;
  prompt_version: string;
  model: string;
  model_version: string | null;
  original_text_hash: string;
  evidence_hash: string;
  diagnosis_hash: string;
  proposed_repair_hash: string;
  created_at: string;
}

// ─── Feature flag ───────────────────────────────────────────────────────────

export function isRepairCrossCheckEnabled(): boolean {
  return process.env.REVISION_REPAIR_CROSSCHECK_ENABLED === "1";
}

function getPerplexityApiKey(): string | null {
  const key = process.env.PERPLEXITY_API_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

// ─── Hashing ────────────────────────────────────────────────────────────────

export function hashContent(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function computeHashes(input: CrossCheckInput) {
  return {
    original_text_hash: hashContent(input.originalText || ""),
    evidence_hash: hashContent(input.evidenceExcerpt || ""),
    diagnosis_hash: hashContent(input.diagnosis || ""),
    proposed_repair_hash: hashContent(input.proposedRepair || ""),
  };
}

// ─── Cache layer ────────────────────────────────────────────────────────────

let _supabase: ReturnType<typeof getSupabaseAdminClient> | undefined;

function getSupabase() {
  if (_supabase === undefined) _supabase = getSupabaseAdminClient();
  return _supabase;
}

export async function getCachedCrossCheck(
  findingId: string,
  optionKey: string,
  hashes: ReturnType<typeof computeHashes>,
  supabaseOverride?: ReturnType<typeof getSupabaseAdminClient> | null,
): Promise<StoredCrossCheck | null> {
  const supabase = supabaseOverride !== undefined ? supabaseOverride : getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("revision_repair_cross_checks")
    .select("*")
    .eq("finding_id", findingId)
    .eq("option_key", optionKey)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as StoredCrossCheck;

  if (
    row.original_text_hash !== hashes.original_text_hash ||
    row.evidence_hash !== hashes.evidence_hash ||
    row.diagnosis_hash !== hashes.diagnosis_hash ||
    row.proposed_repair_hash !== hashes.proposed_repair_hash
  ) {
    return null;
  }

  return row;
}

async function persistCrossCheck(
  input: CrossCheckInput,
  result: CrossCheckResult,
  hashes: ReturnType<typeof computeHashes>,
  supabaseOverride?: ReturnType<typeof getSupabaseAdminClient> | null,
): Promise<void> {
  const supabase = supabaseOverride !== undefined ? supabaseOverride : getSupabase();
  if (!supabase) return;

  const row = {
    evaluation_job_id: input.evaluationJobId,
    finding_id: input.findingId,
    option_key: input.optionKey,
    verdict: result.verdict,
    rationale: result.rationale,
    concerns: result.concerns,
    confidence: result.confidence,
    improved_repair: result.improvedRepair,
    prompt_version: result.promptVersion,
    model: result.model,
    model_version: result.modelVersion,
    ...hashes,
    updated_at: new Date().toISOString(),
  };

  await supabase
    .from("revision_repair_cross_checks")
    .upsert(row, { onConflict: "finding_id,option_key" });
}

// ─── Prompt construction ────────────────────────────────────────────────────

function buildVerifierSystemPrompt(): string {
  return `You are an independent literary repair verifier. Your job is to check whether a proposed text repair actually fixes the diagnosed problem without introducing new issues.

You are NOT a repair writer. You do NOT generate alternative repairs unless you reject the proposal.

Evaluate the repair on these dimensions:
1. GROUNDING: Does the repair address the specific diagnosis, not a different problem?
2. DIAGNOSIS FIT: Does the repair resolve what was identified, or does it miss the point?
3. VOICE PRESERVATION: Does the repair maintain the author's voice, style, and register?
4. OVER-EDITING RISK: Does the repair change more than necessary?
5. UNSUPPORTED INVENTION: Does the repair introduce information, characters, or events not present in the original?
6. CONFIDENCE: How confident are you in your assessment?

Return ONLY valid JSON with this schema:
{
  "verdict": "approve" | "flag" | "reject",
  "rationale": "1-3 sentences explaining your assessment",
  "concerns": ["array of specific concerns, empty if approved"],
  "confidence": 0-100,
  "improvedRepair": null or "suggested alternative ONLY if verdict is reject"
}

Rules:
- approve: The repair addresses the diagnosis without introducing problems.
- flag: The repair partially addresses the diagnosis but has concerns worth reviewing.
- reject: The repair fails to address the diagnosis, introduces new problems, or violates voice.
- Only provide improvedRepair when verdict is "reject" and you can suggest a better direction.
- improvedRepair is verifier guidance only — it will never be shown to the author directly.
- Be conservative: when in doubt, flag rather than approve.`;
}

function buildVerifierUserPrompt(input: CrossCheckInput): string {
  return `CRITERION: ${input.criterionKey}

ORIGINAL TEXT:
${input.originalText}

EVIDENCE EXCERPT:
${input.evidenceExcerpt}

DIAGNOSIS:
${input.diagnosis}

PROPOSED REPAIR (Option ${input.optionKey}):
${input.proposedRepair}

Verify this repair against the diagnosis and return your JSON assessment.`;
}

// ─── Perplexity API call ────────────────────────────────────────────────────

export interface CrossCheckCallOptions {
  _fetch?: typeof fetch;
  /** Override Supabase for testing — set to null to skip persistence. */
  _supabase?: unknown | null;
}

async function callPerplexityVerifier(
  input: CrossCheckInput,
  apiKey: string,
  opts?: CrossCheckCallOptions,
): Promise<CrossCheckResult> {
  const fetchFn = opts?._fetch ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PERPLEXITY_TIMEOUT_MS);

  try {
    const response = await fetchFn(`${PERPLEXITY_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: PERPLEXITY_MODEL,
        messages: [
          { role: "system", content: buildVerifierSystemPrompt() },
          { role: "user", content: buildVerifierUserPrompt(input) },
        ],
        temperature: PERPLEXITY_TEMPERATURE,
        max_tokens: PERPLEXITY_MAX_TOKENS,
        return_citations: false,
        disable_search: true,
        reasoning_effort: "high",
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(
        `[RepairCrossCheck] Perplexity API error ${response.status}: ${errText.slice(0, 300)}`,
      );
      return unavailableResult(`Perplexity API error: ${response.status}`);
    }

    const raw = (await response.json()) as {
      choices?: Array<{
        message?: { content?: unknown };
      }>;
    };

    const content = extractContent(raw.choices?.[0]?.message?.content);
    if (!content) {
      return unavailableResult("Empty response from Perplexity");
    }

    return parseVerifierResponse(content);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return unavailableResult("Perplexity request timed out");
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[RepairCrossCheck] Perplexity call failed: ${msg}`);
    return unavailableResult(`Perplexity call failed: ${msg}`);
  } finally {
    clearTimeout(timer);
  }
}

function extractContent(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((c) => {
        if (typeof c === "string") return c;
        if (typeof c?.text === "string") return c.text;
        if (typeof c?.content === "string") return c.content;
        return "";
      })
      .join("")
      .trim();
  }
  return "";
}

function parseVerifierResponse(raw: string): CrossCheckResult {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return unavailableResult("Could not parse JSON from verifier response");
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    const verdict = parseVerdict(parsed.verdict);
    const rationale = typeof parsed.rationale === "string" ? parsed.rationale : null;
    const concerns = Array.isArray(parsed.concerns)
      ? parsed.concerns.filter((c): c is string => typeof c === "string")
      : [];
    const confidence = typeof parsed.confidence === "number" &&
      Number.isFinite(parsed.confidence) &&
      parsed.confidence >= 0 &&
      parsed.confidence <= 100
      ? Math.round(parsed.confidence)
      : null;
    const improvedRepair = verdict === "reject" && typeof parsed.improvedRepair === "string"
      ? parsed.improvedRepair
      : null;

    return {
      verdict,
      rationale,
      concerns,
      confidence,
      improvedRepair,
      promptVersion: PROMPT_VERSION,
      model: PERPLEXITY_MODEL,
      modelVersion: null,
    };
  } catch {
    return unavailableResult("Failed to parse verifier JSON response");
  }
}

function parseVerdict(raw: unknown): CrossCheckVerdict {
  if (raw === "approve" || raw === "flag" || raw === "reject") return raw;
  return "unavailable";
}

function unavailableResult(reason: string): CrossCheckResult {
  return {
    verdict: "unavailable",
    rationale: reason,
    concerns: [],
    confidence: null,
    improvedRepair: null,
    promptVersion: PROMPT_VERSION,
    model: PERPLEXITY_MODEL,
    modelVersion: null,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Run a cross-check on a single repair proposal.
 *
 * Returns cached result if hashes match. Otherwise calls Perplexity and
 * persists the result. Returns `unavailable` if the feature is disabled,
 * the API key is missing, or the call fails.
 *
 * This function is idempotent and safe to call multiple times for the
 * same finding+option — duplicate calls return the cached result.
 */
function resolveSupabase(opts?: CrossCheckCallOptions) {
  if (opts && "_supabase" in opts) return opts._supabase as ReturnType<typeof getSupabaseAdminClient>;
  return getSupabase();
}

export async function crossCheckRepair(
  input: CrossCheckInput,
  opts?: CrossCheckCallOptions,
): Promise<CrossCheckResult> {
  if (!isRepairCrossCheckEnabled()) {
    return unavailableResult("Feature disabled (REVISION_REPAIR_CROSSCHECK_ENABLED != 1)");
  }

  const apiKey = getPerplexityApiKey();
  if (!apiKey) {
    return unavailableResult("PERPLEXITY_API_KEY not configured");
  }

  if (!input.proposedRepair.trim()) {
    return unavailableResult("No proposed repair text to verify");
  }

  const hashes = computeHashes(input);
  const sb = resolveSupabase(opts);

  if (sb) {
    const cached = await getCachedCrossCheck(input.findingId, input.optionKey, hashes, sb);
    if (cached) {
      return {
        verdict: cached.verdict,
        rationale: cached.rationale,
        concerns: cached.concerns,
        confidence: cached.confidence,
        improvedRepair: cached.improved_repair,
        promptVersion: cached.prompt_version,
        model: cached.model,
        modelVersion: cached.model_version,
      };
    }
  }

  const result = await callPerplexityVerifier(input, apiKey, opts);

  if (sb) {
    await persistCrossCheck(input, result, hashes, sb).catch((err) => {
      console.warn(
        "[RepairCrossCheck] Failed to persist cross-check result (non-fatal):",
        err instanceof Error ? err.message : String(err),
      );
    });
  }

  return result;
}

/**
 * Batch cross-check multiple findings. Processes sequentially to avoid
 * overwhelming Perplexity with concurrent calls during background runs.
 *
 * Designed for durable background execution — not for synchronous
 * workbench load. Each result is persisted individually so partial
 * progress survives if the process is interrupted.
 */
export async function batchCrossCheckRepairs(
  inputs: CrossCheckInput[],
  opts?: CrossCheckCallOptions,
): Promise<Map<string, CrossCheckResult>> {
  if (!isRepairCrossCheckEnabled()) {
    const results = new Map<string, CrossCheckResult>();
    for (const input of inputs) {
      const key = `${input.findingId}:${input.optionKey}`;
      results.set(key, unavailableResult("Feature disabled"));
    }
    return results;
  }

  const results = new Map<string, CrossCheckResult>();

  for (const input of inputs) {
    const key = `${input.findingId}:${input.optionKey}`;
    const result = await crossCheckRepair(input, opts);
    results.set(key, result);
  }

  return results;
}

/**
 * Look up cached cross-check verdicts for a set of findings.
 * Used by the workbench to display badge state without triggering
 * new Perplexity calls. Returns only findings that have cached results.
 */
export async function getCachedVerdicts(
  findingIds: string[],
  supabaseOverride?: ReturnType<typeof getSupabaseAdminClient> | null,
): Promise<Map<string, StoredCrossCheck>> {
  const supabase = supabaseOverride !== undefined ? supabaseOverride : getSupabase();
  if (!supabase || findingIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("revision_repair_cross_checks")
    .select("*")
    .in("finding_id", findingIds)
    .eq("option_key", "A");

  if (error || !data) return new Map();

  const map = new Map<string, StoredCrossCheck>();
  for (const row of data) {
    map.set(row.finding_id as string, row as StoredCrossCheck);
  }
  return map;
}

// ─── TrustedPath gate ───────────────────────────────────────────────────────

/**
 * TrustedPath contract: only repairs with an `approve` cross-check verdict
 * may be auto-applied. All other verdicts (flag, reject, unavailable, pending)
 * require manual author review.
 *
 * Returns true if the finding's Option A has been independently approved.
 */
export function isTrustedPathEligible(verdict: CrossCheckVerdict | null | undefined): boolean {
  return verdict === "approve";
}
