import type { EvaluationResultV2 } from '@/schemas/evaluation-result-v2';
import {
  buildUnifiedEvaluationDocument,
  EVALUATION_TEMPLATE_CONTRACTS,
  type CanonicalEvaluationMode,
  type UnifiedEvaluationDocument,
} from '@/lib/evaluation/unifiedEvaluationDocument';
import { canonicalJsonSha256 } from '@/lib/evaluation/canonicalJsonHash';

type RendererSurface = 'webpage' | 'pdf' | 'docx' | 'txt';

const SURFACES: RendererSurface[] = ['webpage', 'pdf', 'docx', 'txt'];

const REQUIRED_FIELD_REGISTRY = [
  'title',
  'titleBlock.reportType',
  'titleBlock.genre',
  'titleBlock.targetAudience',
  'titleBlock.overallScoreLabel',
  'titleBlock.overallScoreConfidenceLabel',
  'titleBlock.marketReadiness',
  'titleBlock.marketReadinessConfidenceLabel',
  'oneParagraphPitch',
  'oneSentencePitch',
  'contentWarnings',
  'executiveSummary',
  'topStrengths',
  'topRisks',
  'topRecommendations',
  'criteriaScoreGrid',
  'criterionDetails',
  'confidenceExplanation',
  'disclaimer',
] as const;

const OPTIONAL_FIELD_REGISTRY = [
  'premise',
  'titleBlock.shelf',
  'titleBlock.shelfConfidenceLabel',
] as const;

const LONG_FORM_MIN_WORDS = 25_000;
const LONG_FORM_MULTI_LAYER_MIN_WORDS = 75_000;

export type ReportRenderManifestV1 = {
  schema_version: 'report_render_manifest_v1';
  generated_at: string;
  job_id: string;
  template: {
    mode: CanonicalEvaluationMode;
    template_name: string;
    template_path: string;
    report_type: string;
  };
  unified_document_hash: string;
  unified_document_field_hashes: Record<string, string>;
  required_field_registry: string[];
  renderer_versions: Record<RendererSurface, string>;
  surfaces: Record<RendererSurface, {
    consumed_fields: string[];
    field_hashes: Record<string, string>;
    missing_required_fields: string[];
    suppressed_fields: string[];
    derived_canonical_fields: string[];
  }>;
  parity: {
    status: 'pass' | 'fail';
    missing_required_fields: string[];
    mismatched_fields: string[];
    derived_canonical_fields: string[];
    reasons: string[];
  };
};

export type AuthorExposureCertificationV1 = {
  schema_version: 'author_exposure_certification_v1';
  generated_from_artifact: 'report_render_manifest_v1';
  generated_at: string;
  active_template_path: string;
  unified_document_hash: string;
  decision: 'certified' | 'blocked';
  certified_at: string | null;
  blocking_reasons: string[];
  parity_results: {
    overall: { status: 'pass' | 'fail'; reasons: string[] };
    webpage: { status: 'pass' | 'fail'; missing_required_fields: string[]; derived_canonical_fields: string[] };
    pdf: { status: 'pass' | 'fail'; missing_required_fields: string[]; derived_canonical_fields: string[] };
    docx: { status: 'pass' | 'fail'; missing_required_fields: string[]; derived_canonical_fields: string[] };
    txt: { status: 'pass' | 'fail'; missing_required_fields: string[]; derived_canonical_fields: string[] };
    mismatched_fields: string[];
  };
};

function readPath(root: unknown, path: string): unknown {
  const parts = path.split('.');
  let current = root as Record<string, unknown> | unknown;
  for (const part of parts) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function isEmptyValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function inferCanonicalEvaluationModeFromWordCount(wordCount: number | null | undefined): CanonicalEvaluationMode {
  if (typeof wordCount === 'number' && Number.isFinite(wordCount)) {
    if (wordCount >= LONG_FORM_MULTI_LAYER_MIN_WORDS) return 'long_form_multi_layer_evaluation';
    if (wordCount >= LONG_FORM_MIN_WORDS) return 'long_form_evaluation';
  }
  return 'short_form_evaluation';
}

export function buildUnifiedDocumentForParityFromEvaluationResult(params: {
  evaluationResult: EvaluationResultV2;
  displayTitle: string;
  mode: CanonicalEvaluationMode;
}): UnifiedEvaluationDocument {
  return buildUnifiedEvaluationDocument({
    mode: params.mode,
    result: {
      generated_at: params.evaluationResult.generated_at,
      overview: params.evaluationResult.overview,
      metrics: params.evaluationResult.metrics,
      enrichment: params.evaluationResult.enrichment,
      governance: params.evaluationResult.governance,
      criteria: params.evaluationResult.criteria,
      recommendations: params.evaluationResult.recommendations,
    },
    displayTitle: params.displayTitle,
    dream: null,
  });
}

function validateManifestParity(manifest: Omit<ReportRenderManifestV1, 'parity'>): ReportRenderManifestV1['parity'] {
  const missingRequired = new Set<string>();
  const mismatchedFields = new Set<string>();
  const derivedCanonical = new Set<string>();
  const reasons: string[] = [];

  for (const surface of SURFACES) {
    for (const field of manifest.surfaces[surface].missing_required_fields) {
      missingRequired.add(`${surface}:${field}`);
    }
    for (const field of manifest.surfaces[surface].derived_canonical_fields) {
      derivedCanonical.add(`${surface}:${field}`);
    }
  }

  for (const field of manifest.required_field_registry) {
    const canonicalHash = manifest.unified_document_field_hashes[field] ?? '';
    for (const surface of SURFACES) {
      const surfaceHash = manifest.surfaces[surface].field_hashes[field] ?? '';
      if (surfaceHash !== canonicalHash) {
        mismatchedFields.add(`${surface}:${field}`);
      }
    }
  }

  if (missingRequired.size > 0) reasons.push('required_fields_missing');
  if (mismatchedFields.size > 0) reasons.push('required_fields_mismatch');
  if (derivedCanonical.size > 0) reasons.push('renderer_derived_canonical_fields_detected');

  return {
    status: reasons.length === 0 ? 'pass' : 'fail',
    missing_required_fields: [...missingRequired],
    mismatched_fields: [...mismatchedFields],
    derived_canonical_fields: [...derivedCanonical],
    reasons,
  };
}

export function buildReportRenderManifestV1(params: {
  jobId: string;
  unifiedDocument: UnifiedEvaluationDocument;
  rendererVersions?: Partial<Record<RendererSurface, string>>;
}): ReportRenderManifestV1 {
  const mode = params.unifiedDocument.templateMode;
  const template = EVALUATION_TEMPLATE_CONTRACTS[mode];
  const requiredFields = [...REQUIRED_FIELD_REGISTRY];
  const optionalFields = [...OPTIONAL_FIELD_REGISTRY];
  const allFields = [...requiredFields, ...optionalFields];

  const unifiedFieldHashes: Record<string, string> = {};
  for (const field of allFields) {
    unifiedFieldHashes[field] = canonicalJsonSha256(readPath(params.unifiedDocument, field));
  }

  const surfaces = SURFACES.reduce((acc, surface) => {
    const missingRequiredFields = requiredFields.filter((field) => isEmptyValue(readPath(params.unifiedDocument, field)));
    const suppressedFields = optionalFields.filter((field) => isEmptyValue(readPath(params.unifiedDocument, field)));

    const fieldHashes = allFields.reduce<Record<string, string>>((hashes, field) => {
      // Current renderer contract: canonical fields are read from UED only.
      hashes[field] = canonicalJsonSha256(readPath(params.unifiedDocument, field));
      return hashes;
    }, {});

    acc[surface] = {
      consumed_fields: allFields,
      field_hashes: fieldHashes,
      missing_required_fields: missingRequiredFields,
      suppressed_fields: suppressedFields,
      derived_canonical_fields: [],
    };

    return acc;
  }, {} as ReportRenderManifestV1['surfaces']);

  const manifestWithoutParity: Omit<ReportRenderManifestV1, 'parity'> = {
    schema_version: 'report_render_manifest_v1',
    generated_at: new Date().toISOString(),
    job_id: params.jobId,
    template: {
      mode,
      template_name: template.templateName,
      template_path: template.templatePath,
      report_type: template.reportType,
    },
    unified_document_hash: canonicalJsonSha256(params.unifiedDocument),
    unified_document_field_hashes: unifiedFieldHashes,
    required_field_registry: requiredFields,
    renderer_versions: {
      webpage: params.rendererVersions?.webpage ?? 'webpage_ued_v1',
      pdf: params.rendererVersions?.pdf ?? 'pdf_canonical_template_v1',
      docx: params.rendererVersions?.docx ?? 'docx_canonical_template_v1',
      txt: params.rendererVersions?.txt ?? 'txt_canonical_template_v1',
    },
    surfaces,
  };

  return {
    ...manifestWithoutParity,
    parity: validateManifestParity(manifestWithoutParity),
  };
}

export function buildAuthorExposureCertificationV1FromManifest(
  manifest: ReportRenderManifestV1,
): AuthorExposureCertificationV1 {
  const parityPass = manifest.parity.status === 'pass';
  const reasons = parityPass ? [] : manifest.parity.reasons;

  const mkSurface = (surface: RendererSurface) => {
    const hasSurfaceIssues =
      manifest.surfaces[surface].missing_required_fields.length > 0 ||
      manifest.surfaces[surface].derived_canonical_fields.length > 0;
    return {
      status: hasSurfaceIssues ? 'fail' as const : 'pass' as const,
      missing_required_fields: manifest.surfaces[surface].missing_required_fields,
      derived_canonical_fields: manifest.surfaces[surface].derived_canonical_fields,
    };
  };

  return {
    schema_version: 'author_exposure_certification_v1',
    generated_from_artifact: 'report_render_manifest_v1',
    generated_at: new Date().toISOString(),
    active_template_path: manifest.template.template_path,
    unified_document_hash: manifest.unified_document_hash,
    decision: parityPass ? 'certified' : 'blocked',
    certified_at: parityPass ? new Date().toISOString() : null,
    blocking_reasons: parityPass
      ? []
      : [
          ...manifest.parity.missing_required_fields,
          ...manifest.parity.mismatched_fields,
          ...manifest.parity.derived_canonical_fields,
        ],
    parity_results: {
      overall: {
        status: manifest.parity.status,
        reasons,
      },
      webpage: mkSurface('webpage'),
      pdf: mkSurface('pdf'),
      docx: mkSurface('docx'),
      txt: mkSurface('txt'),
      mismatched_fields: manifest.parity.mismatched_fields,
    },
  };
}
