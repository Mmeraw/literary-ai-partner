import type { EvaluationResultV2 } from '@/schemas/evaluation-result-v2';
import {
  buildUnifiedEvaluationDocument,
  EVALUATION_TEMPLATE_CONTRACTS,
  type CanonicalEvaluationMode,
  type UnifiedEvaluationDocument,
} from '@/lib/evaluation/unifiedEvaluationDocument';
import { canonicalJsonSha256 } from '@/lib/evaluation/canonicalJsonHash';
import { mistakeProofText } from '@/lib/evaluation/reportRenderSafety';

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
    measurement_mode?: 'declared_canonical_consumption' | 'measured_renderer_output';
    measured_output_hash?: string;
    measured_output_length?: number;
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
  dcip_compliance: {
    status: 'pass' | 'fail';
    canonical_path: string;
    evidence: string[];
    reasons: string[];
  };
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

function normalizeMeasuredText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function flattenRenderablePrimitives(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === 'string') return value.trim().length > 0 ? [value] : [];
  if (typeof value === 'number' || typeof value === 'boolean') return [String(value)];

  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenRenderablePrimitives(item));
  }

  if (typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .flatMap((key) => flattenRenderablePrimitives((value as Record<string, unknown>)[key]));
  }

  return [];
}

function renderableFragmentsForField(path: string, value: unknown): string[] {
  if (path === 'criteriaScoreGrid' && Array.isArray(value)) {
    return value.flatMap((row) => {
      if (!row || typeof row !== 'object') return [];
      const record = row as Record<string, unknown>;
      return [record.label, record.scoreLabel, record.confidenceLabel].flatMap((fragment) => flattenRenderablePrimitives(fragment));
    });
  }

  if (path === 'criterionDetails' && Array.isArray(value)) {
    return value.flatMap((detail) => {
      if (!detail || typeof detail !== 'object') return [];
      const record = detail as Record<string, unknown>;
      const recommendationFragments = Array.isArray(record.recommendations)
        ? record.recommendations.flatMap((recommendation) => {
            if (!recommendation || typeof recommendation !== 'object') return [];
            const rec = recommendation as Record<string, unknown>;
            return [
              rec.anchor_snippet,
              rec.symptom,
              rec.mechanism,
              rec.specific_fix || rec.action,
              rec.reader_effect || rec.expected_impact,
              rec.mistake_proofing,
              rec.collapsed_from_criteria,
            ].flatMap((fragment) => flattenRenderablePrimitives(fragment));
          })
        : [];

      return [
        record.label,
        record.scoreLabel,
        record.confidenceLabel,
        record.supportLabel,
        record.rationaleLabel,
        record.rationaleText,
        ...recommendationFragments,
      ].flatMap((fragment) => flattenRenderablePrimitives(fragment));
    });
  }

  return flattenRenderablePrimitives(value);
}

function measuredOutputContainsField(output: string, path: string, value: unknown): boolean {
  const normalizedOutput = normalizeMeasuredText(output);
  const requiredFragments = renderableFragmentsForField(path, value)
    .map((fragment) => mistakeProofText(fragment, ''))
    .map((fragment) => normalizeMeasuredText(fragment))
    .filter((fragment) => fragment.length > 0 && fragment !== 'not available');

  if (requiredFragments.length === 0) return false;
  return requiredFragments.every((fragment) => normalizedOutput.includes(fragment));
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
  /**
   * Optional measured text extracted from the actual renderer output for each
   * author-facing surface. PDF should pass the HTML source sent to Chromium;
   * DOCX should pass text extracted from the generated DOCX package; TXT should
   * pass the exact download body; webpage should pass rendered/server HTML text.
   */
  rendererOutputs?: Partial<Record<RendererSurface, string>>;
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
    const measuredOutput = params.rendererOutputs?.[surface];
    const missingRequiredFields = requiredFields.filter((field) => {
      const canonicalValue = readPath(params.unifiedDocument, field);
      if (isEmptyValue(canonicalValue)) return true;
      if (typeof measuredOutput === 'string') {
        return !measuredOutputContainsField(measuredOutput, field, canonicalValue);
      }
      return false;
    });
    const suppressedFields = optionalFields.filter((field) => isEmptyValue(readPath(params.unifiedDocument, field)));

    const fieldHashes = allFields.reduce<Record<string, string>>((hashes, field) => {
      const canonicalValue = readPath(params.unifiedDocument, field);
      // Measured mode proves the actual renderer output contains every primitive
      // fragment of the canonical field before assigning the canonical hash.
      // Declared mode is retained for the existing runtime pipeline until each
      // surface can provide measured output during Phase 5 artifact persistence.
      hashes[field] = typeof measuredOutput === 'string' && !measuredOutputContainsField(measuredOutput, field, canonicalValue)
        ? ''
        : canonicalJsonSha256(canonicalValue);
      return hashes;
    }, {});

    acc[surface] = {
      measurement_mode: typeof measuredOutput === 'string' ? 'measured_renderer_output' : 'declared_canonical_consumption',
      measured_output_hash: typeof measuredOutput === 'string' ? canonicalJsonSha256(measuredOutput) : undefined,
      measured_output_length: typeof measuredOutput === 'string' ? measuredOutput.length : undefined,
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

  const canonicalDcipPath = 'docs/governance/DREAM-COGNITIVE-INITIALIZATION-PROTOCOL-V1.md';
  const dcipEvidence = [
    `template_mode:${manifest.template.mode}`,
    `template_path:${manifest.template.template_path}`,
    `unified_document_hash:${manifest.unified_document_hash}`,
  ];
  const dcipReasons: string[] = [];
  if (!manifest.template.template_path || manifest.template.template_path.trim().length === 0) {
    dcipReasons.push('dcip_missing_template_path');
  }
  if (!manifest.unified_document_hash || manifest.unified_document_hash.trim().length === 0) {
    dcipReasons.push('dcip_missing_unified_document_hash');
  }
  const dcipPass = dcipReasons.length === 0;

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

  const certified = parityPass && dcipPass;

  return {
    schema_version: 'author_exposure_certification_v1',
    generated_from_artifact: 'report_render_manifest_v1',
    generated_at: new Date().toISOString(),
    active_template_path: manifest.template.template_path,
    unified_document_hash: manifest.unified_document_hash,
    decision: certified ? 'certified' : 'blocked',
    certified_at: certified ? new Date().toISOString() : null,
    blocking_reasons: [
      ...(parityPass
        ? []
        : [
            ...manifest.parity.missing_required_fields,
            ...manifest.parity.mismatched_fields,
            ...manifest.parity.derived_canonical_fields,
          ]),
      ...dcipReasons,
    ],
    dcip_compliance: {
      status: dcipPass ? 'pass' : 'fail',
      canonical_path: canonicalDcipPath,
      evidence: dcipEvidence,
      reasons: dcipReasons,
    },
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
