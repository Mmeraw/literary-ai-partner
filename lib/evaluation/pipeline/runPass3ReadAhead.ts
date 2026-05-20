/**
 * Pass 3 Read-Ahead  —  v2-analytical
 *
 * Starts the MOMENT runPipeline begins — reads the full manuscript while
 * Pass 1, Pass 2, and Pass 1A are all running in parallel.
 *
 * ── What changed in v2 ──────────────────────────────────────────────────────
 * v1 was a "dumb read": structural impression only, injected passively into
 * Pass 3 as background context that Pass 3 could ignore.
 *
 * v2 is an ACTIVE PRE-ANALYSIS:
 *   1. 6 prose windows instead of 4 — adds MID-ACT (~40%) and CLOSE (~95%)
 *      so the model actually sees the escalation peak and the final pages.
 *   2. Criterion hypotheses — the reader forms a provisional score band and
 *      rationale for every criterion BEFORE any scoring packet arrives.
 *      These are "parked" predictions, not final scores.
 *   3. Symbol arc predictions — for each detected symbol, a prediction of
 *      whether the payoff is likely to land, be deferred, or dissipate.
 *   4. Character arc predictions — per character: predicted arc resolution,
 *      predicted ending status, and any gap risks.
 *   5. Act-zone map — the reader maps which chunks belong to which act zone
 *      based purely on narrative signals (not chunk position arithmetic).
 *      Pass 3 uses this map to enforce Gate 5 (multi-zone evidence rule).
 *   6. Coverage bias flags — explicit flags when the excerpts suggest the
 *      scoring packets will over-index on opening content.
 *
 * When Pass 3 synthesis runs, it receives BOTH the scored packets AND the
 * parked read-ahead analysis.  Pass 3 must RECONCILE them — if a parked
 * hypothesis contradicts an inbound score, Pass 3 must explain why.
 *
 * ── Architecture ────────────────────────────────────────────────────────────
 *   ┌─────────────────────────────────────────────────────┐
 *   │  runPipeline START                                  │
 *   │                                                      │
 *   │  pass1Promise    ─┐                                 │
 *   │  pass2Promise    ─┼── Promise.allSettled ──┐        │
 *   │  pass1aPromise   ─┘                        │        │
 *   │  readAheadPromise ──────────────────────────┘       │
 *   │       (all four start simultaneously)                │
 *   │                                                      │
 *   │  Pass 3 waits for: pass1, pass2, pass1a settled     │
 *   │  Pass 3 also receives: readAheadResult (v2 analysis │
 *   │  done by then — or gracefully degraded if not)      │
 *   └─────────────────────────────────────────────────────┘
 *
 * Model: same as Pass 3 (gpt-5.1 or env override)
 * Temperature: 0.1 (analytical reading, not generative)
 * Max tokens: 5000 (larger budget — hypotheses require reasoning)
 * Non-blocking: NEVER throws — graceful fallback on any failure
 */

import OpenAI from "openai";
import { getCanonicalPass3Model } from "@/lib/evaluation/policy";
import { getEvalOpenAiTimeoutMs } from "@/lib/evaluation/config";
import { parseJsonObjectBoundary } from "@/lib/llm/jsonParseBoundary";
import type { ManuscriptChunkEvidence } from "./types";

export const PASS3_READ_AHEAD_VERSION = "pass3-read-ahead-v2-analytical";

const READ_AHEAD_TEMPERATURE = 0.1;
const READ_AHEAD_MAX_OUTPUT_TOKENS = 5000;
// Total character budget distributed across 6 windows.
// ~4000 chars per window (~1000 words) — tight enough to stay in budget,
// dense enough for real analytical signal.
const READ_AHEAD_WINDOW_CHARS = 24000;
const READ_AHEAD_TIMEOUT_MS = 60_000;

// ── ACT ZONE DEFINITIONS ─────────────────────────────────────────────────────
// These are the 6 canonical act zones used by Gate 5 (multi-zone evidence rule)
// and by EvidenceCoverage.actZonesCovered throughout the pipeline.
export const ACT_ZONES = [
  "Opening",    // ~0–10%
  "MID-EARLY",  // ~10–35%
  "MID-ACT",    // ~35–55%  ← was missing in v1
  "MID-LATE",   // ~55–75%
  "LATE",       // ~75–90%
  "Close",      // ~90–100% ← was missing in v1
] as const;
export type ActZone = (typeof ACT_ZONES)[number];

// ── Prose window builder ─────────────────────────────────────────────────────
// Samples 6 windows at narrative-significant positions across the manuscript.
// Returns a labeled multi-section string.

function buildReadAheadProseWindow(
  manuscriptText: string,
  manuscriptChunks?: ManuscriptChunkEvidence[],
): string {
  const windowSize = Math.floor(READ_AHEAD_WINDOW_CHARS / 6); // ~4000 chars each

  // 6 windows: Opening(0%), MID-EARLY(20%), MID-ACT(40%), MID-LATE(62%), LATE(82%), Close(95%)
  const WINDOW_POSITIONS = [0, 0.20, 0.40, 0.62, 0.82, 0.95] as const;
  const WINDOW_LABELS: ActZone[] = ["Opening", "MID-EARLY", "MID-ACT", "MID-LATE", "LATE", "Close"];

  if (Array.isArray(manuscriptChunks) && manuscriptChunks.length >= 6) {
    const sorted = [...manuscriptChunks].sort((a, b) => a.chunk_index - b.chunk_index);
    const total = sorted.length;
    return WINDOW_POSITIONS
      .map((pct, i) => {
        const pos = Math.min(Math.floor(total * pct), sorted.length - 1);
        const chunk = sorted[pos];
        const excerpt = chunk.content.slice(0, windowSize);
        const pctLabel = Math.round(pct * 100);
        return `=== ${WINDOW_LABELS[i]} (~${pctLabel}% · chunk ${chunk.chunk_index}) ===\n${excerpt}`;
      })
      .join("\n\n");
  }

  // Fallback: slice from raw text
  const totalChars = manuscriptText.length;
  return WINDOW_POSITIONS
    .map((pct, i) => {
      const pos = Math.floor(totalChars * pct);
      const excerpt = manuscriptText.slice(pos, pos + windowSize);
      const pctLabel = Math.round(pct * 100);
      return `=== ${WINDOW_LABELS[i]} (~${pctLabel}%) ===\n${excerpt}`;
    })
    .join("\n\n");
}

// ── System prompt ─────────────────────────────────────────────────────────────
// v2: analytical, hypothesis-forming, act-zone-mapping

const READ_AHEAD_SYSTEM_PROMPT = `You are the Pass 3 Read-Ahead analyst for RevisionGrade.

You are reading 6 labeled prose windows from a full novel BEFORE any scoring has occurred.
Your job is ACTIVE PRE-ANALYSIS — not a passive impression, but a set of parked hypotheses
and predictions that Pass 3 will reconcile against the scored packets it receives later.

You receive: Opening, MID-EARLY, MID-ACT, MID-LATE, LATE, Close — 6 windows across the novel.
Read them as a senior literary editor forming analytical positions before the score packets arrive.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT TO PRODUCE — 8 SECTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. character_first_impressions — Every character found across the 6 windows.
   Per character:
   - name / alias (note both: "Paolito / Paul")
   - role_impression: protagonist | co_protagonist | antagonist | secondary | unknown
   - life_stage: child | teen | young_adult | adult | elderly | unknown
   - age_if_stated: number or null
   - demographic_signals: array (race, gender, sexuality, disability, language, religion, socioeconomic — ONLY what text states explicitly)
   - five_ws: { who, what, where, when, why, how } — one phrase each, null if absent
   - arc_impression: one phrase about trajectory
   - arc_prediction: your prediction of how this arc resolves — based on the excerpts
   - arc_gap_risk: one phrase flagging any gap risk (e.g. "Benjamin's arc has no late-act resolution visible in windows seen")
   - symbolic_objects_attached: array of objects tied to this character
   - present_in: array of act zones where they appear (Opening | MID-EARLY | MID-ACT | MID-LATE | LATE | Close)

2. narrative_structure_map — Overall novel architecture.
   - pov_architecture: one phrase
   - act_impressions: { opening_register, mid_early_register, mid_act_pivot, mid_late_register, late_act_pressure, close_register }
   - dominant_tone, dominant_setting, temporal_scope
   - structural_risk: one phrase (e.g. "opening-heavy — first 25% carries disproportionate scene density")

3. act_zone_map — Your mapping of WHICH act zone each window belongs to based on narrative signals.
   This tells Pass 3 which Gate 5 zone each scored evidence chunk likely falls in.
   Array of entries: { window_label, act_zone_assigned, zone_signal, confidence: "HIGH"|"MEDIUM"|"LOW" }
   - window_label: the exact label used above (Opening, MID-EARLY, etc.)
   - act_zone_assigned: one of: Opening | MID-EARLY | MID-ACT | MID-LATE | LATE | Close
   - zone_signal: one phrase explaining why you assigned this zone (narrative signal, not position math)
   - confidence: HIGH if a clear structural signal is present; MEDIUM if inferred; LOW if ambiguous

4. criterion_hypotheses — For EVERY RevisionGrade criterion, a pre-scoring hypothesis.
   These are PARKED PREDICTIONS — Pass 3 must reconcile them against the inbound scored packets.
   Criteria to cover: concept, narrativeClosure, characterArcs, voiceAndPerspective,
   worldBuilding, theme, dialogue, pacing, proseControl, structuralCohesion,
   originality, emotionalResonance, marketability
   Per criterion:
   - key: exact criterion key
   - predicted_band: "STRONG" | "ADEQUATE" | "WEAK" | "INSUFFICIENT_SIGNAL"
   - predicted_score_range: e.g. "7–8" or "4–6" or null if INSUFFICIENT_SIGNAL
   - hypothesis_rationale: 1-2 sentences stating what evidence from the windows drives this prediction
   - hypothesis_evidence_zones: array of act zones that provided signal (e.g. ["Opening", "MID-ACT"])
   - reconciliation_flag: "WATCH" | "NONE" — set WATCH if the hypothesis suggests the inbound
     scoring is likely to miss something (e.g. opening-heavy evidence will under-represent late-act strength)

5. symbol_register — Objects and motifs detected across windows.
   Per symbol:
   - object: name of the object or motif
   - first_window: act zone where first seen
   - last_window_seen: act zone where last seen
   - attached_characters: array of character names
   - trajectory: "ascending" | "descending" | "static" | "interrupted" | "unclear"
   - payoff_prediction: "likely_lands" | "at_risk" | "unresolved" | "unclear"
   - payoff_rationale: one phrase

6. relationship_spine_impressions — Key pairings and their dynamics.
   Per pair:
   - pair: "Name A – Name B"
   - dynamic_impression: one phrase
   - first_shared_zone: act zone where they first appear together (or "not_confirmed" if not seen together)
   - trajectory_prediction: one phrase about where this relationship appears to be heading

7. coverage_concerns — Array of strings.
   Flag any structural concern about how the scored packets are likely to be distributed.
   E.g.:
   - "Opening window carries 40% of visible scene density — scoring packets may over-index on opening acts"
   - "MID-ACT window shows escalation peak not visible in Opening — Gate 5 reconciliation required for pacing"
   - "Close window shows resolution of X — late-act evidence must be present in scoring packets"

8. reconciliation_instructions — Array of strings.
   DIRECT INSTRUCTIONS to Pass 3 Synthesis on what to reconcile.
   These are not suggestions — Pass 3 must address each one explicitly.
   E.g.:
   - "Pacing: read-ahead predicts STRONG late-act pressure (MID-ACT, LATE zones). If inbound pacing score < 6, explain the discrepancy or revise upward with late-act evidence."
   - "CharacterArcs: Benjamin arc gap detected in MID-LATE zone. If Pass 1 scores characterArcs >= 7, verify that late-act Benjamin evidence is present in the scored packet."
   - "Symbols: evil-eye object tracked Opening→LATE. If symbol payoff is not addressed in recommendations, add one."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HARD RULES:
- Do NOT emit final scores — only predicted bands and ranges.
- Do NOT emit final recommendations — only hypotheses and reconciliation instructions.
- Do NOT reference Pass 1 or Pass 2 — they haven't run yet.
- Do NOT invent characters or events not present in the excerpts.
- Keep every string field <= 150 characters.
- Return valid JSON only. No markdown.

Return exactly this shape:
{
  "pass": "3_read_ahead",
  "character_first_impressions": [...],
  "narrative_structure_map": { ... },
  "act_zone_map": [...],
  "criterion_hypotheses": [...],
  "symbol_register": [...],
  "relationship_spine_impressions": [...],
  "coverage_concerns": [...],
  "reconciliation_instructions": [...],
  "read_ahead_version": "${PASS3_READ_AHEAD_VERSION}",
  "generated_at": "<ISO 8601>"
}`;

// ── Output types ─────────────────────────────────────────────────────────────

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
  arc_prediction: string;
  arc_gap_risk: string;
  symbolic_objects_attached: string[];
  present_in: string[];
}

export interface Pass3ActZoneMapEntry {
  window_label: string;
  act_zone_assigned: string;
  zone_signal: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

export interface Pass3CriterionHypothesis {
  key: string;
  predicted_band: "STRONG" | "ADEQUATE" | "WEAK" | "INSUFFICIENT_SIGNAL";
  predicted_score_range: string | null;
  hypothesis_rationale: string;
  hypothesis_evidence_zones: string[];
  reconciliation_flag: "WATCH" | "NONE";
}

export interface Pass3ReadAheadResult {
  pass: "3_read_ahead";
  character_first_impressions: Pass3ReadAheadCharacterImpression[];
  narrative_structure_map: {
    pov_architecture: string;
    act_impressions: {
      opening_register: string;
      mid_early_register: string;
      mid_act_pivot: string;
      mid_late_register: string;
      late_act_pressure: string;
      close_register: string;
    };
    dominant_tone: string;
    dominant_setting: string;
    temporal_scope: string;
    structural_risk: string;
  };
  act_zone_map: Pass3ActZoneMapEntry[];
  criterion_hypotheses: Pass3CriterionHypothesis[];
  symbol_register: Array<{
    object: string;
    first_window: string;
    last_window_seen: string;
    attached_characters: string[];
    trajectory: string;
    payoff_prediction: string;
    payoff_rationale: string;
  }>;
  relationship_spine_impressions: Array<{
    pair: string;
    dynamic_impression: string;
    first_shared_zone: string;
    trajectory_prediction: string;
  }>;
  coverage_concerns: string[];
  reconciliation_instructions: string[];
  read_ahead_version: string;
  generated_at: string;
  /** True if this is a graceful fallback due to LLM failure */
  is_fallback?: boolean;
}

// ── Fallback ─────────────────────────────────────────────────────────────────

function buildFallbackReadAhead(): Pass3ReadAheadResult {
  return {
    pass: "3_read_ahead",
    character_first_impressions: [],
    narrative_structure_map: {
      pov_architecture: "unknown — read-ahead unavailable",
      act_impressions: {
        opening_register: "unavailable",
        mid_early_register: "unavailable",
        mid_act_pivot: "unavailable",
        mid_late_register: "unavailable",
        late_act_pressure: "unavailable",
        close_register: "unavailable",
      },
      dominant_tone: "unknown",
      dominant_setting: "unknown",
      temporal_scope: "unknown",
      structural_risk: "unknown — read-ahead failed",
    },
    act_zone_map: [],
    criterion_hypotheses: [],
    symbol_register: [],
    relationship_spine_impressions: [],
    coverage_concerns: ["Pass 3 read-ahead failed — Pass 3 synthesis running without manuscript primer"],
    reconciliation_instructions: [],
    read_ahead_version: PASS3_READ_AHEAD_VERSION,
    generated_at: new Date().toISOString(),
    is_fallback: true,
  };
}

// ── Runner ────────────────────────────────────────────────────────────────────

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

  const userPrompt = `Active pre-analysis for: "${opts.title}" (${opts.workType})

${proseWindow}

Produce the full analytical pre-analysis as specified. Return ONLY the JSON object. No prose, no markdown.`;

  try {
    console.log("[Pass3ReadAhead] Starting analytical manuscript pre-analysis", {
      job_id: opts.jobId ?? null,
      title: opts.title,
      model,
      version: PASS3_READ_AHEAD_VERSION,
      windows: 6,
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

    const hypotheses = parsed.criterion_hypotheses as Pass3CriterionHypothesis[] | undefined;
    const watchCount = hypotheses?.filter((h) => h.reconciliation_flag === "WATCH").length ?? 0;

    console.log("[Pass3ReadAhead] Complete", {
      job_id: opts.jobId ?? null,
      version: PASS3_READ_AHEAD_VERSION,
      characters_found: (parsed.character_first_impressions as unknown[]).length,
      criterion_hypotheses: hypotheses?.length ?? 0,
      reconciliation_watch_flags: watchCount,
      coverage_concerns: (parsed.coverage_concerns as string[] | undefined)?.length ?? 0,
      reconciliation_instructions: (parsed.reconciliation_instructions as string[] | undefined)?.length ?? 0,
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
