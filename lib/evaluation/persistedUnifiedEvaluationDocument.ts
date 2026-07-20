import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { canonicalJsonSha256 } from '@/lib/evaluation/canonicalJsonHash';
import type { UnifiedEvaluationDocument } from '@/lib/evaluation/unifiedEvaluationDocument';

export type PersistedUnifiedEvaluationDocumentLoadResult =
  | {
      ok: true;
      source: 'persisted_artifact';
      document: UnifiedEvaluationDocument;
      unifiedDocumentHash: string;
    }
  | {
      ok: false;
      reason:
        | 'missing_unified_document_artifact'
        | 'invalid_unified_document_artifact'
        | 'missing_certification_artifact'
        | 'invalid_certification_artifact'
        | 'certification_hash_mismatch'
        | 'db_error';
      details?: string;
    };

type ArtifactRow = { content?: unknown | null } | null;

type CertificationContent = {
  schema_version?: unknown;
  decision?: unknown;
  unified_document_hash?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function isUnifiedEvaluationDocument(value: unknown): value is UnifiedEvaluationDocument {
  if (!isRecord(value)) return false;
  const titleBlock = isRecord(value.titleBlock) ? value.titleBlock : null;
  const modeSpecific = isRecord(value.modeSpecific) ? value.modeSpecific : null;
  const canonicalOpportunityLedger = isRecord(value.canonicalOpportunityLedger)
    ? value.canonicalOpportunityLedger
    : null;

  return (
    (value.templateMode === 'short_form_evaluation' ||
      value.templateMode === 'long_form_evaluation' ||
      value.templateMode === 'long_form_multi_layer_evaluation') &&
    typeof value.title === 'string' &&
    !!titleBlock &&
    typeof titleBlock.reportType === 'string' &&
    typeof titleBlock.overallScoreLabel === 'string' &&
    typeof titleBlock.marketReadiness === 'string' &&
    typeof value.oneParagraphPitch === 'string' &&
    typeof value.oneSentencePitch === 'string' &&
    isStringArray(value.contentWarnings) &&
    typeof value.executiveSummary === 'string' &&
    isStringArray(value.topStrengths) &&
    isStringArray(value.topRisks) &&
    isStringArray(value.topRecommendations) &&
    !!canonicalOpportunityLedger &&
    Array.isArray(canonicalOpportunityLedger.opportunities) &&
    Array.isArray(canonicalOpportunityLedger.rendered_opportunities) &&
    (canonicalOpportunityLedger.disposition_contract_version == null ||
      (canonicalOpportunityLedger.disposition_contract_version === 'recommendation_disposition_v1' &&
        canonicalOpportunityLedger.source_identity_version === 'criterion_content_fingerprint_v1' &&
        Array.isArray(canonicalOpportunityLedger.source_recommendation_ids) &&
        Array.isArray(canonicalOpportunityLedger.recommendation_dispositions))) &&
    Array.isArray(value.criteriaScoreGrid) &&
    Array.isArray(value.criterionDetails) &&
    typeof value.confidenceExplanation === 'string' &&
    typeof value.disclaimer === 'string' &&
    !!modeSpecific &&
    isStringArray(modeSpecific.manuscriptScaleContinuityFindings) &&
    Array.isArray(modeSpecific.revisionPriorityPlan) &&
    isStringArray(modeSpecific.storyLedgerArchitectureMap) &&
    isStringArray(modeSpecific.reviewGateReadinessSurface) &&
    isStringArray(modeSpecific.governedLedgerAddenda) &&
    isStringArray(modeSpecific.crossLayerSynthesis) &&
    isStringArray(modeSpecific.layerAwareRevisionSequencing) &&
    isStringArray(modeSpecific.continuityCoverageProof) &&
    typeof modeSpecific.readinessReleasabilityPosture === 'string'
  );
}

function getCertificationContent(value: unknown): CertificationContent | null {
  return isRecord(value) ? (value as CertificationContent) : null;
}

export async function loadCertifiedUnifiedEvaluationDocumentArtifact(
  supabase: SupabaseClient,
  jobId: string,
): Promise<PersistedUnifiedEvaluationDocumentLoadResult> {
  const [{ data: unifiedRow, error: unifiedError }, { data: certificationRow, error: certificationError }] = await Promise.all([
    supabase
      .from('evaluation_artifacts')
      .select('content')
      .eq('job_id', jobId)
      .eq('artifact_type', 'unified_evaluation_document_v1')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('evaluation_artifacts')
      .select('content')
      .eq('job_id', jobId)
      .eq('artifact_type', 'author_exposure_certification_v1')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (unifiedError || certificationError) {
    return {
      ok: false,
      reason: 'db_error',
      details: unifiedError?.message ?? certificationError?.message,
    };
  }

  const unifiedContent = (unifiedRow as ArtifactRow)?.content;
  if (!unifiedContent) {
    return { ok: false, reason: 'missing_unified_document_artifact' };
  }

  if (!isUnifiedEvaluationDocument(unifiedContent)) {
    return { ok: false, reason: 'invalid_unified_document_artifact' };
  }

  const certificationContent = getCertificationContent((certificationRow as ArtifactRow)?.content);
  if (!certificationContent) {
    return { ok: false, reason: 'missing_certification_artifact' };
  }

  if (
    certificationContent.schema_version !== 'author_exposure_certification_v1' ||
    certificationContent.decision !== 'certified' ||
    typeof certificationContent.unified_document_hash !== 'string' ||
    certificationContent.unified_document_hash.trim().length === 0
  ) {
    return { ok: false, reason: 'invalid_certification_artifact' };
  }

  const unifiedDocumentHash = canonicalJsonSha256(unifiedContent);
  if (unifiedDocumentHash !== certificationContent.unified_document_hash) {
    return {
      ok: false,
      reason: 'certification_hash_mismatch',
      details: `expected=${certificationContent.unified_document_hash} actual=${unifiedDocumentHash}`,
    };
  }

  return {
    ok: true,
    source: 'persisted_artifact',
    document: unifiedContent,
    unifiedDocumentHash,
  };
}
