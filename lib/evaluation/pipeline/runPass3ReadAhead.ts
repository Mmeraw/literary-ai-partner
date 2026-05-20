/**
 * Pass 3 Read-Ahead
 *
 * Starts the MOMENT runPipeline begins — reads the full manuscript while
 * Pass 1, Pass 2, and Pass 1A are all running in parallel.
 *
 * Purpose:
 *   Pass 3 synthesis currently receives compressed packets from Pass 1/2
 *   plus a regex-based Pass 2A context. By the time Pass 3 runs it has
 *   never actually "read" the manuscript as a whole — it only sees the
 *   summaries. The read-ahead gives Pass 3 a prior: a full-manuscript
 *   structural impression formed independently, before any scoring data
 *   arrives. When the Pass 1/2/1A packets land, Pass 3 reconciles its
 *   read-ahead impression against the scored evidence, producing a much
 *   better-informed synthesis.
 *
 * Architecture:
 *   ┌─────────────────────────────────────────────────┐
 *   │  runPipeline START                              │
 *   │                                                  │
 *   │  pass1Promise    ─┐                             │
 *   │  pass2Promise    ─┼── Promise.allSettled ──┐    │
 *   │  pass1aPromise   ─┘                        │    │
 *   │  readAheadPromise ──────────────────────────┘   │
 *   │       (all four start simultaneously)            │
 *   │                                                  │
 *   │  Pass 3 waits for: pass1, pass2, pass1a settled │
 *   │  Pass 3 also receives: readAheadResult (done by │
 *   │  then — or gracefully degraded if not)          │
 *   └─────────────────────────────────────────────────┘
 *
 * The read-ahead uses a single GPT call over a BUDGET-CAPPED prose window.
 * It is NON-BLOCKING for Pass 3: if it fails, Pass 3 runs without it.
 * It does NOT score. It does NOT produce criteria. It produces:
 *   - A structural narrative map (chapters/acts, POV architecture)
 *   - A character roster with first impressions
 *   - Symbolic / object register
 *   - Dominant thematic / tonal register
 *   - Coverage concerns (e.g. "opening-heavy risk")
 *
 * Model: same as Pass 3 (gpt-5.1 or env override)
 * Temperature: 0.1 (read comprehension, not generation)
 * Max tokens: 3000 (compact — this is a primer not a report)
 */

import OpenAI from "openai";
import { getCanonicalPass3Model } from "@/lib/evaluation/policy";
import { getEvalOpenAiTimeoutMs } from "@/lib/evaluation/config";
import { parseJsonObjectBoundary } from "@/lib/llm/jsonParseBoundary";
import type { ManuscriptChunkEvidence } from "./types";

export const PASS3_READ_AHEAD_VERSION = "pass3-read-ahead-v1";

const READ_AHEAD_TEMPERATURE = 0.1;
const READ_AHEAD_MAX_OUTPUT_TOKENS = 3000;
// How many chars to sample from the full manuscript for the read-ahead.
// Distributed: opening, middle, late, ending — not just the first N chars.
const READ_AHEAD_WINDOW_CHARS = 24000; // ~6000 words — meaningful coverage
const READ_AHEAD_TIMEOUT_MS = 50_000;

// ── Prose window builder ──────────────────────────────────────────────────
// Samples 4 equidistant windows across the manuscript for even coverage.
// Returns a labeled multi-section string.

function buildReadAheadProseWindow(
  manuscriptText: string,
  manuscriptChunks?: ManuscriptChunkEvidence[],
): string {
  const totalChars = manuscriptText.length;
  const windowSize = Math.floor(READ_AHEAD_WINDOW_CHARS / 4); // 6000 chars per window

  // Use chunks if available for cleaner boundaries
  if (Array.isArray(manuscriptChunks) && manuscriptChunks.length >= 4) {
    const sorted = [...manuscriptChunks].sort((a, b) => a.chunk_index - b.chunk_index);
    const total = sorted.length;
    // 4 windows: opening (~0%), early-middle (~25%), late-middle (~65%), ending (~90%)
    const positions = [0, Math.floor(total * 0.25), Math.floor(total * 0.65), Math.floor(total * 0.90)];
    const labels = ["OPENING", "EARLY-MIDDLE", "LATE-MIDDLE", "ENDING"];
    return positions
      .map((pos, i) => {
        const chunk = sorted[Math.min(pos, sorted.length - 1)];
        const excerpt = chunk.content.slice(0, windowSize);
        return `=== ${labels[i]} (chunk ${chunk.chunk_index}) ===\n${excerpt}`;
      })
      .join("\n\n");
  }

  // Fallback: slice from full text
  const positions = [0, Math.floor(totalChars * 0.25), Math.floor(totalChars * 0.65), Math.floor(totalChars * 0.90)];
  const labels = ["OPENING", "EARLY-MIDDLE", "LATE-MIDDLE", "ENDING"];
  return positions
    .map((pos, i) => {
      const excerpt = manuscriptText.slice(pos, pos + windowSize);
      return `=== ${labels[i]} (~${Math.round((pos / totalChars) * 100)}% into manuscript) ===\n${excerpt}`;
    })
    .join("\n\n");
}

// ── System prompt ─────────────────────────────────────────────────────────

const READ_AHEAD_SYSTEM_PROMPT = `You are the Pass 3 Read-Ahead reader for RevisionGrade.

You are reading excerpts from a full novel BEFORE any scoring has occurred.
Your job is a pure reading impression — NOT scoring, NOT critique, NOT recommendations.

You will receive 4 labeled prose windows: OPENING, EARLY-MIDDLE, LATE-MIDDLE, ENDING.
Read them as a skilled literary reader and return a compact structured JSON primer.

This primer will be handed to Pass 3 Synthesis so it arrives already-oriented to the manuscript
before the scored packets from Pass 1 and Pass 2 arrive.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT TO CAPTURE:

1. character_first_impressions — Array of characters you encounter in the excerpts.
   For EACH character include:
   - name / alias (note both if both appear: "Paolito / Paul")
   - role_impression: protagonist | co_protagonist | antagonist | secondary | unknown
   - life_stage: child | teen | young_adult | adult | elderly | unknown
   - age_if_stated: number or null
   - demographic_signals: array of strings (race, gender, sexuality, disability, language, religion, socioeconomic — ONLY what text states)
   - five_ws: { who, what, where, when, why, how } — one phrase each, null if not present
   - arc_impression: one phrase about their trajectory through the excerpts seen
   - symbolic_objects_attached: array of objects tied to this character
   - present_in: array of windows where they appear (OPENING | EARLY-MIDDLE | LATE-MIDDLE | ENDING)

2. narrative_structure_map
   - pov_architecture: one phrase (e.g. "dual close-third: Michael primary, Benjamin parallel")
   - act_impressions: { opening_register, midpoint_signal, late_act_pressure, ending_register }
   - dominant_tone: one phrase
   - dominant_setting: one phrase
   - temporal_scope: one phrase (e.g. "weeks of captivity → Vancouver relocation")

3. symbol_register — objects / motifs that appear across multiple windows
   Each: { object, first_window, last_window_seen, function_impression }

4. coverage_concerns — list of strings flagging any impression of imbalance
   (e.g. "Opening window is dense with Michael POV — Benjamin's parallel arc may be underrepresented if scoring over-indexes on opening chunks")

5. relationship_spine_impressions — named relationships you detect
   Each: { pair: "Name A – Name B", dynamic_impression: string }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HARD RULES:
- Do NOT score any criterion.
- Do NOT emit recommendations.
- Do NOT reference Pass 1 or Pass 2 — they haven't run yet.
- Do NOT invent characters or events not present in the excerpts.
- Keep every string field ≤ 120 characters.
- Return valid JSON only. No markdown.

Return:
{
  "pass": "3_read_ahead",
  "character_first_impressions": [...],
  "narrative_structure_map": { ... },
  "symbol_register": [...],
  "coverage_concerns": [...],
  "relationship_spine_impressions": [...],
  "read_ahead_version": "${PASS3_READ_AHEAD_VERSION}",
  "generated_at": "<ISO 8601>"
}`;

// ── Output type ───────────────────────────────────────────────────────────

export interface Pass3ReadAheadCharacterImpression {
  name: string;
  role_impression: string;
  life_stage: string;
  age_if_stated: number | null;
  demographic_signals: string[];
  five_ws: {
    who: string | null;
    what: string | null;
    where: string | null;
    when: string | null;
    why: string | null;
    how: string | null;
  };
  arc_impression: string;
  symbolic_objects_attached: string[];
  present_in: string[];
}

export interface Pass3ReadAheadResult {
  pass: "3_read_ahead";
  character_first_impressions: Pass3ReadAheadCharacterImpression[];
  narrative_structure_map: {
    pov_architecture: string;
    act_impressions: {
      opening_register: string;
      midpoint_signal: string;
      late_act_pressure: string;
      ending_register: string;
    };
    dominant_tone: string;
    dominant_setting: string;
    temporal_scope: string;
  };
  symbol_register: Array<{
    object: string;
    first_window: string;
    last_window_seen: string;
    function_impression: string;
  }>;
  coverage_concerns: string[];
  relationship_spine_impressions: Array<{
    pair: string;
    dynamic_impression: string;
  }>;
  read_ahead_version: string;
  generated_at: string;
  /** True if this is a graceful fallback due to LLM failure */
  is_fallback?: boolean;
}

// ── Fallback ──────────────────────────────────────────────────────────────

function buildFallbackReadAhead(): Pass3ReadAheadResult {
  return {
    pass: "3_read_ahead",
    character_first_impressions: [],
    narrative_structure_map: {
      pov_architecture: "unknown — read-ahead unavailable",
      act_impressions: {
        opening_register: "unavailable",
        midpoint_signal: "unavailable",
        late_act_pressure: "unavailable",
        ending_register: "unavailable",
      },
      dominant_tone: "unknown",
      dominant_setting: "unknown",
      temporal_scope: "unknown",
    },
    symbol_register: [],
    coverage_concerns: ["Pass 3 read-ahead failed — Pass 3 synthesis running without manuscript primer"],
    relationship_spine_impressions: [],
    read_ahead_version: PASS3_READ_AHEAD_VERSION,
    generated_at: new Date().toISOString(),
    is_fallback: true,
  };
}

// ── Runner ────────────────────────────────────────────────────────────────

export interface RunPass3ReadAheadOptions {
  manuscriptText: string;
  manuscriptChunks?: ManuscriptChunkEvidence[];
  title: string;
  workType: string;
  openaiApiKey?: string;
  jobId?: string;
}

/**
 * Start the read-ahead immediately when the pipeline starts.
 * NEVER throws — returns a graceful fallback on any failure.
 * Pass 3 Synthesis must work correctly whether this is populated or not.
 */
export async function runPass3ReadAhead(
  opts: RunPass3ReadAheadOptions,
): Promise<Pass3ReadAheadResult> {
  const model = getCanonicalPass3Model();
  const proseWindow = buildReadAheadProseWindow(opts.manuscriptText, opts.manuscriptChunks);

  const openai = new OpenAI({
    apiKey: opts.openaiApiKey ?? process.env.OPENAI_API_KEY,
    timeout: READ_AHEAD_TIMEOUT_MS,
    maxRetries: 1,
  });

  const userPrompt = `Read-ahead for: "${opts.title}" (${opts.workType})

${proseWindow}

Return ONLY the JSON primer as specified. No prose, no markdown, no scoring.`;

  try {
    console.log("[Pass3ReadAhead] Starting manuscript read-ahead", {
      job_id: opts.jobId ?? null,
      title: opts.title,
      model,
      prose_window_chars: proseWindow.length,
    });

    const completion = await openai.chat.completions.create({
      model,
      temperature: READ_AHEAD_TEMPERATURE,
      max_completion_tokens: READ_AHEAD_MAX_OUTPUT_TOKENS,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: READ_AHEAD_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });

    const rawContent = completion.choices?.[0]?.message?.content;
    if (typeof rawContent !== "string" || rawContent.trim() === "") {
      console.warn("[Pass3ReadAhead] Empty response — using fallback", { job_id: opts.jobId ?? null });
      return buildFallbackReadAhead();
    }

    const parsed = parseJsonObjectBoundary(rawContent) as Record<string, unknown>;
    if (!parsed || !Array.isArray(parsed.character_first_impressions)) {
      console.warn("[Pass3ReadAhead] Invalid response shape — using fallback", { job_id: opts.jobId ?? null });
      return buildFallbackReadAhead();
    }

    console.log("[Pass3ReadAhead] Complete", {
      job_id: opts.jobId ?? null,
      characters_found: (parsed.character_first_impressions as unknown[]).length,
      coverage_concerns: (parsed.coverage_concerns as string[] | undefined)?.length ?? 0,
    });

    return parsed as unknown as Pass3ReadAheadResult;
  } catch (err) {
    console.error("[Pass3ReadAhead] Failed — Pass 3 will run without manuscript primer", {
      job_id: opts.jobId ?? null,
      error: err instanceof Error ? err.message : String(err),
    });
    return buildFallbackReadAhead();
  }
}
