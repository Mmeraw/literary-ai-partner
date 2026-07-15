/**
 * Bounded required-prose regeneration for author-facing integrity failures.
 *
 * After Tier-1 normalization (whitespace, duplicate words, safe punctuation),
 * whole-envelope validation may still report required prose that is truncated,
 * ellipsized, or otherwise incomplete. This module regenerates ONLY the requested
 * fields via targeted LLM calls, never by appending punctuation, copying another
 * output field, or deleting a required field.
 *
 * The mutation boundary `assertOnlyRequestedPathsChanged` is enforced after
 * every regeneration pass.
 */

import OpenAI from 'openai';
import { getEvalOpenAiTimeoutMs } from '@/lib/evaluation/config';
import {
  buildOpenAIOutputTokenParam,
  buildOpenAITemperatureParam,
  getCanonicalPass3Model,
} from '@/lib/evaluation/policy';
import type { AuthorFacingIntegrityViolation } from '@/lib/text/authorFacingIntegrity';
import { isCompleteAuthorFacingSentence } from '@/lib/text/authorFacingProse';
import type { SynthesisOutput } from './types';
import type { Pass3PreflightDraft } from './types';

export class RegenerationMutationError extends Error {
  readonly code = 'REGENERATION_MUTATION_ERROR';
  constructor(readonly unexpectedPaths: string[]) {
    super(
      `Regeneration mutated paths that were not requested: ${unexpectedPaths.join(', ')}`,
    );
    this.name = 'RegenerationMutationError';
  }
}

export interface RequiredProseRegenerationOptions {
  /** OpenAI API key. Falls back to process.env.OPENAI_API_KEY. */
  openaiApiKey?: string;
  /** Model override. Defaults to the Pass 3 canonical model. */
  model?: string;
  /** Pass 3A preflight draft — used only as optional context, never copied. */
  pass3PreflightDraft?: Pass3PreflightDraft | null;
  /** Original manuscript text for grounding. */
  manuscriptText?: string;
  /** Manuscript title for grounding. */
  title?: string;
}

export interface RequiredProseRegenerationTelemetry {
  attempts: number;
  regeneratedFields: string[];
  failedFields: string[];
  model: string;
  tokenUsage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export interface RequiredProseRegenerationResult {
  /** True when every requested violation was successfully regenerated. */
  ok: boolean;
  /** The (mutated) synthesis. */
  synthesis: SynthesisOutput;
  /** Fields that were regenerated and passed a local completeness check. */
  regeneratedFields: string[];
  /** Fields that could not be regenerated. */
  failedFields: string[];
  /** Telemetry for observability. */
  telemetry: RequiredProseRegenerationTelemetry;
}

const REQUIRED_DERIVED_FIELDS = new Set(['fit_summary', 'gap_summary']);
const REQUIRED_CANONICAL_FIELDS = new Set([
  'rationale',
  'final_rationale',
  'one_paragraph_summary',
  'one_sentence_pitch',
  'one_paragraph_pitch',
]);

function getLeafKey(path: string): string {
  // e.g. evaluation_result_v2.criteria[3].recommendations[0].action -> action
  return path.replace(/\[\d+\]/g, '').split('.').pop() ?? path;
}

function stripRootPath(path: string): string {
  return path.replace(/^evaluation_result_v2\./u, '');
}

function classifyViolation(path: string): 'derived' | 'canonical' | 'other' {
  const key = getLeafKey(path);
  if (REQUIRED_DERIVED_FIELDS.has(key)) return 'derived';
  if (REQUIRED_CANONICAL_FIELDS.has(key)) return 'canonical';
  return 'other';
}

function getByPath(obj: unknown, path: string): unknown {
  const parts = stripRootPath(path).split('.');
  let current: unknown = obj;
  for (const part of parts) {
    const arrayMatch = part.match(/^([^\[]+)\[(\d+)\]$/u);
    if (arrayMatch) {
      const key = arrayMatch[1]!;
      const index = parseInt(arrayMatch[2]!, 10);
      const arr = (current as Record<string, unknown> | undefined)?.[key];
      if (!Array.isArray(arr) || index >= arr.length) return undefined;
      current = arr[index];
    } else {
      current = (current as Record<string, unknown> | undefined)?.[part];
    }
    if (current === undefined || current === null) return undefined;
  }
  return current;
}

function setByPath(obj: unknown, path: string, value: unknown): boolean {
  const parts = stripRootPath(path).split('.');
  if (parts.length === 0) return false;
  let current: unknown = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    const arrayMatch = part.match(/^([^\[]+)\[(\d+)\]$/u);
    if (arrayMatch) {
      const key = arrayMatch[1]!;
      const index = parseInt(arrayMatch[2]!, 10);
      const arr = (current as Record<string, unknown> | undefined)?.[key];
      if (!Array.isArray(arr) || index >= arr.length) return false;
      current = arr[index];
    } else {
      current = (current as Record<string, unknown> | undefined)?.[part];
    }
    if (current === undefined || current === null) return false;
  }
  const last = parts[parts.length - 1]!;
  const lastArrayMatch = last.match(/^([^\[]+)\[(\d+)\]$/u);
  if (lastArrayMatch) {
    const key = lastArrayMatch[1]!;
    const index = parseInt(lastArrayMatch[2]!, 10);
    const arr = (current as Record<string, unknown> | undefined)?.[key];
    if (!Array.isArray(arr) || index >= arr.length) return false;
    arr[index] = value;
  } else {
    (current as Record<string, unknown>)[last] = value;
  }
  return true;
}

function getCriterionIndex(path: string): number | null {
  const match = path.match(/criteria\[(\d+)\]/u);
  if (!match) return null;
  return parseInt(match[1]!, 10);
}

function getRecommendationIndex(path: string): number | null {
  const match = path.match(/recommendations\[(\d+)\]/u);
  if (!match) return null;
  return parseInt(match[1]!, 10);
}



function safeStringify(value: unknown): string {
  if (value === undefined) return 'undefined';
  return JSON.stringify(value);
}

function truncateString(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max) + '…';
}

function compactCriterionContext(criterion: SynthesisOutput['criteria'][number]): unknown {
  const evidenceAnchors = (criterion.evidence ?? [])
    .slice(0, 4)
    .map((e, idx) => ({
      id: idx + 1,
      snippet: truncateString(String(e?.snippet ?? ''), 220),
      char_start: e?.char_start,
      char_end: e?.char_end,
    }));

  return {
    id: criterion.key,
    name: criterion.key,
    score: criterion.final_score_0_10,
    confidence: criterion.confidence_level ?? 'moderate',
    evidence_anchors: evidenceAnchors,
    pass1_findings: evidenceAnchors,
    pass2_findings: evidenceAnchors,
    existing_recommendations: (criterion.recommendations ?? [])
      .slice(0, 3)
      .map((r) => ({
        priority: r.priority,
        action: truncateString(String(r.action ?? ''), 160),
        expected_impact: truncateString(String(r.expected_impact ?? ''), 160),
        specific_fix: truncateString(String(r.specific_fix ?? ''), 160),
        reader_effect: truncateString(String(r.reader_effect ?? ''), 160),
        symptom: truncateString(String(r.symptom ?? ''), 160),
        cause: truncateString(String(r.cause ?? ''), 160),
        fix_direction: truncateString(String(r.fix_direction ?? ''), 160),
      })),
  };
}

function buildFieldPrompt(
  synthesis: SynthesisOutput,
  path: string,
  violation: AuthorFacingIntegrityViolation,
): string | null {
  const key = getLeafKey(path);
  const currentValue = getByPath(synthesis, path);
  const ci = getCriterionIndex(path);

  let payload: Record<string, unknown>;

  if (ci !== null) {
    const criterion = synthesis.criteria[ci];
    if (!criterion) return null;

    const ri = getRecommendationIndex(path);
    if (ri !== null) {
      const rec = criterion.recommendations?.[ri];
      if (!rec) return null;
      payload = {
        path,
        current_value: currentValue,
        violation_codes: [violation.code],
        criterion: compactCriterionContext(criterion),
        recommendation: {
          index: ri,
          priority: rec.priority,
          action: truncateString(String(rec.action ?? ''), 160),
          expected_impact: truncateString(String(rec.expected_impact ?? ''), 160),
          mechanism: truncateString(String(rec.mechanism ?? ''), 160),
          specific_fix: truncateString(String(rec.specific_fix ?? ''), 160),
          reader_effect: truncateString(String(rec.reader_effect ?? ''), 160),
          symptom: truncateString(String(rec.symptom ?? ''), 160),
          cause: truncateString(String(rec.cause ?? ''), 160),
          fix_direction: truncateString(String(rec.fix_direction ?? ''), 160),
          mistake_proofing: truncateString(String(rec.mistake_proofing ?? ''), 160),
        },
        constraints: {
          preserve_score: true,
          preserve_evidence: true,
          preserve_recommendations: true,
          return_only_requested_field: true,
        },
      };
    } else {
      payload = {
        path,
        current_value: currentValue,
        violation_codes: [violation.code],
        criterion: compactCriterionContext(criterion),
        constraints: {
          preserve_score: true,
          preserve_evidence: true,
          preserve_recommendations: true,
          return_only_requested_field: true,
        },
      };
    }
  } else {
    payload = {
      path,
      current_value: currentValue,
      violation_codes: [violation.code],
      overview: {
        overall_score_0_100: synthesis.overall.overall_score_0_100,
        verdict: synthesis.overall.verdict,
        top_3_strengths: synthesis.overall.top_3_strengths,
        top_3_risks: synthesis.overall.top_3_risks,
      },
      criteria_summary: synthesis.criteria.map((c) => ({
        key: c.key,
        final_score_0_10: c.final_score_0_10,
        fit_summary: truncateString(String(c.fit_summary ?? ''), 120),
        gap_summary: truncateString(String(c.gap_summary ?? ''), 120),
      })),
      constraints: {
        preserve_score: true,
        preserve_evidence: true,
        preserve_recommendations: true,
        return_only_requested_field: true,
      },
    };
  }

  const isFitGap = REQUIRED_DERIVED_FIELDS.has(key);
  const isOverview = !path.includes('criteria[');
  const instructions = isFitGap
    ? [
        'The value must be 2–3 complete sentences of publication-ready editorial prose.',
        'fit_summary = what earns the score; gap_summary = what prevents a 10.',
      ]
    : isOverview
    ? [
        'The value must be complete, publication-ready editorial prose.',
        'Respect the existing field contract: one_paragraph_summary may be multi-paragraph; one_sentence_pitch must be exactly one sentence; one_paragraph_pitch must be one paragraph.',
      ]
    : [
        'The value must be a complete, publication-ready sentence or short paragraph.',
      ];

  return [
    'Regenerate one required author-facing prose field for a literary-manuscript evaluation report.',
    'Return ONLY a JSON object with the requested field path as the single top-level key.',
    '',
    'PAYLOAD:',
    JSON.stringify(payload, null, 2),
    '',
    'OUTPUT RULES:',
    ...instructions,
    '- Start with a capital letter (after any leading quote if present).',
    '- End with . ! or ? (optionally followed by a closing quote).',
    '- No ellipsis (... or …).',
    '- No mid-sentence cut-off.',
    '- Ground every claim in the provided evidence anchors.',
    '- Do not include markdown, bullets, numbering, or commentary.',
    '- Do not alter the score, evidence, recommendations, or any other field.',
  ].join('\n');
}

async function callRegenerationLLM(
  openai: OpenAI,
  model: string,
  prompt: string,
  fieldPath: string,
): Promise<string | null> {
  const maxTokens =
    fieldPath.includes('one_paragraph_summary') || fieldPath.includes('one_paragraph_pitch')
      ? 1400
      : fieldPath.includes('final_rationale') || fieldPath.includes('rationale')
      ? 900
      : 500;

  const response = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content:
          'You are a senior developmental editor regenerating a single required field for a manuscript evaluation report. ' +
          'Return ONLY a JSON object with one key: the exact FIELD PATH the user provides. ' +
          'The value must be complete, publication-ready prose: capitalized first letter, terminal punctuation, no ellipses, no mid-sentence cuts.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    ...buildOpenAITemperatureParam(model, 0.3),
    ...buildOpenAIOutputTokenParam(model, maxTokens),
  });

  const raw = response.choices[0]?.message?.content?.trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const value = parsed[fieldPath];
    if (typeof value === 'string') return value.trim();
    // Some models return the leaf key instead of the full path.
    const leaf = getLeafKey(fieldPath);
    const leafValue = parsed[leaf];
    if (typeof leafValue === 'string') return leafValue.trim();
  } catch {
    // ignore
  }
  return null;
}

function normalizePath(path: string): string {
  // Remove the root prefix that the integrity inspector uses and any leading
  // 'synthesis.' artifact from the mutation collector.
  return path.replace(/^evaluation_result_v2\./u, '').replace(/^synthesis\./u, '');
}

function isDescendantOf(changedPath: string, requestedPath: string): boolean {
  const changed = normalizePath(changedPath);
  const requested = normalizePath(requestedPath);
  if (changed === requested) return true;
  return (
    changed.startsWith(`${requested}.`) ||
    changed.startsWith(`${requested}[`)
  );
}

function collectLeafDiffPaths(
  before: unknown,
  after: unknown,
  prefix: string,
  into: string[],
  visited: WeakSet<object> = new WeakSet(),
): void {
  const beforeType = before === null || before === undefined ? 'null' : typeof before;
  const afterType = after === null || after === undefined ? 'null' : typeof after;

  if (beforeType !== afterType) {
    into.push(prefix);
    return;
  }

  if (before === null || before === undefined) return;
  if (typeof before === 'string') {
    if (before !== (after as string)) into.push(prefix);
    return;
  }
  if (typeof before !== 'object') {
    if (before !== after) into.push(prefix);
    return;
  }

  if (visited.has(before as object) || visited.has(after as object)) return;
  if (typeof before === 'object') visited.add(before as object);
  if (typeof after === 'object') visited.add(after as object);

  if (Array.isArray(before) !== Array.isArray(after)) {
    into.push(prefix);
    return;
  }

  if (Array.isArray(before)) {
    const len = Math.max(before.length, (after as unknown[]).length);
    for (let i = 0; i < len; i++) {
      collectLeafDiffPaths(
        before[i],
        (after as unknown[])[i],
        `${prefix}[${i}]`,
        into,
        visited,
      );
    }
    return;
  }

  const beforeRecord = before as Record<string, unknown>;
  const afterRecord = after as Record<string, unknown>;
  const keys = new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)]);
  for (const k of keys) {
    collectLeafDiffPaths(beforeRecord[k], afterRecord[k], `${prefix}.${k}`, into, visited);
  }
}

export function assertOnlyRequestedPathsChanged(
  before: unknown,
  after: unknown,
  requestedPaths: string[],
): string[] {
  const changed: string[] = [];
  collectLeafDiffPaths(before, after, 'synthesis', changed);

  return changed.filter((changedPath) => {
    return !requestedPaths.some((requested) =>
      normalizePath(changedPath) === normalizePath(requested) ||
      isDescendantOf(changedPath, requested),
    );
  });
}

export function assertRequestedPathsChangedOrWereValid(
  before: unknown,
  after: unknown,
  requestedPaths: string[],
): string[] {
  const unchanged: string[] = [];
  for (const path of requestedPaths) {
    const beforeVal = getByPath(before, path);
    const afterVal = getByPath(after, path);
    if (beforeVal === afterVal) {
      // Model returned exactly the same value and therefore did not regenerate.
      unchanged.push(path);
    } else if (typeof afterVal === 'string' && !isCompleteAuthorFacingSentence(afterVal)) {
      // Model returned a value that still fails the local completeness check.
      unchanged.push(path);
    }
  }
  return unchanged;
}

export async function regenerateRequiredProse(
  synthesis: SynthesisOutput,
  violations: AuthorFacingIntegrityViolation[],
  options: RequiredProseRegenerationOptions = {},
): Promise<RequiredProseRegenerationResult> {
  const apiKey =
    (options.openaiApiKey?.trim() || process.env.OPENAI_API_KEY)?.trim() || '';
  const model = options.model?.trim() || getCanonicalPass3Model();

  if (!apiKey) {
    return {
      ok: false,
      synthesis,
      regeneratedFields: [],
      failedFields: violations.map((v) => v.path),
      telemetry: {
        attempts: 0,
        regeneratedFields: [],
        failedFields: violations.map((v) => v.path),
        model,
      },
    };
  }

  const openai = new OpenAI({
    apiKey,
    timeout: getEvalOpenAiTimeoutMs(),
    maxRetries: 2,
  });

  // Target only required fields. Candidate fields are repaired/quarantined elsewhere.
  const requiredViolations = violations.filter((v) => {
    const type = classifyViolation(v.path);
    // recommendation quick_wins / strategic_revisions action/expected_impact render
    // to the author, so treat them as required canonical prose here.
    return type === 'derived' || type === 'canonical' || type === 'other';
  });

  const seen = new Set<string>();
  const unique: AuthorFacingIntegrityViolation[] = [];
  for (const v of requiredViolations) {
    if (seen.has(v.path)) continue;
    seen.add(v.path);
    unique.push(v);
  }

  const beforeSnapshot: SynthesisOutput = JSON.parse(JSON.stringify(synthesis));
  const requestedPaths = unique.map((v) => v.path);

  const regeneratedFields: string[] = [];
  const failedFields: string[] = [];
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

  for (const violation of unique) {
    const prompt = buildFieldPrompt(synthesis, violation.path, violation);
    if (!prompt) {
      failedFields.push(violation.path);
      continue;
    }

    const generated = await callRegenerationLLM(openai, model, prompt, violation.path);

    if (generated && isCompleteAuthorFacingSentence(generated)) {
      const ok = setByPath(synthesis, violation.path, generated);
      if (ok) {
        regeneratedFields.push(violation.path);
      } else {
        failedFields.push(violation.path);
      }
    } else {
      failedFields.push(violation.path);
    }
  }

  // Mutation boundary: ensure the LLM changed only the requested paths.
  const unexpectedChanges = assertOnlyRequestedPathsChanged(
    beforeSnapshot,
    synthesis,
    requestedPaths,
  );
  if (unexpectedChanges.length > 0) {
    // Revert synthesis to the snapshot and report failure for the requested paths.
    Object.assign(synthesis, beforeSnapshot);
    return {
      ok: false,
      synthesis,
      regeneratedFields: [],
      failedFields: requestedPaths,
      telemetry: {
        attempts: regeneratedFields.length + failedFields.length,
        regeneratedFields: [],
        failedFields: requestedPaths,
        model,
        tokenUsage: {
          prompt_tokens: totalPromptTokens,
          completion_tokens: totalCompletionTokens,
          total_tokens: totalPromptTokens + totalCompletionTokens,
        },
      },
    };
  }

  // Ensure the model actually regenerated each requested field (or produced valid prose).
  const unchangedOrInvalid = assertRequestedPathsChangedOrWereValid(
    beforeSnapshot,
    synthesis,
    requestedPaths,
  );
  for (const path of unchangedOrInvalid) {
    if (!failedFields.includes(path)) failedFields.push(path);
    const idx = regeneratedFields.indexOf(path);
    if (idx !== -1) regeneratedFields.splice(idx, 1);
  }

  return {
    ok: failedFields.length === 0 && regeneratedFields.length > 0,
    synthesis,
    regeneratedFields,
    failedFields,
    telemetry: {
      attempts: regeneratedFields.length + failedFields.length,
      regeneratedFields,
      failedFields,
      model,
      tokenUsage: {
        prompt_tokens: totalPromptTokens,
        completion_tokens: totalCompletionTokens,
        total_tokens: totalPromptTokens + totalCompletionTokens,
      },
    },
  };
}
