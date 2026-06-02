import crypto from 'crypto';
import OpenAI from 'openai';
import { CRITERIA_KEYS, type CriterionKey } from '@/schemas/criteria-keys';
import { getEvalOpenAiTimeoutMs } from '@/lib/evaluation/config';
import {
  buildOpenAIOutputTokenParam,
  buildOpenAITemperatureParam,
  getCanonicalPipelineModel,
  isReasoningStyleModel,
} from '@/lib/evaluation/policy';

export type SeedClaimStatus =
  | 'proposed_unverified'
  | 'partially_confirmed'
  | 'confirmed_by_evidence'
  | 'drift_detected'
  | 'superseded_by_evidence'
  | 'invalidated';

export type SeedClaim = {
  claim_id: string;
  claim_status: SeedClaimStatus;
  hypothesis: string;
  temp_seed_entity_id?: string;
  criterion_key?: string;
  evidence_coordinates?: string[];
};

export type SeedArtifact = {
  artifact_type: 'story_map_seed_v1' | 'evaluation_seed_v1';
  authority: 'seed_only';
  artifact_status: 'created' | 'superseded' | 'archived' | 'failed';
  generated_at: string;
  claims: SeedClaim[];
};

export type GeneratedSemanticSeedArtifacts = {
  storySeed: SeedArtifact;
  evaluationSeed: SeedArtifact;
  model: string;
  promptVersion: string;
};

export type GenerateSemanticSeedArtifactsInput = {
  jobId: string;
  manuscriptId: number;
  manuscriptText: string;
  title?: string;
  workType?: string | null;
  generatedAt?: string;
  openaiApiKey?: string | null;
  model?: string;
  timeoutMs?: number;
};

const SEMANTIC_SEED_PROMPT_VERSION = 'phase05-semantic-seed-v1';

const STORY_SEED_SYSTEM_PROMPT = `You are Phase 0.5A, the whole-text semantic Story Ledger seed writer.
Read the entire manuscript and draft provisional, manuscript-grounded hypotheses only.

Output exactly valid JSON with this shape:
{
  "story_claims": [
    {
      "claim_id": "story_seed:1",
      "claim_status": "proposed_unverified",
      "hypothesis": "...",
      "temp_seed_entity_id": "optional",
      "evidence_coordinates": ["short manuscript-native anchors"]
    }
  ],
  "evaluation_claims": [
    {
      "claim_id": "evaluation_seed:1",
      "criterion_key": "concept",
      "claim_status": "proposed_unverified",
      "hypothesis": "...",
      "evidence_coordinates": ["short manuscript-native anchors"]
    }
  ],
  "uncertainty_flags": ["..."],
  "semantic_status": "valid"
}

Rules:
- Use only canonical criteria keys from the supplied list.
- No final verdicts, scores, or approvals.
- Keep claims provisional and seed-only.
- Prefer concrete manuscript anchors, named entities, chapter references, or short quoted phrases.
- Keep every hypothesis concise: one sentence, 240 characters or fewer.
- Do not quote long passages. Use short anchors only.
- If evidence is sparse, still emit a cautious hypothesis and flag uncertainty.
- Return JSON only.`;

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeClaimStatus(value: unknown): SeedClaimStatus {
  const candidate = typeof value === 'string' ? value.trim() : '';
  return candidate === 'partially_confirmed' ||
    candidate === 'confirmed_by_evidence' ||
    candidate === 'drift_detected' ||
    candidate === 'superseded_by_evidence' ||
    candidate === 'invalidated'
    ? candidate
    : 'proposed_unverified';
}

function normalizeEvidenceCoordinates(value: unknown, fallback: string): string[] {
  if (Array.isArray(value)) {
    const coords = value.filter(hasText).map((item) => item.trim()).slice(0, 4);
    if (coords.length > 0) return coords;
  }
  return [fallback];
}

function normalizeStoryClaim(value: unknown, index: number): SeedClaim {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const hypothesis = hasText(record.hypothesis)
    ? record.hypothesis.trim()
    : `Provisional story hypothesis ${index + 1} could not be fully extracted and must be verified in Phase 1A.`;
  const entityId = hasText(record.temp_seed_entity_id)
    ? record.temp_seed_entity_id.trim()
    : `temp_seed_entity_${index + 1}`;

  return {
    claim_id: hasText(record.claim_id) ? record.claim_id.trim() : `story_seed:${index + 1}`,
    claim_status: normalizeClaimStatus(record.claim_status),
    hypothesis,
    temp_seed_entity_id: entityId,
    evidence_coordinates: normalizeEvidenceCoordinates(
      record.evidence_coordinates,
      `seed:story:${index + 1}`,
    ),
  };
}

function normalizeEvaluationClaim(value: unknown, index: number): SeedClaim {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const criterion = hasText(record.criterion_key) && CRITERIA_KEYS.includes(record.criterion_key as CriterionKey)
    ? (record.criterion_key as CriterionKey)
    : CRITERIA_KEYS[index % CRITERIA_KEYS.length];

  return {
    claim_id: hasText(record.claim_id) ? record.claim_id.trim() : `evaluation_seed:${index + 1}`,
    claim_status: normalizeClaimStatus(record.claim_status),
    criterion_key: criterion,
    hypothesis: hasText(record.hypothesis)
      ? record.hypothesis.trim()
      : `Provisional evaluation hypothesis for ${criterion} must be validated against manuscript evidence in Phase 1A.`,
    evidence_coordinates: normalizeEvidenceCoordinates(
      record.evidence_coordinates,
      `seed:evaluation:${criterion}`,
    ),
  };
}

function normalizeSeedArray(values: unknown, kind: 'story' | 'evaluation'): SeedClaim[] {
  const raw = Array.isArray(values) ? values : [];
  const normalized = raw
    .filter((item) => item && typeof item === 'object')
    .slice(0, kind === 'story' ? 8 : 13)
    .map((item, index) => (kind === 'story' ? normalizeStoryClaim(item, index) : normalizeEvaluationClaim(item, index)));

  if (normalized.length > 0) return normalized;

  if (kind === 'story') {
    return [normalizeStoryClaim({}, 0)];
  }

  return CRITERIA_KEYS.slice(0, 4).map((criterion_key, index) => ({
    claim_id: `evaluation_seed:${index + 1}`,
    claim_status: 'proposed_unverified' as const,
    criterion_key,
    hypothesis: `Provisional evaluation hypothesis for ${criterion_key} must be verified against manuscript evidence in Phase 1A.`,
    evidence_coordinates: [`seed:evaluation:${criterion_key}`],
  }));
}

function buildFallbackSeedRecord(params: { title: string; workType: string; parseError?: string }): Record<string, unknown> {
  const errorSuffix = params.parseError ? ` LLM seed JSON was malformed (${params.parseError});` : '';
  return {
    story_claims: [
      {
        claim_id: 'story_seed:fallback:1',
        claim_status: 'proposed_unverified',
        hypothesis: `${params.title} is a ${params.workType} requiring Phase 1A evidence audit before any Story Ledger authority is granted.${errorSuffix}`,
        temp_seed_entity_id: 'temp_seed_entity_fallback_primary_work',
        evidence_coordinates: ['phase0.5:fallback_seed', 'phase0.5:llm_seed_unavailable'],
      },
    ],
    evaluation_claims: CRITERIA_KEYS.slice(0, 4).map((criterion_key, index) => ({
      claim_id: `evaluation_seed:fallback:${index + 1}`,
      criterion_key,
      claim_status: 'proposed_unverified',
      hypothesis: `The ${criterion_key} criterion requires Phase 1A verification against manuscript evidence before downstream evaluation can rely on it.`,
      evidence_coordinates: [`phase0.5:fallback:${criterion_key}`],
    })),
    uncertainty_flags: ['phase0_5_llm_seed_fallback_used'],
    semantic_status: 'fallback_valid',
  };
}

function parseSeedResponse(raw: string, fallbackContext: { title: string; workType: string }): Record<string, unknown> {
  if (!hasText(raw)) {
    return buildFallbackSeedRecord({ ...fallbackContext, parseError: 'empty_response' });
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : buildFallbackSeedRecord({ ...fallbackContext, parseError: 'non_object_response' });
  } catch {
    return buildFallbackSeedRecord({
      ...fallbackContext,
      parseError: 'malformed_json',
    });
  }
}

async function createOpenAICompletion(params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  timeoutMs: number;
}): Promise<string> {
  const openai = new OpenAI({ apiKey: params.apiKey, timeout: params.timeoutMs, maxRetries: 0 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs);

  try {
    const completion = await openai.chat.completions.create(
      {
        model: params.model,
        ...(isReasoningStyleModel(params.model)
          ? {}
          : buildOpenAITemperatureParam(params.model, 0.15)),
        ...buildOpenAIOutputTokenParam(params.model, 8_000),
        messages: [
          { role: 'system', content: params.systemPrompt },
          { role: 'user', content: params.userPrompt },
        ],
        response_format: { type: 'json_object' },
      },
      { signal: controller.signal },
    );

    return completion.choices?.[0]?.message?.content ?? '';
  } finally {
    clearTimeout(timer);
  }
}

export async function generateSemanticSeedArtifacts(input: GenerateSemanticSeedArtifactsInput): Promise<GeneratedSemanticSeedArtifacts> {
  const apiKey = typeof input.openaiApiKey === 'string' ? input.openaiApiKey.trim() : '';

  const model = getCanonicalPipelineModel(input.model);
  const timeoutMs = input.timeoutMs ?? getEvalOpenAiTimeoutMs();
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const title = input.title?.trim() || 'Untitled manuscript';
  const workType = input.workType?.trim() || 'manuscript';

  const userPrompt = [
    `Job ID: ${input.jobId}`,
    `Manuscript ID: ${input.manuscriptId}`,
    `Title: ${title}`,
    `Work type: ${workType}`,
    `Canonical criteria keys: ${CRITERIA_KEYS.join(', ')}`,
    'Read the whole manuscript below and produce compact provisional seed claims only.',
    'Manuscript text:',
    input.manuscriptText,
  ].join('\n');

  let record: Record<string, unknown>;
  if (!apiKey) {
    record = buildFallbackSeedRecord({ title, workType, parseError: 'missing_openai_key' });
  } else {
    try {
      const raw = await createOpenAICompletion({
        apiKey,
        model,
        systemPrompt: STORY_SEED_SYSTEM_PROMPT,
        userPrompt,
        timeoutMs,
      });
      record = parseSeedResponse(raw, { title, workType });
    } catch (error) {
      const parseError = error instanceof Error && error.name === 'AbortError'
        ? 'provider_timeout'
        : 'provider_error';
      record = buildFallbackSeedRecord({ title, workType, parseError });
    }
  }

  const storyClaims = normalizeSeedArray(record.story_claims, 'story');
  const evaluationClaims = normalizeSeedArray(record.evaluation_claims, 'evaluation');

  const storySeed: SeedArtifact = {
    artifact_type: 'story_map_seed_v1',
    authority: 'seed_only',
    artifact_status: 'created',
    generated_at: generatedAt,
    claims: storyClaims,
  };

  const evaluationSeed: SeedArtifact = {
    artifact_type: 'evaluation_seed_v1',
    authority: 'seed_only',
    artifact_status: 'created',
    generated_at: generatedAt,
    claims: evaluationClaims,
  };

  return {
    storySeed,
    evaluationSeed,
    model,
    promptVersion: SEMANTIC_SEED_PROMPT_VERSION,
  };
}

export function buildSemanticSeedSourceHash(input: {
  jobId: string;
  manuscriptId: number;
  userId: string;
  manuscriptText: string;
  promptVersion?: string;
  model?: string;
}): string {
  return crypto.createHash('sha256').update(JSON.stringify({
    jobId: input.jobId,
    manuscriptId: input.manuscriptId,
    userId: input.userId,
    manuscriptText: input.manuscriptText,
    promptVersion: input.promptVersion ?? SEMANTIC_SEED_PROMPT_VERSION,
    model: input.model ?? 'semantic_seed_llm',
  }), 'utf8').digest('hex');
}