import type { EvaluationResultV2 } from '@/schemas/evaluation-result-v2';

export type FinalExternalAuditPacket = {
  schema_version: 'final_external_audit_packet_v1';
  evaluation_summary: {
    overall_score_0_100: number | null;
    verdict: string | null;
    criteria: Array<{
      key: string;
      score_0_10: number | null;
      status: string | null;
      confidence_level: string | null;
      anchor_count: number;
    }>;
  };
  quality_gate: unknown;
  provider_telemetry: unknown;
  coverage_summary: unknown;
  checked_artifacts: Record<string, { present: boolean; metadata?: Record<string, unknown> }>;
  representative_evidence_anchors: string[];
  known_risk_signals: string[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function compactAnchor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (trimmed.length < 12) return null;
  return trimmed.slice(0, 280);
}

export function buildFinalExternalAuditPacket(input: {
  evaluationResult: EvaluationResultV2 | Record<string, unknown>;
  checkedArtifacts: Record<string, { present: boolean; metadata?: Record<string, unknown> }>;
  providerTelemetry?: unknown;
  qualityGate?: unknown;
  maxAnchors?: number;
}): FinalExternalAuditPacket {
  const result = input.evaluationResult as EvaluationResultV2;
  const criteria = Array.isArray(result.criteria) ? result.criteria : [];
  const maxAnchors = input.maxAnchors ?? 40;

  const anchors = criteria
    .flatMap((criterion) => Array.isArray(criterion.evidence) ? criterion.evidence : [])
    .map((anchor) => compactAnchor(asRecord(anchor)?.snippet))
    .filter((anchor): anchor is string => Boolean(anchor))
    .slice(0, maxAnchors);

  const coverageSummary = result.governance?.transparency?.coverage_summary ?? null;
  const riskSignals = [
    ...(criteria.some((criterion) => criterion.scorability_status === 'non_scorable') ? ['NON_SCORABLE_CRITERIA_PRESENT'] : []),
    ...(criteria.some((criterion) => criterion.confidence_level === 'low') ? ['LOW_CONFIDENCE_CRITERIA_PRESENT'] : []),
    ...(anchors.length < Math.min(criteria.length, 13) ? ['LOW_ANCHOR_COVERAGE'] : []),
  ];

  return {
    schema_version: 'final_external_audit_packet_v1',
    evaluation_summary: {
      overall_score_0_100: typeof result.overview?.overall_score_0_100 === 'number' ? result.overview.overall_score_0_100 : null,
      verdict: typeof result.overview?.verdict === 'string' ? result.overview.verdict : null,
      criteria: criteria.map((criterion) => ({
        key: String(criterion.key),
        score_0_10: typeof criterion.score_0_10 === 'number' ? criterion.score_0_10 : null,
        status: typeof criterion.status === 'string' ? criterion.status : null,
        confidence_level: typeof criterion.confidence_level === 'string' ? criterion.confidence_level : null,
        anchor_count: Array.isArray(criterion.evidence) ? criterion.evidence.length : 0,
      })),
    },
    quality_gate: input.qualityGate ?? result.governance?.transparency?.backward_relook ?? null,
    provider_telemetry: input.providerTelemetry ?? result.governance?.provider_telemetry ?? null,
    coverage_summary: coverageSummary,
    checked_artifacts: input.checkedArtifacts,
    representative_evidence_anchors: anchors,
    known_risk_signals: riskSignals,
  };
}

export function buildFinalExternalAuditPrompt(packet: FinalExternalAuditPacket): string {
  return [
    'You are RevisionGrade final external audit. You are an auditor, not an author-facing prose writer.',
    'Return ONLY compact JSON with: verdict, codes, reason, contradictions.',
    'Allowed verdicts: PASS, WARN, BLOCK.',
    'Allowed codes: FINAL_AUDIT_SAFE_TO_RELEASE, FINAL_AUDIT_PROVIDER_UNAVAILABLE, FINAL_AUDIT_MISSING_DREAM, FINAL_AUDIT_MISSING_WAVE, FINAL_AUDIT_MISSING_PHASE5, FINAL_AUDIT_LOW_COVERAGE, FINAL_AUDIT_CONTRADICTION, FINAL_AUDIT_SCHEMA_INVALID.',
    'BLOCK only for missing required artifacts, contradiction, low coverage, or schema invalidity. Do not write literary feedback.',
    'Audit packet JSON:',
    JSON.stringify(packet),
  ].join('\n');
}
