import crypto from 'crypto';
import {
  STORY_LAYER_CORE_LAYER_KEYS,
  type CanonicalEvaluationArtifactType,
  type RuntimeArtifactEnvelope,
  type StoryLayerCoreLayerKey,
} from '../artifacts/artifactTypes';

export type Phase1aWriterMetadata = {
  job_id: string;
  evaluation_project_id: string | null;
  stage_run_id?: string | null;
  manuscript_id: number;
  manuscript_version_hash: string;
  generated_at?: string;
};

export type StoryLayerPayload = Record<StoryLayerCoreLayerKey, Record<string, unknown>>;

export type LedgerQualityReportPayload = {
  gate_ready_status: 'reviewable' | 'blocked' | 'repair_required';
  hard_fail_present: boolean;
  grouped_warning_summary: Record<string, string[]>;
  evidence_location_references: Array<{
    layer: StoryLayerCoreLayerKey | 'general';
    reference: string;
  }>;
  blocking_reasons: string[];
  recommended_review_action: 'send_to_review_gate' | 'repair_story_layer' | 'operator_review_required';
};

export type Phase1aArtifactContent<TPayload extends object> = RuntimeArtifactEnvelope & TPayload;

export type Phase1aWriterArtifact<TPayload extends object = object> = {
  artifact_type: Extract<CanonicalEvaluationArtifactType, 'pass1a_story_layer_v1' | 'ledger_quality_report_v1'>;
  artifact_version: 'v1';
  source_hash: string;
  content: Phase1aArtifactContent<TPayload>;
};

export type Phase1aArtifactRef = {
  artifact_type: Extract<CanonicalEvaluationArtifactType, 'pass1a_story_layer_v1' | 'ledger_quality_report_v1'>;
  artifact_id: string;
  source_hash: string;
};

export type Phase1aArtifactWriter = <TPayload extends object>(
  artifact: Phase1aWriterArtifact<TPayload>,
) => Promise<{ artifact_id: string }>;

const FORBIDDEN_STORY_LAYER_KEYS = new Set([
  'governance',
  'governance_rail',
  'governance_warnings',
  'approval_state',
  'review_disposition',
  'ledger_user_feedback_v1',
  'accepted_story_ledger_v1',
  'ledger_quality_report_v1',
  'story_shape_signal_map_v1',
  'manuscript_signal_appendix_v1',
]);

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableStringify(nestedValue)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function sourceHashFor(params: {
  artifactType: Phase1aWriterArtifact['artifact_type'];
  metadata: Phase1aWriterMetadata;
  payload: unknown;
}): string {
  return crypto
    .createHash('sha256')
    .update(stableStringify({
      artifact_type: params.artifactType,
      job_id: params.metadata.job_id,
      evaluation_project_id: params.metadata.evaluation_project_id,
      manuscript_id: params.metadata.manuscript_id,
      manuscript_version_hash: params.metadata.manuscript_version_hash,
      payload: params.payload,
    }))
    .digest('hex');
}

function deterministicArtifactId(artifactType: Phase1aWriterArtifact['artifact_type'], sourceHash: string): string {
  return `${artifactType}:${sourceHash.slice(0, 16)}`;
}

function buildEnvelope(params: {
  metadata: Phase1aWriterMetadata;
  artifactType: Phase1aWriterArtifact['artifact_type'];
  sourceHash: string;
}): RuntimeArtifactEnvelope {
  return {
    job_id: params.metadata.job_id,
    evaluation_project_id: params.metadata.evaluation_project_id,
    stage_run_id: params.metadata.stage_run_id ?? null,
    manuscript_id: params.metadata.manuscript_id,
    manuscript_version_hash: params.metadata.manuscript_version_hash,
    artifact_id: deterministicArtifactId(params.artifactType, params.sourceHash),
    artifact_type: params.artifactType,
    artifact_version: 'v1',
    source_hash: params.sourceHash,
    generated_at: params.metadata.generated_at ?? new Date().toISOString(),
  };
}

export function validateStoryLayerPayload(payload: Record<string, unknown>): StoryLayerPayload {
  const payloadKeys = Object.keys(payload);
  const allowedLayerKeys = new Set<string>(STORY_LAYER_CORE_LAYER_KEYS);

  const forbiddenKeys = payloadKeys.filter((key) => FORBIDDEN_STORY_LAYER_KEYS.has(key));
  if (forbiddenKeys.length > 0) {
    throw new Error(`pass1a_story_layer_v1 must not embed governance, approval, or support artifacts: ${forbiddenKeys.join(', ')}`);
  }

  const unexpectedKeys = payloadKeys.filter((key) => !allowedLayerKeys.has(key));
  if (unexpectedKeys.length > 0) {
    throw new Error(`pass1a_story_layer_v1 contains non-canonical layer key(s): ${unexpectedKeys.join(', ')}`);
  }

  const missingKeys = STORY_LAYER_CORE_LAYER_KEYS.filter((key) => !(key in payload));
  if (missingKeys.length > 0) {
    throw new Error(`pass1a_story_layer_v1 is missing canonical layer key(s): ${missingKeys.join(', ')}`);
  }

  if (payloadKeys.length !== STORY_LAYER_CORE_LAYER_KEYS.length) {
    throw new Error('pass1a_story_layer_v1 must contain exactly eight canonical layers');
  }

  for (const key of STORY_LAYER_CORE_LAYER_KEYS) {
    const layer = payload[key];
    if (!layer || typeof layer !== 'object' || Array.isArray(layer)) {
      throw new Error(`pass1a_story_layer_v1 layer ${key} must be an object payload`);
    }
  }

  return payload as StoryLayerPayload;
}

export function buildPass1aStoryLayerArtifact(params: {
  metadata: Phase1aWriterMetadata;
  storyLayer: Record<string, unknown>;
}): Phase1aWriterArtifact<{ layers: StoryLayerPayload }> {
  const layers = validateStoryLayerPayload(params.storyLayer);
  const artifact_type = 'pass1a_story_layer_v1';
  const source_hash = sourceHashFor({ artifactType: artifact_type, metadata: params.metadata, payload: layers });

  return {
    artifact_type,
    artifact_version: 'v1',
    source_hash,
    content: {
      ...buildEnvelope({ metadata: params.metadata, artifactType: artifact_type, sourceHash: source_hash }),
      layers,
    },
  };
}

export function buildLedgerQualityReportArtifact(params: {
  metadata: Phase1aWriterMetadata;
  storyLayerSourceHash: string;
  qualityReport: LedgerQualityReportPayload;
}): Phase1aWriterArtifact<{
  pass1a_story_layer_source_hash: string;
  quality_report: LedgerQualityReportPayload;
}> {
  const artifact_type = 'ledger_quality_report_v1';
  const payload = {
    pass1a_story_layer_source_hash: params.storyLayerSourceHash,
    quality_report: params.qualityReport,
  };
  const source_hash = sourceHashFor({ artifactType: artifact_type, metadata: params.metadata, payload });

  return {
    artifact_type,
    artifact_version: 'v1',
    source_hash,
    content: {
      ...buildEnvelope({ metadata: params.metadata, artifactType: artifact_type, sourceHash: source_hash }),
      ...payload,
    },
  };
}

export async function writePhase1aReviewGateArtifacts(params: {
  metadata: Phase1aWriterMetadata;
  storyLayer: Record<string, unknown>;
  qualityReport: LedgerQualityReportPayload;
  writeArtifact: Phase1aArtifactWriter;
}): Promise<{
  pass1a_story_layer_v1: Phase1aArtifactRef;
  ledger_quality_report_v1: Phase1aArtifactRef;
}> {
  const storyLayerArtifact = buildPass1aStoryLayerArtifact({
    metadata: params.metadata,
    storyLayer: params.storyLayer,
  });

  const qualityReportArtifact = buildLedgerQualityReportArtifact({
    metadata: params.metadata,
    storyLayerSourceHash: storyLayerArtifact.source_hash,
    qualityReport: params.qualityReport,
  });

  const storyLayerWrite = await params.writeArtifact(storyLayerArtifact);
  const qualityReportWrite = await params.writeArtifact(qualityReportArtifact);

  return {
    pass1a_story_layer_v1: {
      artifact_type: 'pass1a_story_layer_v1',
      artifact_id: storyLayerWrite.artifact_id,
      source_hash: storyLayerArtifact.source_hash,
    },
    ledger_quality_report_v1: {
      artifact_type: 'ledger_quality_report_v1',
      artifact_id: qualityReportWrite.artifact_id,
      source_hash: qualityReportArtifact.source_hash,
    },
  };
}
