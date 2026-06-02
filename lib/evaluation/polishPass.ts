/**
 * Polish Pass Runner — Post-Eval Surface Integrity Scanner
 *
 * Runs AFTER the DREAM evaluation completes. Scans manuscript text chunk-by-chunk
 * for mechanical/surface-level issues (grammar, passive voice, adverbs, punctuation,
 * repetition, spelling) and produces RevisionOpportunity[] tagged as surface polish.
 *
 * Architecture:
 * - Accepts: job ID, manuscript text, manuscript metadata
 * - Chunks long manuscripts (>5k words) into overlapping windows
 * - Calls LLM with polish-pass prompt per chunk
 * - Deduplicates and merges results
 * - Returns RevisionOpportunity[] with provenance='polish_pass'
 *
 * No charge to the author — this is a value-add after the paid DREAM eval.
 */

import { randomUUID } from "crypto";
import OpenAI from "openai";
import {
  POLISH_PASS_SYSTEM_PROMPT,
  POLISH_PASS_VERSION,
  buildPolishPassUserPrompt,
} from "./pipeline/prompts/polish-pass";

// ─── Types ───────────────────────────────────────────────────────────────────

export type PolishCategory =
  | "grammar"
  | "passive_voice"
  | "adverb_density"
  | "punctuation"
  | "repetition"
  | "spelling";

export type PolishSeverity = "must" | "should" | "could";

export type PolishFinding = {
  category: PolishCategory;
  severity: PolishSeverity;
  anchor_snippet: string;
  manuscript_coordinates: string;
  symptom: string;
  rationale: string;
  candidate_text_a: string;
  candidate_text_b: string;
  candidate_text_c: string;
  revision_operation: string;
  confidence: "high" | "medium" | "low";
};

export type PolishPassResult = {
  findings: PolishFinding[];
  chunks_processed: number;
  duration_ms: number;
  prompt_version: string;
};

export type PolishPassRevisionOpportunity = {
  opportunity_id: string;
  criterion: string;
  severity: PolishSeverity;
  rationale: string;
  evidence_anchor: string;
  manuscript_coordinates: string;
  provenance: "polish_pass";
  confidence: "high" | "medium" | "low";
  decision_state: "open";
  revision_operation: string;
  candidate_text_a: string;
  candidate_text_b: string;
  candidate_text_c: string;
  symptom: string;
  category: PolishCategory;
};

// ─── Configuration ───────────────────────────────────────────────────────────

const POLISH_CHUNK_SIZE_WORDS = 4000;
const POLISH_CHUNK_OVERLAP_WORDS = 200;
const POLISH_MAX_CHUNKS = 30;
const POLISH_CONCURRENCY = 2;
const POLISH_TIMEOUT_MS = 120_000;

const VALID_CATEGORIES: Set<string> = new Set([
  "grammar",
  "passive_voice",
  "adverb_density",
  "punctuation",
  "repetition",
  "spelling",
]);
const VALID_SEVERITIES: Set<string> = new Set(["must", "should", "could"]);
const VALID_CONFIDENCE: Set<string> = new Set(["high", "medium", "low"]);

// ─── Chunking ────────────────────────────────────────────────────────────────

function chunkManuscriptForPolish(text: string): string[] {
  const words = text.split(/\s+/);
  if (words.length <= POLISH_CHUNK_SIZE_WORDS) return [text];

  const chunks: string[] = [];
  let start = 0;
  while (start < words.length && chunks.length < POLISH_MAX_CHUNKS) {
    const end = Math.min(start + POLISH_CHUNK_SIZE_WORDS, words.length);
    chunks.push(words.slice(start, end).join(" "));
    start = end - POLISH_CHUNK_OVERLAP_WORDS;
    if (start >= words.length) break;
  }
  return chunks;
}

// ─── LLM Call ────────────────────────────────────────────────────────────────

async function callPolishLLM(
  openai: OpenAI,
  chunkText: string,
  title: string,
  genre: string,
  wordCount: number,
): Promise<PolishFinding[]> {
  const userPrompt = buildPolishPassUserPrompt({
    manuscriptText: chunkText,
    manuscriptTitle: title,
    genre,
    wordCount,
  });

  const response = await openai.chat.completions.create(
    {
      model: "gpt-4o",
      messages: [
        { role: "system", content: POLISH_PASS_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 8000,
      response_format: { type: "json_object" },
    },
    { timeout: POLISH_TIMEOUT_MS },
  );

  const raw = response.choices[0]?.message?.content ?? "";
  return parsePolishResponse(raw);
}

function parsePolishResponse(raw: string): PolishFinding[] {
  try {
    const parsed = JSON.parse(raw);
    // Handle both array responses and { findings: [...] } wrapper
    const arr = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.findings)
        ? parsed.findings
        : Array.isArray(parsed?.items)
          ? parsed.items
          : [];

    return arr
      .filter(
        (item: unknown): item is Record<string, unknown> =>
          typeof item === "object" && item !== null,
      )
      .map((item) => ({
        category: VALID_CATEGORIES.has(String(item.category))
          ? (String(item.category) as PolishCategory)
          : "grammar",
        severity: VALID_SEVERITIES.has(String(item.severity))
          ? (String(item.severity) as PolishSeverity)
          : "could",
        anchor_snippet: String(item.anchor_snippet ?? "").slice(0, 500),
        manuscript_coordinates: String(
          item.manuscript_coordinates ?? "",
        ).slice(0, 200),
        symptom: String(item.symptom ?? "").slice(0, 300),
        rationale: String(item.rationale ?? "").slice(0, 500),
        candidate_text_a: String(item.candidate_text_a ?? "").slice(0, 1000),
        candidate_text_b: String(item.candidate_text_b ?? "").slice(0, 1000),
        candidate_text_c: String(item.candidate_text_c ?? "").slice(0, 1000),
        revision_operation: String(
          item.revision_operation ?? "replace_selected_passage",
        ),
        confidence: VALID_CONFIDENCE.has(String(item.confidence))
          ? (String(item.confidence) as "high" | "medium" | "low")
          : "medium",
      }))
      .filter(
        (f) =>
          f.anchor_snippet.length >= 5 &&
          f.candidate_text_a.length >= 5 &&
          f.rationale.length >= 5,
      );
  } catch {
    console.warn("[PolishPass] Failed to parse LLM response");
    return [];
  }
}

// ─── Deduplication ───────────────────────────────────────────────────────────

function deduplicateFindings(findings: PolishFinding[]): PolishFinding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    // Deduplicate by anchor snippet (normalized)
    const key = f.anchor_snippet.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Main Runner ─────────────────────────────────────────────────────────────

export async function runPolishPass(opts: {
  manuscriptText: string;
  title: string;
  genre: string;
  wordCount: number;
  openaiApiKey: string;
}): Promise<PolishPassResult> {
  const startMs = Date.now();
  const openai = new OpenAI({ apiKey: opts.openaiApiKey, timeout: POLISH_TIMEOUT_MS });

  const chunks = chunkManuscriptForPolish(opts.manuscriptText);
  console.log(`[PolishPass] Processing ${chunks.length} chunks (${opts.wordCount} words)`);

  const allFindings: PolishFinding[] = [];

  // Process chunks with bounded concurrency
  const queue = [...chunks.entries()];
  const workers = Array.from({ length: Math.min(POLISH_CONCURRENCY, queue.length) }, async () => {
    while (queue.length > 0) {
      const entry = queue.shift();
      if (!entry) break;
      const [idx, chunk] = entry;
      try {
        const findings = await callPolishLLM(
          openai,
          chunk,
          opts.title,
          opts.genre,
          opts.wordCount,
        );
        allFindings.push(...findings);
        console.log(`[PolishPass] Chunk ${idx + 1}/${chunks.length}: ${findings.length} findings`);
      } catch (err) {
        console.warn(
          `[PolishPass] Chunk ${idx + 1}/${chunks.length} failed:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  });

  await Promise.all(workers);

  const deduplicated = deduplicateFindings(allFindings);
  const durationMs = Date.now() - startMs;

  console.log(
    `[PolishPass] Complete: ${deduplicated.length} findings (from ${allFindings.length} raw) in ${durationMs}ms`,
  );

  return {
    findings: deduplicated,
    chunks_processed: chunks.length,
    duration_ms: durationMs,
    prompt_version: POLISH_PASS_VERSION,
  };
}

// ─── Conversion to RevisionOpportunity ───────────────────────────────────────

export function polishFindingsToOpportunities(
  findings: PolishFinding[],
): PolishPassRevisionOpportunity[] {
  return findings.map((f) => ({
    opportunity_id: `polish_${randomUUID().slice(0, 12)}`,
    criterion: `surface_${f.category}`,
    severity: f.severity,
    rationale: f.rationale,
    evidence_anchor: f.anchor_snippet,
    manuscript_coordinates: f.manuscript_coordinates,
    provenance: "polish_pass" as const,
    confidence: f.confidence,
    decision_state: "open" as const,
    revision_operation: f.revision_operation,
    candidate_text_a: f.candidate_text_a,
    candidate_text_b: f.candidate_text_b,
    candidate_text_c: f.candidate_text_c,
    symptom: f.symptom,
    category: f.category,
  }));
}
