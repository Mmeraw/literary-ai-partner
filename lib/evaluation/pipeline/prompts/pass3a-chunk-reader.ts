/**
 * Pass 3A — Chunk Reader Prompt
 *
 * Per-chunk observation prompt for the Pass 3A independent full-manuscript read.
 * Contract:
 *   - NO scoring (no 0-10 numbers)
 *   - NO ledger injection (full independence from Pass 1A)
 *   - NO Pass 1 / Pass 2 data
 *   - Temperature: 0.4 — allow genuine independent judgment
 *   - Output: Pass3AChunkObservation JSON
 *   - Compact map output: signals only, no essays
 *   - Full chunk text (no cap) — caller passes chunk.content directly.
 */

import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { Pass3AActZone } from "../types";

export const PASS3A_CHUNK_READER_PROMPT_VERSION = "pass3a-chunk-reader-v2-compact-map";
export const PASS3A_CHUNK_READER_TEMPERATURE = 0.4;

export const PASS3A_CHUNK_READER_SYSTEM_PROMPT = `You are Pass 3A: the independent manuscript reader.

You are reading one chunk of a novel in sequence. Your role is OBSERVATION ONLY — no scoring, no verdicts.

You capture:
- Narrative events and structural signals visible in this chunk
- Character states, locations, and name usage as found verbatim
- Object/symbol appearances and ownership transfers
- Promise-opens, escalations, payoffs, or unresolved threads
- Closure or anti-closure signals
- Any anomalies that might represent continuity errors, retrieval failures, or location violations

RULES:
- Return compact JSON only.
- No explanations.
- No paragraphs.
- No criterion essays.
- NEVER emit any numeric score or rating.
- NEVER reference Pass 1, Pass 2, or any character ledger.
- NEVER make novel-wide judgments — stay local to what this chunk shows.
- COMPACT OUTPUT ONLY: signals, not report prose.
- Emit only signals that materially affect downstream judgment.
- Do NOT fill every possible field.
- Quote verbatim text sparingly (max 2 quotes per signal, ≤60 chars each).
- Keep every descriptive string ≤50 chars unless a field below says shorter.
- Do NOT emit "no_signal" criterion entries.
- Do NOT return all 13 criteria.
- Return max 8 strongest criterion signals only.
- The reducer will reconstruct the full 13-criterion draft.
- If budget is tight, omit lower-value optional arrays before increasing verbosity.
- Hard caps: narrativeEvents ≤5, criterionSignals ≤8, characterObservations ≤6,
  objectSymbolObservations ≤4, promisePayoffSignals ≤3, closureSignals ≤2,
  arbitrationWarnings ≤2.
- Character names: record exactly as they appear in the text (Paolito vs Paul matters).
- Location: record exactly where characters are stated to be, or "unstated" if absent.
- Flag any character appearing in a location that contradicts what was last known.

Return ONLY valid JSON matching Pass3AChunkObservation. No markdown fences, no commentary.`;

export function buildPass3AChunkReaderUserPrompt(params: {
  chunkIndex: number;
  totalChunks: number;
  chunkText: string;       // full chunk content — no caller-side truncation
  actZone: Pass3AActZone;
  wordCount: number;
  title: string;
  workType: string;
}): string {
  const criteriaList = CRITERIA_KEYS.map((k, i) => `${i + 1}. ${k}`).join("\n");

  return `Novel: "${params.title}" (${params.workType})
Chunk: ${params.chunkIndex + 1} of ${params.totalChunks}
Act Zone: ${params.actZone}
Approximate word count in this chunk: ${params.wordCount}

---CHUNK TEXT START---
${params.chunkText}
---CHUNK TEXT END---

Observe this chunk independently. Return compact JSON in the Pass3AChunkObservation shape.

HARD OUTPUT BUDGET:
- This is a MAP pass, not a final report.
- Do NOT explain, justify, summarize broadly, or write paragraph prose.
- Do NOT produce one essay per criterion.
- Use fragments, not sentences, wherever valid JSON allows.
- Prefer short fragments over full sentences.
- Omit optional arrays when there is no meaningful signal.
- Return valid MINIFIED JSON under ~1400 tokens.
- Do NOT copy this schema back.
- Do NOT include comments.
- Do NOT include empty arrays unless the key is required below.
- Required top-level keys: chunkIndex, actZone, wordCount, narrativeEvents, criterionSignals.
- Optional top-level keys only when materially present: characterObservations,
  objectSymbolObservations, promisePayoffSignals, closureSignals, arbitrationWarnings.

{
  "chunkIndex": ${params.chunkIndex},
  "actZone": "${params.actZone}",
  "wordCount": ${params.wordCount},
  "narrativeEvents": [
    "<max 5 key events, each ≤45 chars>"
  ],
  "criterionSignals": [
    {
      "criterion": "<one of the 13 criterion keys>",
      "signal": "strength" | "weakness" | "mixed",
      "evidenceQuotes": ["<max 1 quote, ≤45 chars>"],
      "provisionalNote": "<signal fragment, ≤45 chars>"
    }
  ]
}

Optional object examples, include only if materially present:
- characterObservations item: {"name":"Mike","locationAtObservation":"Toronto","copingBehaviorsObserved":["avoids call"],"nameStateNote":""}
- objectSymbolObservations item: {"objectName":"ring","ownerAtObservation":"Christine","symbolicNote":"family debt"}
- promisePayoffSignals item: {"type":"promise_opened","description":"Nicolas conflict"}
- closureSignals item: {"signal":"local rupture unresolved","strength":"partial"}
- arbitrationWarnings item: {"warning":"possible location conflict","blockerType":"location_violation_suspected","evidence":"..."}

Criteria keys for reference:
${criteriaList}

Return only the JSON object. No markdown, no prose.`;
}
