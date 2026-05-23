import crypto from 'crypto';
import {
  STORY_LAYER_CORE_LAYER_KEYS,
  type RuntimeArtifactEnvelope,
  type StoryLayerCoreLayerKey,
} from '../artifacts/artifactTypes';
import {
  validateStoryLayerPayload,
  type LedgerQualityReportPayload,
  type Phase1aWriterMetadata,
  type StoryLayerPayload,
} from '../phase1a/storyLayerArtifactWriters';

export type ReviewerRole = 'author' | 'admin' | 'operator';

export type LedgerReviewStatus =
  | 'accepted_without_changes'
  | 'accepted_with_corrections'
  | 'accepted_with_override'
  | 'rejected';

export type LayerDisposition = {
  layer: StoryLayerCoreLayerKey;
  status: 'accepted' | 'modified' | 'rejected';
  notes?: string;
};

export type LedgerUserFeedbackPayload = {
  reviewer_user_id: string;
  reviewer_role: ReviewerRole;
  review_status: LedgerReviewStatus;
  layer_dispositions: LayerDisposition[];
  user_corrections: Partial<Record<StoryLayerCoreLayerKey, Record<string, unknown>>>;
  unresolved_warnings: string[];
};

export type AcceptedStoryLedgerPayload = {
  approved_by_user_id: string;
  approval_timestamp: string;
  source_artifacts: {
    pass1a_story_layer_artifact_id: string;
    pass1a_story_layer_source_hash: string;
    ledger_quality_report_artifact_id: string;
    ledger_quality_report_source_hash: string;
    ledger_user_feedback_artifact_id: string;
    ledger_user_feedback_source_hash: string;
  };
  normalized_layers: StoryLayerPayload;
  governance_summary: {
    review_status: Exclude<LedgerReviewStatus, 'rejected'>;
    warnings_resolved: string[];
    unresolved_warnings: string[];
    admin_override_applied: boolean;
  };
};

export type ReviewGateSourceArtifacts = {
  pass1a_story_layer_v1: {
    artifact_id: string;
    source_hash: string;
    layers: Record<string, unknown>;
  };
  ledger_quality_report_v1: {
    artifact_id: string;
    source_hash: string;
    quality_report: LedgerQualityReportPayload;
  };
};

export type ApprovalNormalizerArtifactType = 'ledger_user_feedback_v1' | 'accepted_story_ledger_v1';

export type ApprovalNormalizerArtifact<TPayload extends object = {
  feedback?: LedgerUserFeedbackPayload;
  accepted_story_ledger?: AcceptedStoryLedgerPayload;
}> = {
  artifact_type: ApprovalNormalizerArtifactType;
  artifact_version: 'v1';
  source_hash: string;
  content: RuntimeArtifactEnvelope & TPayload;
};

export type ApprovalNormalizerWriter = (
  artifact: ApprovalNormalizerArtifact,
) => Promise<{ artifact_id: string }>;

export type ApprovalNormalizerResult = {
  ledger_user_feedback_v1: {
    artifact_type: 'ledger_user_feedback_v1';
    artifact_id: string;
    source_hash: string;
  };
  accepted_story_ledger_v1?: {
    artifact_type: 'accepted_story_ledger_v1';
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
  artifactType: ApprovalNormalizerArtifactType;
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

function deterministicArtifactId(artifactType: ApprovalNormalizerArtifactType, sourceHash: string): string {
  return `${artifactType}:${sourceHash.slice(0, 16)}`;
}

function buildEnvelope(params: {
  metadata: Phase1aWriterMetadata;
  artifactType: ApprovalNormalizerArtifactType;
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

function isAdminOrOperator(feedback: LedgerUserFeedbackPayload): boolean {
  return feedback.reviewer_role === 'admin' || feedback.reviewer_role === 'operator';
}

function assertCompleteLayerDispositions(feedback: LedgerUserFeedbackPayload): void {
  const dispositionLayers = new Set(feedback.layer_dispositions.map((disposition) => disposition.layer));
  const missing = STORY_LAYER_CORE_LAYER_KEYS.filter((layer) => !dispositionLayers.has(layer));
  if (missing.length > 0) {
    throw new Error(`ledger_user_feedback_v1 is missing layer disposition(s): ${missing.join(', ')}`);
  }
}

function applyUserCorrections(
  rawLayer: StoryLayerPayload,
  corrections: LedgerUserFeedbackPayload['user_corrections'],
): StoryLayerPayload {
  const normalized: Record<string, unknown> = { ...rawLayer };

  for (const [layer, correction] of Object.entries(corrections)) {
    if (!STORY_LAYER_CORE_LAYER_KEYS.includes(layer as StoryLayerCoreLayerKey)) {
      throw new Error(`Correction references non-canonical Story Layer key: ${layer}`);
    }

    normalized[layer] = {
      ...(rawLayer[layer as StoryLayerCoreLayerKey] ?? {}),
      ...correction,
    };
  }

  return validateStoryLayerPayload(normalized);
}

export function buildLedgerUserFeedbackArtifact(params: {
  metadata: Phase1aWriterMetadata;
  feedback: LedgerUserFeedbackPayload;
}): ApprovalNormalizerArtifact<{ feedback: LedgerUserFeedbackPayload }> {
  assertCompleteLayerDispositions(params.feedback);

  const artifact_type = 'ledger_user_feedback_v1';
  const source_hash = sourceHashFor({
    artifactType: artifact_type,
    metadata: params.metadata,
    payload: params.feedback,
  });

  return {
    artifact_type,
    artifact_version: 'v1',
    source_hash,
    content: {
      ...buildEnvelope({ metadata: params.metadata, artifactType: artifact_type, sourceHash: source_hash }),
      feedback: params.feedback,
    },
  };
}

export function buildAcceptedStoryLedgerArtifact(params: {
  metadata: Phase1aWriterMetadata;
  sourceArtifacts: ReviewGateSourceArtifacts;
  feedbackArtifactId: string;
  feedbackSourceHash: string;
  feedback: LedgerUserFeedbackPayload;
}): ApprovalNormalizerArtifact<{ accepted_story_ledger: AcceptedStoryLedgerPayload }> {
  if (params.feedback.review_status === 'rejected') {
    throw new Error('rejected ledger feedback must not write accepted_story_ledger_v1');
  }

  if (params.sourceArtifacts.ledger_quality_report_v1.quality_report.hard_fail_present && !isAdminOrOperator(params.feedback)) {
    throw new Error('Cannot write accepted_story_ledger_v1 while hard fails remain unresolved without admin/operator override');
  }

  if (params.feedback.review_status === 'accepted_with_override' && !isAdminOrOperator(params.feedback)) {
    throw new Error('accepted_with_override may only be written by admin or operator roles');
  }

  const rawLayers = validateStoryLayerPayload(params.sourceArtifacts.pass1a_story_layer_v1.layers);
  const normalizedLayers = applyUserCorrections(rawLayers, params.feedback.user_corrections);
  const overrideApplied = params.feedback.review_status === 'accepted_with_override';

  const acceptedPayload: AcceptedStoryLedgerPayload = {
    approved_by_user_id: params.feedback.reviewer_user_id,
    approval_timestamp: params.metadata.generated_at ?? new Date().toISOString(),
    source_artifacts: {
      pass1a_story_layer_artifact_id: params.sourceArtifacts.pass1a_story_layer_v1.artifact_id,
      pass1a_story_layer_source_hash: params.sourceArtifacts.pass1a_story_layer_v1.source_hash,
      ledger_quality_report_artifact_id: params.sourceArtifacts.ledger_quality_report_v1.artifact_id,
      ledger_quality_report_source_hash: params.sourceArtifacts.ledger_quality_report_v1.source_hash,
      ledger_user_feedback_artifact_id: params.feedbackArtifactId,
      ledger_user_feedback_source_hash: params.feedbackSourceHash,
    },
    normalized_layers: normalizedLayers,
    governance_summary: {
      review_status: params.feedback.review_status,
      warnings_resolved: params.sourceArtifacts.ledger_quality_report_v1.quality_report.blocking_reasons.filter(
        (reason) => !params.feedback.unresolved_warnings.includes(reason),
      ),
      unresolved_warnings: params.feedback.unresolved_warnings,
      admin_override_applied: overrideApplied,
    },
  };

  const artifact_type = 'accepted_story_ledger_v1';
  const source_hash = sourceHashFor({
    artifactType: artifact_type,
    metadata: params.metadata,
    payload: acceptedPayload,
  });

  return {
    artifact_type,
    artifact_version: 'v1',
    source_hash,
    content: {
      ...buildEnvelope({ metadata: params.metadata, artifactType: artifact_type, sourceHash: source_hash }),
      accepted_story_ledger: acceptedPayload,
    },
  };
}

export async function writeReviewGateApprovalArtifacts(params: {
  metadata: Phase1aWriterMetadata;
  sourceArtifacts: ReviewGateSourceArtifacts;
  feedback: LedgerUserFeedbackPayload;
  writeArtifact: ApprovalNormalizerWriter;
}): Promise<ApprovalNormalizerResult> {
  const feedbackArtifact = buildLedgerUserFeedbackArtifact({
    metadata: params.metadata,
    feedback: params.feedback,
  });

  const feedbackWrite = await params.writeArtifact(feedbackArtifact);
  const result: ApprovalNormalizerResult = {
    ledger_user_feedback_v1: {
      artifact_type: 'ledger_user_feedback_v1',
      artifact_id: feedbackWrite.artifact_id,
      source_hash: feedbackArtifact.source_hash,
    },
  };

  if (params.feedback.review_status === 'rejected') {
    return result;
  }

  const acceptedArtifact = buildAcceptedStoryLedgerArtifact({
    metadata: params.metadata,
    sourceArtifacts: params.sourceArtifacts,
    feedbackArtifactId: feedbackWrite.artifact_id,
    feedbackSourceHash: feedbackArtifact.source_hash,
    feedback: params.feedback,
  });

  const acceptedWrite = await params.writeArtifact(acceptedArtifact);
  result.accepted_story_ledger_v1 = {
    artifact_type: 'accepted_story_ledger_v1',
    artifact_id: acceptedWrite.artifact_id,
    source_hash: acceptedArtifact.source_hash,
  };

  return result;
}

export function assertPhase2StoryAuthority(artifactType: string): void {
  if (artifactType !== 'accepted_story_ledger_v1') {
    throw new Error('Phase 2 requires accepted_story_ledger_v1 as its only story-understanding authority');
  }
}
