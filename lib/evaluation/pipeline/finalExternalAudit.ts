import type { SupabaseClient } from '@supabase/supabase-js';
import type { EvaluationResultV2 } from '@/schemas/evaluation-result-v2';
import { stableSourceHash, upsertEvaluationArtifact } from '@/lib/evaluation/artifactPersistence';
import { buildFinalExternalAuditPacket, buildFinalExternalAuditPrompt, type FinalExternalAuditPacket } from './finalExternalAuditPrompt';

export type FinalExternalAuditVerdict = 'PASS' | 'WARN' | 'BLOCK' | 'SKIP';

export type FinalExternalAuditCode =
  | 'FINAL_AUDIT_SAFE_TO_RELEASE'
  | 'FINAL_AUDIT_SKIPPED_SHORT_FORM'
  | 'FINAL_AUDIT_PROVIDER_UNAVAILABLE'
  | 'FINAL_AUDIT_MISSING_DREAM'
  | 'FINAL_AUDIT_MISSING_WAVE'
  | 'FINAL_AUDIT_MISSING_PHASE5'
  | 'FINAL_AUDIT_LOW_COVERAGE'
  | 'FINAL_AUDIT_CONTRADICTION'
  | 'FINAL_AUDIT_SCHEMA_INVALID';

export type FinalExternalAuditResult = {
  schema_version: 'final_external_audit_v1';
  verdict: FinalExternalAuditVerdict;
  codes: FinalExternalAuditCode[];
  blocking: boolean;
  reason: string;
  checked_artifacts: Record<string, { present: boolean; metadata?: Record<string, unknown> }>;
  coverage_summary: unknown;
  contradictions: Array<{ code: string; detail: string }>;
  missing_required_artifacts: string[];
  provider: 'perplexity' | 'deterministic';
  model: string;
  generated_at: string;
  packet: FinalExternalAuditPacket;
  /** Bind this audit to the evaluation result artifact it was produced for. */
  evaluation_result_version?: string;
  /** Bind this audit to the verified manuscript word count used at audit time. */
  word_count?: number;
  /** Bind this audit to the canonical result source hash it was produced for. */
  evaluation_result_source_hash?: string;
};

export type FinalExternalAuditMode = 'optional' | 'required';

type ProviderAuditResult = {
  verdict: Exclude<FinalExternalAuditVerdict, 'SKIP'>;
  codes: FinalExternalAuditCode[];
  reason: string;
  contradictions: Array<{ code: string; detail: string }>;
  model: string;
};

const LONG_FORM_WORD_THRESHOLD = 25_000;

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function isRequiredMode(value: unknown): value is FinalExternalAuditMode {
  return value === 'optional' || value === 'required';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function deriveEvaluationResultVersion(evaluationResult: unknown): string {
  const record = asRecord(evaluationResult);
  return typeof record?.schema_version === 'string' ? record.schema_version : 'evaluation_result_v2';
}

function isFinalAuditVerdict(value: unknown): value is Exclude<FinalExternalAuditVerdict, 'SKIP'> {
  return value === 'PASS' || value === 'WARN' || value === 'BLOCK';
}

function isFinalAuditCode(value: unknown): value is FinalExternalAuditCode {
  return typeof value === 'string' && [
    'FINAL_AUDIT_SAFE_TO_RELEASE',
    'FINAL_AUDIT_PROVIDER_UNAVAILABLE',
    'FINAL_AUDIT_MISSING_DREAM',
    'FINAL_AUDIT_MISSING_WAVE',
    'FINAL_AUDIT_MISSING_PHASE5',
    'FINAL_AUDIT_LOW_COVERAGE',
    'FINAL_AUDIT_CONTRADICTION',
    'FINAL_AUDIT_SCHEMA_INVALID',
  ].includes(value);
}

function isProviderBlockingCode(code: FinalExternalAuditCode): boolean {
  return code === 'FINAL_AUDIT_MISSING_DREAM'
    || code === 'FINAL_AUDIT_MISSING_WAVE'
    || code === 'FINAL_AUDIT_MISSING_PHASE5'
    || code === 'FINAL_AUDIT_LOW_COVERAGE'
    || code === 'FINAL_AUDIT_CONTRADICTION'
    || code === 'FINAL_AUDIT_SCHEMA_INVALID';
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  try {
    return asRecord(JSON.parse(text));
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return asRecord(JSON.parse(match[0]));
    } catch {
      return null;
    }
  }
}

async function runPerplexityFinalAudit(packet: FinalExternalAuditPacket): Promise<ProviderAuditResult | null> {
  const apiKey = process.env.PERPLEXITY_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.FINAL_EXTERNAL_AUDIT_MODEL?.trim() || 'sonar';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 1200,
        messages: [
          { role: 'system', content: 'Return only JSON. Do not write author-facing prose.' },
          { role: 'user', content: buildFinalExternalAuditPrompt(packet) },
        ],
      }),
    });

    if (!response.ok) return null;
    const payload = asRecord(await response.json());
    const choice = Array.isArray(payload?.choices) ? asRecord(payload.choices[0]) : null;
    const message = asRecord(choice?.message);
    const content = typeof message?.content === 'string' ? message.content : '';
    const parsed = extractJsonObject(content);
    if (!parsed || !isFinalAuditVerdict(parsed.verdict)) return null;

    const codes = Array.isArray(parsed.codes)
      ? parsed.codes.filter(isFinalAuditCode)
      : [];
    const contradictions = Array.isArray(parsed.contradictions)
      ? parsed.contradictions.map((item) => asRecord(item)).filter((item): item is Record<string, unknown> => Boolean(item)).map((item) => ({
          code: typeof item.code === 'string' ? item.code : 'FINAL_AUDIT_CONTRADICTION',
          detail: typeof item.detail === 'string' ? item.detail.slice(0, 500) : 'Provider reported a contradiction.',
        }))
      : [];

    return {
      verdict: parsed.verdict,
      codes: codes.length > 0 ? unique(codes) : [parsed.verdict === 'PASS' ? 'FINAL_AUDIT_SAFE_TO_RELEASE' : 'FINAL_AUDIT_LOW_COVERAGE'],
      reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 1000) : 'Provider final audit completed.',
      contradictions,
      model,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function mergeProviderAudit(base: FinalExternalAuditResult, provider: ProviderAuditResult): FinalExternalAuditResult {
  const providerReason = provider.reason.toLowerCase();
  const optionalReviseLedgerFalseBlock =
    provider.verdict === 'BLOCK'
    && provider.codes.includes('FINAL_AUDIT_SCHEMA_INVALID')
    && providerReason.includes('revision_opportunity_ledger_v1')
    && !base.missing_required_artifacts.includes('evaluation_result_v2')
    && !base.missing_required_artifacts.includes('longform_document_v1');

  if (optionalReviseLedgerFalseBlock) {
    return {
      ...base,
      provider: 'perplexity',
      model: provider.model,
      reason: base.verdict === 'PASS'
        ? 'Final verification passed; required long-form artifacts are present. External auditor flagged missing revision_opportunity_ledger_v1, but that artifact is Revise-phase only and is not hard-required for evaluation release.'
        : base.reason,
      codes: base.verdict === 'PASS' && !base.codes.includes('FINAL_AUDIT_SAFE_TO_RELEASE')
        ? [...base.codes, 'FINAL_AUDIT_SAFE_TO_RELEASE']
        : base.codes,
    };
  }

  const providerBlocking = provider.verdict === 'BLOCK' && provider.codes.some(isProviderBlockingCode);
  const verdict: FinalExternalAuditVerdict = providerBlocking ? 'BLOCK' : provider.verdict;
  const codes = unique([...base.codes.filter((code) => code !== 'FINAL_AUDIT_PROVIDER_UNAVAILABLE'), ...provider.codes]);

  return {
    ...base,
    verdict,
    codes,
    blocking: base.blocking || providerBlocking,
    reason: provider.reason,
    contradictions: provider.contradictions,
    provider: 'perplexity',
    model: provider.model,
  };
}

export function getFinalExternalAuditMode(params?: { multiLayer?: boolean }): FinalExternalAuditMode {
  if (params?.multiLayer) return 'required';
  const raw = process.env.FINAL_EXTERNAL_AUDIT_MODE?.trim().toLowerCase();
  return isRequiredMode(raw) ? raw : 'optional';
}

export function getShortFormExternalQaMode(): 'off' | 'dispute_only' | 'premium' | 'operator_only' {
  const raw = process.env.SHORT_FORM_EXTERNAL_QA_MODE?.trim().toLowerCase();
  if (raw === 'dispute_only' || raw === 'premium' || raw === 'operator_only') return raw;
  return 'off';
}

export function isLongFormMultiLayerContext(input: { workType?: string | null; templateMode?: string | null }): boolean {
  const raw = `${input.workType ?? ''} ${input.templateMode ?? ''}`.toLowerCase();
  return /multi[-_ ]layer|multi[-_ ]timeline|multi[-_ ]pov|complex|layered/.test(raw);
}

export function runFinalExternalAudit(input: {
  wordCount: number;
  evaluationResult: EvaluationResultV2 | Record<string, unknown>;
  checkedArtifacts: Record<string, { present: boolean; metadata?: Record<string, unknown> }>;
  mode?: FinalExternalAuditMode;
  multiLayer?: boolean;
  providerAvailable?: boolean;
  evaluationResultSourceHash?: string;
}): FinalExternalAuditResult {
  const generatedAt = new Date().toISOString();
  const mode = input.mode ?? getFinalExternalAuditMode({ multiLayer: input.multiLayer });
  const checked = input.checkedArtifacts;

  if (input.wordCount < LONG_FORM_WORD_THRESHOLD) {
    const packet = buildFinalExternalAuditPacket({ evaluationResult: input.evaluationResult, checkedArtifacts: checked });
    return {
      schema_version: 'final_external_audit_v1',
      verdict: 'SKIP',
      codes: ['FINAL_AUDIT_SKIPPED_SHORT_FORM'],
      blocking: false,
      reason: 'Short-form evaluations skip final external audit by default.',
      checked_artifacts: checked,
      coverage_summary: packet.coverage_summary,
      contradictions: [],
      missing_required_artifacts: [],
      provider: 'deterministic',
      model: 'deterministic-final-audit-v1',
      generated_at: generatedAt,
      packet,
      evaluation_result_version: deriveEvaluationResultVersion(input.evaluationResult),
      word_count: input.wordCount,
      evaluation_result_source_hash: input.evaluationResultSourceHash,
    };
  }

  // Hard-required: these artifacts MUST exist at audit time or the evaluation is incomplete.
  // evaluation_result_v2 — always exists (written by main processor before DREAM worker fires)
  // longform_document_v1 — just persisted by the DREAM worker before this audit runs
  //
  // NOT required at audit time:
  // revision_opportunity_ledger_v1 — Revise-phase artifact, created when author initiates revision
  // wave_revision_plan_v1 — written by main processor; missing = WARN, not BLOCK
  const missingRequired = [
    !checked.evaluation_result_v2?.present ? 'evaluation_result_v2' : null,
    !checked.longform_document_v1?.present ? 'longform_document_v1' : null,
  ].filter((value): value is string => Boolean(value));

  // Soft-checked: missing triggers WARN, not BLOCK
  const missingOptional = [
    !checked.wave_revision_plan_v1?.present ? 'wave_revision_plan_v1' : null,
    input.multiLayer && !checked.revision_opportunity_ledger_v1?.present ? 'revision_opportunity_ledger_v1' : null,
  ].filter((value): value is string => Boolean(value));

  const packet = buildFinalExternalAuditPacket({ evaluationResult: input.evaluationResult, checkedArtifacts: checked });
  const lowCoverage = packet.representative_evidence_anchors.length < 13;
  const providerAvailable = input.providerAvailable ?? Boolean(process.env.PERPLEXITY_API_KEY?.trim());

  const codes: FinalExternalAuditCode[] = [];
  if (missingRequired.includes('longform_document_v1')) codes.push('FINAL_AUDIT_MISSING_DREAM');
  if (missingOptional.includes('wave_revision_plan_v1')) codes.push('FINAL_AUDIT_MISSING_WAVE');
  if (lowCoverage) codes.push('FINAL_AUDIT_LOW_COVERAGE');
  if (!providerAvailable) codes.push('FINAL_AUDIT_PROVIDER_UNAVAILABLE');

  const requiredFailure = mode === 'required' && (missingRequired.length > 0 || !providerAvailable);
  // Only hard-required artifacts cause BLOCK — optional missing artifacts are WARN
  const blocking = requiredFailure || missingRequired.length > 0;

  const verdict: FinalExternalAuditVerdict = blocking
    ? 'BLOCK'
    : codes.length > 0
      ? 'WARN'
      : 'PASS';

  if (verdict === 'PASS') codes.push('FINAL_AUDIT_SAFE_TO_RELEASE');

  return {
    schema_version: 'final_external_audit_v1',
    verdict,
    codes: unique(codes),
    blocking,
    reason: blocking
      ? `Final verification blocked: missing required artifacts (${missingRequired.join(', ') || 'provider unavailable'}).`
      : verdict === 'WARN'
        ? 'Final verification completed with non-blocking warnings.'
        : 'Final verification passed; required long-form artifacts are present.',
    checked_artifacts: checked,
    coverage_summary: packet.coverage_summary,
    contradictions: [],
    missing_required_artifacts: [...missingRequired, ...missingOptional],
    provider: providerAvailable ? 'perplexity' : 'deterministic',
    model: providerAvailable ? 'sonar-compact-final-audit-v1' : 'deterministic-final-audit-v1',
    generated_at: generatedAt,
    packet,
    evaluation_result_version: deriveEvaluationResultVersion(input.evaluationResult),
    word_count: input.wordCount,
    evaluation_result_source_hash: input.evaluationResultSourceHash,
  };
}

export async function persistFinalExternalAudit(params: {
  supabase: SupabaseClient;
  jobId: string;
  manuscriptId: number;
  userId: string;
  wordCount: number;
  workType?: string | null;
  evaluationResult: EvaluationResultV2 | Record<string, unknown>;
  checkedArtifacts: Record<string, { present: boolean; metadata?: Record<string, unknown> }>;
  evaluationResultSourceHash?: string;
}): Promise<FinalExternalAuditResult> {
  const multiLayer = isLongFormMultiLayerContext({ workType: params.workType });
  const providerResult = params.wordCount >= LONG_FORM_WORD_THRESHOLD
    ? await runPerplexityFinalAudit(
        buildFinalExternalAuditPacket({
          evaluationResult: params.evaluationResult,
          checkedArtifacts: params.checkedArtifacts,
        }),
      )
    : null;

  const baseResult = runFinalExternalAudit({
    wordCount: params.wordCount,
    evaluationResult: params.evaluationResult,
    checkedArtifacts: params.checkedArtifacts,
    mode: getFinalExternalAuditMode({ multiLayer }),
    multiLayer,
    providerAvailable: Boolean(providerResult),
    evaluationResultSourceHash: params.evaluationResultSourceHash,
  });
  const result = providerResult ? mergeProviderAudit(baseResult, providerResult) : baseResult;

  await upsertEvaluationArtifact({
    supabase: params.supabase,
    jobId: params.jobId,
    manuscriptId: params.manuscriptId,
    artifactType: 'final_external_audit_v1',
    artifactVersion: 'final_external_audit_v1',
    sourceHash: stableSourceHash({
      manuscriptId: params.manuscriptId,
      jobId: params.jobId,
      userId: params.userId,
      manuscriptText: JSON.stringify({ checked: result.checked_artifacts, codes: result.codes }),
      promptVersion: 'final_external_audit_v1',
      model: result.model,
    }),
    content: result,
  });

  return result;
}
