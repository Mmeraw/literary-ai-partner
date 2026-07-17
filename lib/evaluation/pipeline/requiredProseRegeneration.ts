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
import {
  inspectAuthorFacingIntegrity,
  type AuthorFacingIntegrityViolation,
} from '@/lib/text/authorFacingIntegrity';
import { isCompleteAuthorFacingSentence } from '@/lib/text/authorFacingProse';
import { isCandidateTextViolationPath } from './candidateIntegrityRepair';
import type {
  Pass3PreflightDraft,
  SinglePassOutput,
  SynthesisOutput,
} from './types';

export class RegenerationMutationError extends Error {
  readonly code = 'REGENERATION_MUTATION_ERROR';
  constructor(readonly unexpectedPaths: string[]) {
    super(
      `Regeneration mutated paths that were not requested: ${unexpectedPaths.join(', ')}`,
    );
    this.name = 'RegenerationMutationError';
  }
}

export class RepairRegenerationError extends Error {
  readonly code = 'REPAIR_REGENERATION_ERROR';
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'RepairRegenerationError';
  }
}

export interface RequiredProseRegenerationOptions {
  /** OpenAI API key. Falls back to process.env.OPENAI_API_KEY. */
  openaiApiKey?: string;
  /** Model override. Defaults to the Pass 3 canonical model. */
  model?: string;
  /** Pass 3A preflight draft — used only as optional synthesis context. */
  pass3PreflightDraft?: Pass3PreflightDraft | null;
  /** Authoritative Pass 1 craft output for provenanced context. */
  pass1Output?: SinglePassOutput | null;
  /** Authoritative Pass 2 editorial output for provenanced context. */
  pass2Output?: SinglePassOutput | null;
  /** Original manuscript text for grounding. */
  manuscriptText?: string;
  /** Manuscript title for grounding. */
  title?: string;
  /**
   * Maximum regeneration attempts. Used by regenerateCandidateProse;
   * regenerateRequiredProse relies on the caller's loop.
   */
  maxAttempts?: number;
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
  /** Paths the LLM attempted to mutate that were not in the requested set. */
  mutationBoundaryViolations: string[];
  /** Telemetry for observability. */
  telemetry: RequiredProseRegenerationTelemetry;
}

const REQUIRED_DERIVED_FIELDS = new Set(['fit_summary', 'gap_summary']);

function getLeafKey(path: string): string {
  // e.g. evaluation_result_v2.criteria[3].recommendations[0].action -> action
  return path.replace(/\[\d+\]/g, '').split('.').pop() ?? path;
}

function cloneSnapshot<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneSnapshot(item)) as unknown as T;
  }

  if (value !== null && typeof value === 'object') {
    const output: Record<string, unknown> = {};

    for (const key of Object.keys(value)) {
      output[key] = cloneSnapshot(
        (value as Record<string, unknown>)[key],
      );
    }

    return output as T;
  }

  return value;
}

/**
 * Fully restore a mutable object from a deep-cloned snapshot.
 * This removes any top-level additions and replaces nested state exactly,
 * preserving optional keys whose value is undefined.
 */
function restoreFromSnapshot<T extends Record<string, unknown>>(
  target: T,
  snapshot: T,
): void {
  for (const key of Object.keys(target)) {
    delete target[key];
  }
  Object.assign(target, cloneSnapshot(snapshot));
}

/**
 * Canonicalize path notation for object access: dot- and bracket-indexed
 * arrays both resolve to bracket form, and root prefixes are removed.
 *
 *   criteria.4.fit_summary       -> criteria[4].fit_summary
 *   evaluation_result_v2.criteria[4].fit_summary -> criteria[4].fit_summary
 */
function canonicalAccessPath(path: string): string {
  return path
    .replace(/^evaluation_result_v2\./u, '')
    .replace(/^synthesis\./u, '')
    .replace(/\.(\d+)(?=\.|$|\[)/gu, '[$1]');
}

/**
 * Normalize path notation for mutation-boundary comparison: bracket and dot
 * array indices both collapse to dot form, root prefixes are removed, and
 * leading/multiple dots are cleaned. Used only for diff-path comparison.
 *
 *   criteria[4].fit_summary       -> criteria.4.fit_summary
 *   evaluation_result_v2.criteria.4.fit_summary -> criteria.4.fit_summary
 */
function normalizeDiffPath(path: string): string {
  return path
    .replace(/^evaluation_result_v2\./u, '')
    .replace(/^synthesis\./u, '')
    .replace(/\[(\d+)\]/gu, '.$1')
    .replace(/^\./u, '')
    .replace(/\.{2,}/gu, '.');
}

function isRequestedChange(changedPath: string, requestedPath: string): boolean {
  const changed = normalizeDiffPath(changedPath);
  const requested = normalizeDiffPath(requestedPath);
  return changed === requested || changed.startsWith(`${requested}.`);
}

function getByPath(obj: unknown, path: string): unknown {
  const parts = canonicalAccessPath(path).split('.');
  let current: unknown = obj;
  for (const part of parts) {
    const arrayMatch = part.match(/^([^[]+)\[(\d+)\]$/u);
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
  const parts = canonicalAccessPath(path).split('.');
  if (parts.length === 0) return false;
  let current: unknown = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    const arrayMatch = part.match(/^([^[]+)\[(\d+)\]$/u);
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
  const lastArrayMatch = last.match(/^([^[]+)\[(\d+)\]$/u);
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



/**
 * Clip context to a rough byte budget without adding an ellipsis. The result is
 * marked as an internal excerpt so the model does not treat the clipping as
 * author-facing prose to emulate.
 */
function clipContextExcerpt(value: string, max: number): string {
  if (value.length <= max) return value;
  const suffix = ' [excerpt]';
  const budget = Math.max(0, max - suffix.length);
  const boundary = value.lastIndexOf(' ', budget);
  const end = boundary > 0 ? boundary : budget;
  return value.slice(0, end) + suffix;
}

function collectPassFindings(
  passOutput: SinglePassOutput | null | undefined,
  criterionKey: string,
): string[] {
  const c = passOutput?.criteria.find((x) => x.key === criterionKey);
  if (!c) return [];
  const findings = [c.rationale];
  for (const rec of c.recommendations ?? []) {
    if (rec.action) findings.push(rec.action);
  }
  return findings.filter((f): f is string => f.trim().length > 0);
}

function compactCriterionContext(
  criterion: SynthesisOutput['criteria'][number],
  pass3PreflightDraft?: Pass3PreflightDraft | null,
  pass1Output?: SinglePassOutput | null,
  pass2Output?: SinglePassOutput | null,
): unknown {
  const evidenceAnchors = (criterion.evidence ?? [])
    .slice(0, 4)
    .map((e, idx) => ({
      id: idx + 1,
      snippet: clipContextExcerpt(String(e?.snippet ?? ''), 220),
      char_start: e?.char_start,
      char_end: e?.char_end,
    }));

  // Pass 3A preflight may include synthesized strength/weakness findings, but
  // they are *not* provenanced as Pass 1 craft vs Pass 2 editorial unless the
  // upstream contract explicitly carries that mapping. Be honest in the prompt:
  // label them as preflight findings, not as pass1_findings / pass2_findings.
  const draft = pass3PreflightDraft?.criterionDrafts?.find(
    (d) => d.criterion === criterion.key,
  );
  const preflightStrengthFindings = draft?.strengthFindings ?? [];
  const preflightWeaknessFindings = draft?.weaknessFindings ?? [];

  return {
    id: criterion.key,
    name: criterion.key,
    score: criterion.final_score_0_10,
    confidence: criterion.confidence_level ?? 'moderate',
    evidence_anchors: evidenceAnchors,
    // Provenanced Pass 1 craft findings and Pass 2 editorial findings. Fall back
    // to empty arrays when the authoritative SinglePassOutput is unavailable.
    pass1_findings: collectPassFindings(pass1Output, criterion.key),
    pass2_findings: collectPassFindings(pass2Output, criterion.key),
    preflight_strength_findings: preflightStrengthFindings,
    preflight_weakness_findings: preflightWeaknessFindings,
    existing_recommendations: (criterion.recommendations ?? [])
      .slice(0, 3)
      .map((r) => ({
        priority: r.priority,
        action: clipContextExcerpt(String(r.action ?? ''), 160),
        expected_impact: clipContextExcerpt(String(r.expected_impact ?? ''), 160),
        specific_fix: clipContextExcerpt(String(r.specific_fix ?? ''), 160),
        reader_effect: clipContextExcerpt(String(r.reader_effect ?? ''), 160),
        symptom: clipContextExcerpt(String(r.symptom ?? ''), 160),
        cause: clipContextExcerpt(String(r.cause ?? ''), 160),
        fix_direction: clipContextExcerpt(String(r.fix_direction ?? ''), 160),
      })),
  };
}

function getCandidateVariant(key: string): 'A' | 'B' | 'C' | null {
  if (key === 'candidate_text_a') return 'A';
  if (key === 'candidate_text_b') return 'B';
  if (key === 'candidate_text_c') return 'C';
  return null;
}

function buildFieldPrompt(
  synthesis: SynthesisOutput,
  path: string,
  violation: AuthorFacingIntegrityViolation,
  pass3PreflightDraft?: Pass3PreflightDraft | null,
  pass1Output?: SinglePassOutput | null,
  pass2Output?: SinglePassOutput | null,
): string | null {
  const key = getLeafKey(path);
  const currentValue = getByPath(synthesis, path);
  const ci = getCriterionIndex(path);
  const candidateVariant = getCandidateVariant(key);
  const isCandidate = candidateVariant !== null;

  let payload: Record<string, unknown>;

  if (ci !== null) {
    const criterion = synthesis.criteria[ci];
    if (!criterion) return null;

    const criterionContext = compactCriterionContext(
      criterion,
      pass3PreflightDraft,
      pass1Output,
      pass2Output,
    );

    const ri = getRecommendationIndex(path);
    if (ri !== null) {
      const rec = criterion.recommendations?.[ri];
      if (!rec) return null;
      payload = {
        path,
        current_value: currentValue,
        violation_codes: [violation.code],
        criterion: criterionContext,
        recommendation: {
          index: ri,
          priority: rec.priority,
          action: clipContextExcerpt(String(rec.action ?? ''), 160),
          expected_impact: clipContextExcerpt(String(rec.expected_impact ?? ''), 160),
          mechanism: clipContextExcerpt(String(rec.mechanism ?? ''), 160),
          specific_fix: clipContextExcerpt(String(rec.specific_fix ?? ''), 160),
          reader_effect: clipContextExcerpt(String(rec.reader_effect ?? ''), 160),
          symptom: clipContextExcerpt(String(rec.symptom ?? ''), 160),
          cause: clipContextExcerpt(String(rec.cause ?? ''), 160),
          fix_direction: clipContextExcerpt(String(rec.fix_direction ?? ''), 160),
          mistake_proofing: clipContextExcerpt(String(rec.mistake_proofing ?? ''), 160),
          ...(isCandidate ? { variant: candidateVariant } : {}),
        },
        constraints: {
          preserve_score: true,
          preserve_evidence: true,
          preserve_recommendations: true,
          return_only_requested_field: true,
          ...(isCandidate ? { regenerate_only_candidate_variant: candidateVariant } : {}),
        },
      };
    } else {
      payload = {
        path,
        current_value: currentValue,
        violation_codes: [violation.code],
        criterion: criterionContext,
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
        fit_summary: clipContextExcerpt(String(c.fit_summary ?? ''), 120),
        gap_summary: clipContextExcerpt(String(c.gap_summary ?? ''), 120),
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
    : isCandidate
    ? [
        `The value must be a single, complete, publication-ready sentence of copy-paste manuscript prose for the author (variant ${candidateVariant}).`,
        'Produce concrete prose the author can paste directly into the manuscript.',
        'Do not concatenate or repeat the action, specific_fix, mechanism, reader_effect, or symptom fields.',
        'Do not include meta-commentary, markdown, bullets, numbering, or templated language such as "This addresses...".',
      ]
    : [
        'The value must be a complete, publication-ready sentence or short paragraph.',
      ];

  return [
    isCandidate
      ? 'Regenerate one optional copy-paste candidate revision for a literary-manuscript evaluation report.'
      : 'Regenerate one required author-facing prose field for a literary-manuscript evaluation report.',
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
    isCandidate
      ? '- Do not alter the score, evidence, other recommendation fields, or any other field.'
      : '- Do not alter the score, evidence, recommendations, or any other field.',
  ].join('\n');
}

async function callRegenerationLLM(
  openai: OpenAI,
  model: string,
  prompt: string,
  fieldPath: string,
): Promise<Record<string, string> | null> {
  const maxTokens =
    fieldPath.includes('one_paragraph_summary') || fieldPath.includes('one_paragraph_pitch')
      ? 1400
      : fieldPath.includes('final_rationale') || fieldPath.includes('rationale')
      ? 900
      : 500;

  let response: Awaited<ReturnType<OpenAI['chat']['completions']['create']>>;
  try {
    response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a senior developmental editor regenerating a single author-facing prose field or copy-paste candidate revision for a manuscript evaluation report. ' +
            'Return ONLY a JSON object with one key: the exact FIELD PATH the user provides. ' +
            'The value must be complete, publication-ready prose: capitalized first letter, terminal punctuation, no ellipses, no mid-sentence cuts.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      ...buildOpenAITemperatureParam(model, 0.3),
      ...buildOpenAIOutputTokenParam(model, maxTokens),
    });
  } catch (error) {
    throw new RepairRegenerationError(
      `Repair model request failed for ${fieldPath}`,
      error,
    );
  }

  const raw = response?.choices?.[0]?.message?.content?.trim();

  if (!raw) {
    throw new RepairRegenerationError(
      `Repair model returned no completion content for ${fieldPath}`,
    );
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string') result[key] = value.trim();
    }
    // Some models return the leaf key instead of the full path; map it back.
    const leaf = getLeafKey(fieldPath);
    if (leaf && result[leaf] !== undefined && result[fieldPath] === undefined) {
      result[fieldPath] = result[leaf];
      delete result[leaf];
    }
    return result;
  } catch {
    // ignore
  }
  return null;
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
      isRequestedChange(changedPath, requested),
    );
  });
}

function isValidRequiredProse(value: unknown): boolean {
  return typeof value === 'string' && isCompleteAuthorFacingSentence(value);
}

function hasChangedOrWasAlreadyValid(
  before: unknown,
  after: unknown,
  path: string,
): boolean {
  const beforeVal = getByPath(before, path);
  const afterVal = getByPath(after, path);
  const changed = beforeVal !== afterVal;
  const beforeValid = isValidRequiredProse(beforeVal);
  const afterValid = isValidRequiredProse(afterVal);

  if (changed && afterValid) return true;
  if (!changed && beforeValid && afterValid) return true;
  return false;
}

export function assertRequestedPathsChangedOrWereValid(
  before: unknown,
  after: unknown,
  requestedPaths: string[],
): string[] {
  return requestedPaths.filter(
    (path) => !hasChangedOrWasAlreadyValid(before, after, path),
  );
}

export async function regenerateRequiredProse(
  synthesis: SynthesisOutput,
  violations: AuthorFacingIntegrityViolation[],
  options: RequiredProseRegenerationOptions = {},
): Promise<RequiredProseRegenerationResult> {
  if (violations.length === 0) {
    return {
      ok: true,
      synthesis,
      regeneratedFields: [],
      failedFields: [],
      mutationBoundaryViolations: [],
      telemetry: {
        attempts: 0,
        regeneratedFields: [],
        failedFields: [],
        model: options.model?.trim() || getCanonicalPass3Model(),
      },
    };
  }

  const apiKey =
    (options.openaiApiKey?.trim() || process.env.OPENAI_API_KEY)?.trim() || '';
  const model = options.model?.trim() || getCanonicalPass3Model();

  if (!apiKey) {
    return {
      ok: false,
      synthesis,
      regeneratedFields: [],
      failedFields: violations.map((v) => v.path),
      mutationBoundaryViolations: [],
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

  // Target only required fields. Candidate fields are repaired/quarantined by
  // regenerateCandidateProse.
  const requiredViolations = violations.filter((v) => !isCandidateTextViolationPath(v.path));

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
    const prompt = buildFieldPrompt(
      synthesis,
      violation.path,
      violation,
      options.pass3PreflightDraft,
      options.pass1Output,
      options.pass2Output,
    );
    if (!prompt) {
      failedFields.push(violation.path);
      continue;
    }

    const generatedMap = await callRegenerationLLM(openai, model, prompt, violation.path);

    if (generatedMap && typeof generatedMap === 'object') {
      for (const [path, value] of Object.entries(generatedMap)) {
        if (isCompleteAuthorFacingSentence(value)) {
          const ok = setByPath(synthesis, path, value);
          if (ok) {
            if (path === violation.path) regeneratedFields.push(violation.path);
          }
        }
      }
    } else {
      failedFields.push(violation.path);
    }

    if (!regeneratedFields.includes(violation.path) && !failedFields.includes(violation.path)) {
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
    restoreFromSnapshot(synthesis, beforeSnapshot);
    return {
      ok: false,
      synthesis,
      regeneratedFields: [],
      failedFields: requestedPaths,
      mutationBoundaryViolations: unexpectedChanges,
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
    mutationBoundaryViolations: [],
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

function normalizeViolationsLocal(
  violations: AuthorFacingIntegrityViolation[],
): AuthorFacingIntegrityViolation[] {
  const seen = new Set<string>();
  return violations.filter((v) => {
    if (seen.has(v.path)) return false;
    seen.add(v.path);
    return true;
  });
}

/**
 * Bounded targeted LLM regeneration for optional candidate_text_a/b/c fields.
 *
 * Candidate text is copy-paste manuscript prose for the author, not metadata to be
 * concatenated from action/specific_fix. This entry point regenerates only the
 * requested candidate path, enforces the same mutation boundary as required prose,
 * and leaves any still-invalid candidate fields for the caller to quarantine.
 */
export async function regenerateCandidateProse(
  synthesis: SynthesisOutput,
  candidateViolations: AuthorFacingIntegrityViolation[],
  options: RequiredProseRegenerationOptions = {},
): Promise<RequiredProseRegenerationResult> {
  const apiKey =
    (options.openaiApiKey?.trim() || process.env.OPENAI_API_KEY)?.trim() || '';
  const model = options.model?.trim() || getCanonicalPass3Model();

  if (candidateViolations.some((v) => !isCandidateTextViolationPath(v.path))) {
    return {
      ok: false,
      synthesis,
      regeneratedFields: [],
      failedFields: candidateViolations.map((v) => v.path),
      mutationBoundaryViolations: [],
      telemetry: {
        attempts: 0,
        regeneratedFields: [],
        failedFields: candidateViolations.map((v) => v.path),
        model,
      },
    };
  }

  if (!apiKey) {
    return {
      ok: false,
      synthesis,
      regeneratedFields: [],
      failedFields: candidateViolations.map((v) => v.path),
      mutationBoundaryViolations: [],
      telemetry: {
        attempts: 0,
        regeneratedFields: [],
        failedFields: candidateViolations.map((v) => v.path),
        model,
      },
    };
  }

  const openai = new OpenAI({
    apiKey,
    timeout: getEvalOpenAiTimeoutMs(),
    maxRetries: 2,
  });

  const maxAttempts = options.maxAttempts ?? 2;
  const originalPaths = new Set(candidateViolations.map((v) => v.path));
  let remaining = normalizeViolationsLocal(candidateViolations);
  let attempts = 0;
  let mutationBoundaryViolations: string[] = [];

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (remaining.length === 0) break;
    attempts += 1;

    const beforeSnapshot: SynthesisOutput = JSON.parse(JSON.stringify(synthesis));
    const requestedPaths = remaining.map((v) => v.path);
    const attemptRegenerated: string[] = [];

    for (const violation of remaining) {
      const prompt = buildFieldPrompt(
        synthesis,
        violation.path,
        violation,
        options.pass3PreflightDraft,
        options.pass1Output,
        options.pass2Output,
      );
      if (!prompt) {
        continue;
      }

      const generatedMap = await callRegenerationLLM(openai, model, prompt, violation.path);
      if (generatedMap && typeof generatedMap === 'object') {
        for (const [path, value] of Object.entries(generatedMap)) {
          if (isCompleteAuthorFacingSentence(value)) {
            const ok = setByPath(synthesis, path, value);
            if (ok && path === violation.path) {
              attemptRegenerated.push(violation.path);
            }
          }
        }
      }
    }

    // Mutation boundary: ensure the LLM changed only the requested candidate paths.
    const unexpectedChanges = assertOnlyRequestedPathsChanged(
      beforeSnapshot,
      synthesis,
      requestedPaths,
    );
    if (unexpectedChanges.length > 0) {
      restoreFromSnapshot(synthesis, beforeSnapshot);
      mutationBoundaryViolations = unexpectedChanges;
      break;
    }

    // Ensure regenerated paths actually became valid and unchanged invalid paths are not accepted.
    const unchangedOrInvalid = assertRequestedPathsChangedOrWereValid(
      beforeSnapshot,
      synthesis,
      requestedPaths,
    );
    for (const path of unchangedOrInvalid) {
      const idx = attemptRegenerated.indexOf(path);
      if (idx !== -1) attemptRegenerated.splice(idx, 1);
    }

    // Re-inspect candidate fields that still violate author-facing integrity.
    const reInspect = inspectAuthorFacingIntegrity(
      { overview: synthesis.overall, criteria: synthesis.criteria, recommendations: {} },
      { rootPath: 'evaluation_result_v2' },
    ).filter((v) => isCandidateTextViolationPath(v.path) && originalPaths.has(v.path));
    remaining = normalizeViolationsLocal(reInspect);
  }

  const failedFields = remaining.map((v) => v.path);
  const regeneratedFields = Array.from(originalPaths).filter(
    (p) => !failedFields.includes(p),
  );

  return {
    ok: failedFields.length === 0 && regeneratedFields.length > 0,
    synthesis,
    regeneratedFields,
    failedFields,
    mutationBoundaryViolations,
    telemetry: {
      attempts,
      regeneratedFields,
      failedFields,
      model,
    },
  };
}

/**
 * Quarantine (remove) unresolved optional candidate text fields.
 *
 * Only candidate_text_a/b/c paths are touched; required prose paths are rejected.
 * Returns the list of paths that were actually quarantined.
 */
export function quarantineCandidateFields(
  synthesis: SynthesisOutput,
  paths: string[],
): string[] {
  const quarantined: string[] = [];
  for (const path of paths) {
    if (!isCandidateTextViolationPath(path)) continue;
    const ok = setByPath(synthesis, path, undefined);
    if (ok) {
      quarantined.push(path);
    }
  }
  return quarantined;
}
