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
 *   - Max evidence quotes: 6 per chunk
 *   - Full chunk text (no cap) — caller passes chunk.content directly.
 */

import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { Pass3AActZone } from "../types";

export const PASS3A_CHUNK_READER_PROMPT_VERSION = "pass3a-chunk-reader-v1";
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
- NEVER emit any numeric score or rating.
- NEVER reference Pass 1, Pass 2, or any character ledger.
- NEVER make novel-wide judgments — stay local to what this chunk shows.
- Quote verbatim text as evidence (max 6 quotes, ≤80 chars each).
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

Observe this chunk independently. Return a JSON object with this exact shape:

{
  "chunkIndex": ${params.chunkIndex},
  "actZone": "${params.actZone}",
  "wordCount": ${params.wordCount},
  "narrativeEvents": [
    // array of strings — key events, decisions, or structural beats visible in this chunk
  ],
  "criterionSignals": [
    // one entry per criterion where you observed SOMETHING (omit criteria with zero signal)
    {
      "criterion": "<one of the 13 criterion keys>",
      "signal": "strength" | "weakness" | "mixed" | "no_signal",
      "evidenceQuotes": ["<verbatim quote ≤80 chars>"],
      "provisionalNote": "<what you saw — max 200 chars>"
    }
  ],
  "characterObservations": [
    {
      "name": "<exact name as written in chunk>",
      "locationAtObservation": "<where they are, or 'unstated'>",
      "copingBehaviorsObserved": [],
      "nameStateNote": "<optional — e.g. 'Uses Paolito here'>"
    }
  ],
  "objectSymbolObservations": [
    {
      "objectName": "<object or motif name>",
      "ownerAtObservation": "<who has/mentions it, or 'none'>",
      "symbolicNote": "<what it seems to mean in context — max 120 chars>"
    }
  ],
  "promisePayoffSignals": [
    {
      "type": "promise_opened" | "promise_escalated" | "promise_paid" | "promise_unresolved",
      "description": "<what promise or payoff — max 150 chars>"
    }
  ],
  "closureSignals": [
    {
      "signal": "<what you observed — max 120 chars>",
      "strength": "strong" | "partial" | "absent"
    }
  ],
  "arbitrationWarnings": [
    // ONLY flag genuine anomalies — do not over-flag
    {
      "warning": "<what seems wrong — max 150 chars>",
      "blockerType": "retrieval_failure_suspected" | "location_violation_suspected" | "name_state_violation_suspected" | "opening_overbias_suspected" | "missing_object_system_suspected" | "co_presence_violation_suspected" | "insufficient_coverage",
      "evidence": "<verbatim quote ≤80 chars>"
    }
  ]
}

Criteria keys for reference:
${criteriaList}

Return only the JSON object. No markdown, no prose.`;
}
