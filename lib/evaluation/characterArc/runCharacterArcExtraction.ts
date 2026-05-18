/**
 * Character Arc Extraction — Core Worker Logic
 *
 * PR-579: Extracts the character arc ledger from a manuscript using a single
 * focused LLM pass. Runs after eval completion, decoupled from the main pipeline.
 *
 * Design:
 *   - Samples manuscript chunks (beginning + middle + end) to fit context window
 *   - Calls OpenAI with structured JSON response_format
 *   - Validates output shape before returning
 *   - Does NOT run the quality gate — that is PR-581
 *   - Does NOT render the report — that is PR-580
 */

import OpenAI from 'openai';
import { getCanonicalPass3Model } from '@/lib/evaluation/policy';
import { getEvaluationRuntimeConfig } from '@/lib/config/evaluationRuntimeConfig';
import { parseJsonObjectBoundary } from '@/lib/llm/jsonParseBoundary';
import {
  CHARACTER_ARC_SYSTEM_PROMPT,
  CHARACTER_ARC_EXTRACTION_PROMPT_VERSION,
  buildCharacterArcUserPrompt,
} from './prompt';
import type {
  CharacterArcEntry,
  RelationalEngine,
  CharacterArcLedger,
  ArcGateVerdict,
  HardFailReason,
  SoftFailReason,
} from './types';
import type { ManuscriptChunkEvidence } from '@/lib/evaluation/pipeline/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const ARC_EXTRACTION_TIMEOUT_MS = 120_000; // 2 min — single focused pass
const ARC_EXTRACTION_MAX_TOKENS = 4000;
const ARC_EXTRACTION_TEMPERATURE = 0.1;

// Sample budget: beginning (30%) + middle (20%) + end (30%) = ~24k chars of evidence
// Keeps well within GPT-4/5 context while covering the narrative arc fully
const SAMPLE_CHAR_BUDGET = 24_000;
const SAMPLE_BEGINNING_RATIO = 0.40;
const SAMPLE_END_RATIO = 0.40;

// ── Chunk sampling ────────────────────────────────────────────────────────────

/**
 * Sample manuscript chunks to fit the context budget.
 * Strategy: take beginning + end chunks (heaviest arc signal),
 * then fill middle if budget allows.
 */
function sampleManuscriptChunks(
  chunks: ManuscriptChunkEvidence[],
  charBudget: number,
): string {
  if (chunks.length === 0) return '';

  const sorted = [...chunks].sort((a, b) => a.chunk_index - b.chunk_index);

  const beginCount = Math.max(1, Math.floor(sorted.length * SAMPLE_BEGINNING_RATIO));
  const endCount = Math.max(1, Math.floor(sorted.length * SAMPLE_END_RATIO));
  const midStart = beginCount;
  const midEnd = sorted.length - endCount;

  const sections: ManuscriptChunkEvidence[] = [
    ...sorted.slice(0, beginCount),
    ...(midStart < midEnd ? sorted.slice(midStart, midEnd) : []),
    ...sorted.slice(sorted.length - endCount),
  ];

  // Deduplicate by chunk_index
  const seen = new Set<number>();
  const deduped = sections.filter((c) => {
    if (seen.has(c.chunk_index)) return false;
    seen.add(c.chunk_index);
    return true;
  });

  // Truncate to char budget
  let total = 0;
  const result: string[] = [];
  for (const chunk of deduped) {
    if (total + chunk.content.length > charBudget) {
      const remaining = charBudget - total;
      if (remaining > 200) {
        result.push(chunk.content.slice(0, remaining));
      }
      break;
    }
    result.push(chunk.content);
    total += chunk.content.length;
  }

  return result.join('\n\n---\n\n');
}

// ── Raw extraction response shape ─────────────────────────────────────────────

type RawCharacterEntry = {
  character_id?: unknown;
  name?: unknown;
  pronouns?: unknown;
  narrative_weight_band?: unknown;
  arc_movement?: unknown;
  arc_classification?: unknown;
  ending_status?: unknown;
  relational_engines?: unknown;
  evidence_snippets?: unknown;
};

type RawRelationalEngine = {
  engine_id?: unknown;
  label?: unknown;
  character_ids?: unknown;
  weight?: unknown;
};

type RawExtractionResponse = {
  characters?: unknown;
  relational_engines?: unknown;
};

// ── Validation helpers ────────────────────────────────────────────────────────

const VALID_WEIGHT_BANDS = new Set(['primary', 'major', 'supporting', 'recurring', 'minor']);
const VALID_ENDING_STATUS = new Set(['resolved', 'open', 'absent', 'ambiguous']);
const VALID_ENGINE_WEIGHT = new Set(['dominant', 'significant', 'contextual']);
const VALID_ARC_CLASSIFICATIONS = new Set([
  'redemptive', 'tragic', 'coming_of_age', 'static',
  'transformative', 'sacrificial', 'cyclical',
]);

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function validateAndNormalizeCharacter(raw: RawCharacterEntry): CharacterArcEntry | null {
  if (typeof raw.character_id !== 'string' || !raw.character_id) return null;
  if (typeof raw.name !== 'string' || !raw.name) return null;
  if (!VALID_WEIGHT_BANDS.has(raw.narrative_weight_band as string)) return null;
  if (!VALID_ENDING_STATUS.has(raw.ending_status as string)) return null;

  const arcMovement = raw.arc_movement && typeof raw.arc_movement === 'object'
    ? {
        start: typeof (raw.arc_movement as Record<string, unknown>).start === 'string'
          ? (raw.arc_movement as Record<string, unknown>).start as string
          : null,
        pressure: typeof (raw.arc_movement as Record<string, unknown>).pressure === 'string'
          ? (raw.arc_movement as Record<string, unknown>).pressure as string
          : null,
        turn: typeof (raw.arc_movement as Record<string, unknown>).turn === 'string'
          ? (raw.arc_movement as Record<string, unknown>).turn as string
          : null,
        end: typeof (raw.arc_movement as Record<string, unknown>).end === 'string'
          ? (raw.arc_movement as Record<string, unknown>).end as string
          : null,
      }
    : null;

  const arcClassification = VALID_ARC_CLASSIFICATIONS.has(raw.arc_classification as string)
    ? (raw.arc_classification as string)
    : null;

  return {
    character_id: raw.character_id,
    name: raw.name,
    pronouns: isStringArray(raw.pronouns) ? raw.pronouns : [],
    narrative_weight_band: raw.narrative_weight_band as CharacterArcEntry['narrative_weight_band'],
    arc_movement: arcMovement,
    arc_classification: arcClassification,
    ending_status: raw.ending_status as CharacterArcEntry['ending_status'],
    report_acknowledgement_status: 'omitted', // Set by gate in PR-581 after report render
    relational_engines: isStringArray(raw.relational_engines) ? raw.relational_engines : [],
    evidence_snippets: isStringArray(raw.evidence_snippets)
      ? raw.evidence_snippets.slice(0, 5).map((s) => s.slice(0, 300))
      : [],
  };
}

function validateAndNormalizeEngine(raw: RawRelationalEngine): RelationalEngine | null {
  if (typeof raw.engine_id !== 'string' || !raw.engine_id) return null;
  if (typeof raw.label !== 'string' || !raw.label) return null;
  if (!isStringArray(raw.character_ids) || raw.character_ids.length < 2) return null;
  if (!VALID_ENGINE_WEIGHT.has(raw.weight as string)) return null;

  return {
    engine_id: raw.engine_id,
    label: raw.label,
    character_ids: raw.character_ids,
    weight: raw.weight as RelationalEngine['weight'],
    report_coverage: 'omitted', // Set by gate in PR-581 after report render
  };
}

// ── Gate logic (preliminary — PR-581 runs the full gate post-render) ──────────

/**
 * Run a preliminary gate check on the extracted ledger.
 * This fires BEFORE the report is rendered — catches extraction-level failures.
 * The full post-render gate (checking report_acknowledgement_status) runs in PR-581.
 */
function runPreliminaryGate(
  characters: CharacterArcEntry[],
  relationalEngines: RelationalEngine[],
): {
  gate_result: ArcGateVerdict;
  hard_fail_reasons: HardFailReason[];
  soft_fail_reasons: SoftFailReason[];
} {
  const hardFails: HardFailReason[] = [];
  const softFails: SoftFailReason[] = [];

  const primaryChars = characters.filter((c) => c.narrative_weight_band === 'primary');
  const majorChars = characters.filter((c) => c.narrative_weight_band === 'major');

  // Hard fail: no protagonist found at all
  if (primaryChars.length === 0) {
    hardFails.push('PROTAGONIST_MISSING_FROM_LEDGER');
  }

  // Hard fail: major character with no arc state
  for (const char of [...primaryChars, ...majorChars]) {
    if (!char.arc_movement) {
      hardFails.push('MAJOR_CHARACTER_NO_ARC_STATE');
      break;
    }
  }

  // Hard fail: major character with absent ending
  for (const char of [...primaryChars, ...majorChars]) {
    if (char.ending_status === 'absent') {
      hardFails.push('MAJOR_CHARACTER_NO_ENDING_ACCOUNTABILITY');
      break;
    }
  }

  // Soft fail: major character with vague arc classification
  for (const char of [...primaryChars, ...majorChars]) {
    if (!char.arc_classification) {
      softFails.push('MAJOR_CHARACTER_PRESENT_BUT_UNDERWEIGHTED');
      break;
    }
  }

  // Soft fail: dominant relational engine with no characters
  for (const engine of relationalEngines) {
    if (engine.weight === 'dominant' && engine.character_ids.length < 2) {
      softFails.push('DOMINANT_RELATIONAL_ENGINE_UNDERWEIGHTED');
      break;
    }
  }

  const gate_result: ArcGateVerdict =
    hardFails.length > 0 ? 'hard_fail' :
    softFails.length > 0 ? 'soft_fail' :
    'pass';

  return { gate_result, hard_fail_reasons: hardFails, soft_fail_reasons: softFails };
}

// ── Main extraction function ──────────────────────────────────────────────────

export type ArcExtractionInput = {
  jobId: string;
  manuscriptId: number;
  title: string;
  wordCount: number;
  chunks: ManuscriptChunkEvidence[];
  /** Override model — falls back to getCanonicalPass3Model() */
  model?: string;
  /** Override API key — falls back to runtime config */
  openaiApiKey?: string;
};

export type ArcExtractionSuccess = { ok: true; ledger: CharacterArcLedger };
export type ArcExtractionFailure = { ok: false; error: string; retryable: boolean };
export type ArcExtractionResult = ArcExtractionSuccess | ArcExtractionFailure;

/**
 * Extract character arc ledger from manuscript chunks.
 *
 * Uses a single focused LLM pass with structured JSON output.
 * Temperature: 0.1 — extraction task, not generative.
 *
 * Returns a CharacterArcLedger with preliminary gate verdict.
 * Full post-render gate (report_acknowledgement_status) runs in PR-581.
 */
export async function runCharacterArcExtraction(
  input: ArcExtractionInput,
): Promise<ArcExtractionResult> {
  const { jobId, manuscriptId, title, wordCount, chunks, model, openaiApiKey } = input;

  const apiKey = openaiApiKey ?? getEvaluationRuntimeConfig().openaiApiKey;
  if (!apiKey) {
    return { ok: false, error: '[ArcExtraction] OPENAI_API_KEY not configured', retryable: false };
  }

  if (chunks.length === 0) {
    return { ok: false, error: `[ArcExtraction] No chunks for manuscript_id=${manuscriptId}`, retryable: false };
  }

  const selectedModel = getCanonicalPass3Model(model);
  const manuscriptSample = sampleManuscriptChunks(chunks, SAMPLE_CHAR_BUDGET);

  const userPrompt = buildCharacterArcUserPrompt({
    title,
    wordCount,
    manuscriptSample,
    chunkCount: chunks.length,
  });

  console.log(
    `[ArcExtraction] ${jobId}: starting — model=${selectedModel} chunks=${chunks.length} sampleChars=${manuscriptSample.length}`,
  );

  let raw: string;
  try {
    const openai = new OpenAI({
      apiKey,
      maxRetries: 1, // Single retry — this is a background worker, not user-facing
      timeout: ARC_EXTRACTION_TIMEOUT_MS,
    });

    const completion = await openai.chat.completions.create(
      {
        model: selectedModel,
        messages: [
          { role: 'system', content: CHARACTER_ARC_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: ARC_EXTRACTION_TEMPERATURE,
        max_tokens: ARC_EXTRACTION_MAX_TOKENS,
        response_format: { type: 'json_object' },
      },
      { timeout: ARC_EXTRACTION_TIMEOUT_MS },
    );

    const choice = completion.choices?.[0];
    if (!choice?.message?.content) {
      return {
        ok: false,
        error: `[ArcExtraction] Empty response from OpenAI (finish_reason=${choice?.finish_reason})`,
        retryable: true,
      };
    }

    raw = choice.message.content;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isRetryable = msg.includes('timeout') || msg.includes('rate') || msg.includes('503') || msg.includes('502');
    return { ok: false, error: `[ArcExtraction] OpenAI call failed: ${msg}`, retryable: isRetryable };
  }

  // Parse and validate
  let parsed: RawExtractionResponse;
  try {
    const boundary = parseJsonObjectBoundary<RawExtractionResponse>(raw, {
      label: 'ArcExtraction',
    });
    parsed = boundary.value;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `[ArcExtraction] JSON parse failed: ${msg}`, retryable: true };
  }

  // Validate characters
  const rawChars = Array.isArray(parsed.characters) ? parsed.characters as RawCharacterEntry[] : [];
  const characters: CharacterArcEntry[] = rawChars
    .map(validateAndNormalizeCharacter)
    .filter((c): c is CharacterArcEntry => c !== null);

  if (characters.length === 0) {
    return {
      ok: false,
      error: '[ArcExtraction] No valid characters extracted — response may be malformed',
      retryable: true,
    };
  }

  // Validate relational engines
  const rawEngines = Array.isArray(parsed.relational_engines)
    ? parsed.relational_engines as RawRelationalEngine[]
    : [];
  const relationalEngines: RelationalEngine[] = rawEngines
    .map(validateAndNormalizeEngine)
    .filter((e): e is RelationalEngine => e !== null);

  // Run preliminary gate
  const { gate_result, hard_fail_reasons, soft_fail_reasons } = runPreliminaryGate(
    characters,
    relationalEngines,
  );

  const ledger: CharacterArcLedger = {
    schema_version: 'character_arc_ledger_v1',
    job_id: jobId,
    manuscript_id: manuscriptId,
    captured_at: new Date().toISOString(),
    characters,
    relational_engines: relationalEngines,
    gate_result,
    hard_fail_reasons,
    soft_fail_reasons,
    report_rerendered: null,
  };

  console.log(
    `[ArcExtraction] ${jobId}: complete — characters=${characters.length} engines=${relationalEngines.length} gate=${gate_result}`,
  );

  return { ok: true, ledger };
}
