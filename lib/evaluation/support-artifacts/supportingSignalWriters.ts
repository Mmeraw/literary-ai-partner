import crypto from 'crypto';
import type { RuntimeArtifactEnvelope } from '../artifacts/artifactTypes';
import type { Phase1aWriterMetadata } from '../phase1a/storyLayerArtifactWriters';

export type AcceptedLedgerRef = {
  artifact_id: string;
  source_hash: string;
};

export type StoryShapeSignalPayload = {
  accepted_story_ledger_artifact_id: string;
  accepted_story_ledger_source_hash: string;
  pacing_anchor_signals: Array<{
    timeline_marker: string;
    delta_type: string;
    evidence_reference?: string;
  }>;
  structural_turning_points: Record<string, unknown>;
  status: 'active' | 'stale' | 'degraded';
};

export type ManuscriptSignalAppendixPayload = {
  accepted_story_ledger_artifact_id: string;
  accepted_story_ledger_source_hash: string;
  sensory_tonal_register_map: Record<string, unknown>;
  evidence_density_distribution: Record<string, unknown>;
  status: 'active' | 'stale' | 'degraded';
};

export type SupportSignalArtifactType = 'story_shape_signal_map_v1' | 'manuscript_signal_appendix_v1';

export type SupportSignalArtifact<TPayload extends object = object> = {
  artifact_type: SupportSignalArtifactType;
  artifact_version: 'v1';
  source_hash: string;
  content: RuntimeArtifactEnvelope & TPayload;
};

export type SupportSignalWriter = <TPayload extends object>(
  artifact: SupportSignalArtifact<TPayload>,
) => Promise<{ artifact_id: string }>;

export type SupportSignalRefs = {
  story_shape_signal_map_v1: {
    artifact_type: 'story_shape_signal_map_v1';
    artifact_id: string;
    source_hash: string;
  };
  manuscript_signal_appendix_v1: {
    artifact_type: 'manuscript_signal_appendix_v1';
    artifact_id: string;
    source_hash: string;
  };
};

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableStringify(nestedValue)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function sourceHashFor(params: {
  artifactType: SupportSignalArtifactType;
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

function deterministicArtifactId(artifactType: SupportSignalArtifactType, sourceHash: string): string {
  return `${artifactType}:${sourceHash.slice(0, 16)}`;
}

function buildEnvelope(params: {
  metadata: Phase1aWriterMetadata;
  artifactType: SupportSignalArtifactType;
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

export function buildStoryShapeSignalArtifact(params: {
  metadata: Phase1aWriterMetadata;
  acceptedLedger: AcceptedLedgerRef;
  pacing_anchor_signals: StoryShapeSignalPayload['pacing_anchor_signals'];
  structural_turning_points: StoryShapeSignalPayload['structural_turning_points'];
  status?: StoryShapeSignalPayload['status'];
}): SupportSignalArtifact<StoryShapeSignalPayload> {
  const payload: StoryShapeSignalPayload = {
    accepted_story_ledger_artifact_id: params.acceptedLedger.artifact_id,
    accepted_story_ledger_source_hash: params.acceptedLedger.source_hash,
    pacing_anchor_signals: params.pacing_anchor_signals,
    structural_turning_points: params.structural_turning_points,
    status: params.status ?? 'active',
  };
  const artifact_type = 'story_shape_signal_map_v1';
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

export function buildManuscriptSignalAppendixArtifact(params: {
  metadata: Phase1aWriterMetadata;
  acceptedLedger: AcceptedLedgerRef;
  sensory_tonal_register_map: ManuscriptSignalAppendixPayload['sensory_tonal_register_map'];
  evidence_density_distribution: ManuscriptSignalAppendixPayload['evidence_density_distribution'];
  status?: ManuscriptSignalAppendixPayload['status'];
}): SupportSignalArtifact<ManuscriptSignalAppendixPayload> {
  const payload: ManuscriptSignalAppendixPayload = {
    accepted_story_ledger_artifact_id: params.acceptedLedger.artifact_id,
    accepted_story_ledger_source_hash: params.acceptedLedger.source_hash,
    sensory_tonal_register_map: params.sensory_tonal_register_map,
    evidence_density_distribution: params.evidence_density_distribution,
    status: params.status ?? 'active',
  };
  const artifact_type = 'manuscript_signal_appendix_v1';
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

export async function writeSupportSignalsForAcceptedLedger(params: {
  metadata: Phase1aWriterMetadata;
  acceptedLedger: AcceptedLedgerRef;
  shape: {
    pacing_anchor_signals: StoryShapeSignalPayload['pacing_anchor_signals'];
    structural_turning_points: StoryShapeSignalPayload['structural_turning_points'];
  };
  appendix: {
    sensory_tonal_register_map: ManuscriptSignalAppendixPayload['sensory_tonal_register_map'];
    evidence_density_distribution: ManuscriptSignalAppendixPayload['evidence_density_distribution'];
  };
  writeArtifact: SupportSignalWriter;
}): Promise<SupportSignalRefs> {
  const shapeArtifact = buildStoryShapeSignalArtifact({
    metadata: params.metadata,
    acceptedLedger: params.acceptedLedger,
    ...params.shape,
  });
  const appendixArtifact = buildManuscriptSignalAppendixArtifact({
    metadata: params.metadata,
    acceptedLedger: params.acceptedLedger,
    ...params.appendix,
  });

  const shapeWrite = await params.writeArtifact(shapeArtifact);
  const appendixWrite = await params.writeArtifact(appendixArtifact);

  return {
    story_shape_signal_map_v1: {
      artifact_type: 'story_shape_signal_map_v1',
      artifact_id: shapeWrite.artifact_id,
      source_hash: shapeArtifact.source_hash,
    },
    manuscript_signal_appendix_v1: {
      artifact_type: 'manuscript_signal_appendix_v1',
      artifact_id: appendixWrite.artifact_id,
      source_hash: appendixArtifact.source_hash,
    },
  };
}

export function evaluateSupportSignalFreshness(params: {
  acceptedLedger: AcceptedLedgerRef;
  supportArtifact: {
    accepted_story_ledger_source_hash: string;
    status: 'active' | 'stale' | 'degraded';
  };
}): 'active' | 'stale' | 'degraded' {
  if (params.supportArtifact.status === 'degraded') return 'degraded';
  if (params.supportArtifact.accepted_story_ledger_source_hash !== params.acceptedLedger.source_hash) return 'stale';
  return params.supportArtifact.status;
}
