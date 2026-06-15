import {
  ARTIFACT_REGISTRY,
  type ArtifactRegistryEntry,
} from './fipocRegistry';

export const EVALUATE_ARTIFACT_QUALITY_THRESHOLD = 95 as const;
export const EVALUATE_ARTIFACT_QUALITY_OBSERVABILITY_TARGET = EVALUATE_ARTIFACT_QUALITY_THRESHOLD;

export type ArtifactContractStatus = 'clean' | 'degraded' | 'blocked' | 'registry_missing';

export type ArtifactQualityIssueCode =
  | 'ARTIFACT_NOT_OBJECT'
  | 'REGISTRY_CONTRACT_INCOMPLETE'
  | 'SIPOC_METRIC_MISSING'
  | 'REQUIRED_FIELD_MISSING'
  | 'REQUIRED_FIELD_EMPTY'
  | 'BLOCKING_ARTIFACT_SIGNAL'
  | 'AUTHOR_EXPOSURE_CRITICAL_GAP';

export type ArtifactQualityIssue = {
  code: ArtifactQualityIssueCode;
  artifact: string;
  path: string;
  message: string;
  penalty: number;
};

export type ArtifactQualityCertification = {
  artifact: string;
  score_0_100: number;
  threshold_0_100: typeof EVALUATE_ARTIFACT_QUALITY_THRESHOLD;
  certified: boolean;
  contract_status: ArtifactContractStatus;
  sipoc_metrics: {
    producer_stage_id: string | null;
    consumer_stage_ids: string[];
    completeness_metric: string | null;
    accuracy_metric: string | null;
    dirty_data_rule: string | null;
    regeneration_owner_stage_id: string | null;
    required_for_author_exposure: boolean;
    fit_gap_status: string | null;
  };
  issues: ArtifactQualityIssue[];
};

const REQUIRED_REGISTRY_TEXT_FIELDS: Array<keyof ArtifactRegistryEntry> = [
  'artifact',
  'producerStageId',
  'completenessMetric',
  'accuracyMetric',
  'dirtyDataRule',
  'regenerationOwnerStageId',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.some(hasMeaningfulValue);
  if (isRecord(value)) return Object.keys(value).length > 0;
  return false;
}

function normalizeFieldName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\[\]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function leafPathCandidates(requiredField: string): string[] {
  const normalized = normalizeFieldName(requiredField);
  const parts = normalized.split('_').filter(Boolean);
  const candidates = new Set<string>([normalized]);
  if (parts.length > 1) candidates.add(parts[parts.length - 1]);
  if (requiredField.includes('.')) {
    const leaf = requiredField.split('.').pop();
    if (leaf) candidates.add(normalizeFieldName(leaf));
  }
  return [...candidates].filter(Boolean);
}

function findFieldValue(payload: unknown, requiredField: string): unknown {
  if (!isRecord(payload)) return undefined;

  const directPath = requiredField
    .replace(/\[\]/g, '')
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean);

  if (directPath.length > 1) {
    let current: unknown = payload;
    for (const part of directPath) {
      if (!isRecord(current)) {
        current = undefined;
        break;
      }
      current = current[part];
    }
    if (hasMeaningfulValue(current)) return current;
  }

  const candidates = new Set(leafPathCandidates(requiredField));
  const stack: unknown[] = [payload];
  while (stack.length > 0) {
    const current = stack.pop();
    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }
    if (!isRecord(current)) continue;

    for (const [key, value] of Object.entries(current)) {
      if (candidates.has(normalizeFieldName(key))) return value;
      if (isRecord(value) || Array.isArray(value)) stack.push(value);
    }
  }

  return undefined;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function sipocMetricsFor(entry: ArtifactRegistryEntry | undefined): ArtifactQualityCertification['sipoc_metrics'] {
  return {
    producer_stage_id: entry?.producerStageId ?? null,
    consumer_stage_ids: entry?.consumerStageIds ?? [],
    completeness_metric: entry?.completenessMetric ?? null,
    accuracy_metric: entry?.accuracyMetric ?? null,
    dirty_data_rule: entry?.dirtyDataRule ?? null,
    regeneration_owner_stage_id: entry?.regenerationOwnerStageId ?? null,
    required_for_author_exposure: Boolean(entry?.requiredForAuthorExposure),
    fit_gap_status: entry?.fitGapStatus ?? null,
  };
}

function contractStatusFor(input: {
  entry?: ArtifactRegistryEntry;
  issues: ArtifactQualityIssue[];
}): ArtifactContractStatus {
  if (!input.entry) return 'registry_missing';
  if (input.issues.some((issue) => issue.code === 'BLOCKING_ARTIFACT_SIGNAL')) return 'blocked';
  if (input.issues.length > 0) return 'degraded';
  return 'clean';
}

function hasBlockingArtifactSignal(content: unknown): boolean {
  if (!isRecord(content)) return false;
  const values = [
    content.blocking,
    content.verdict,
    content.overallStatus,
    content.dialogueStatus,
    content.gate_ready_status,
    content.status,
  ];
  return values.some((value) =>
    value === true ||
    (typeof value === 'string' && ['block', 'blocked', 'fail', 'failed', 'repair_required'].includes(value.trim().toLowerCase())),
  );
}

export function evaluateArtifactRegistryContractQuality(
  entry: ArtifactRegistryEntry,
): ArtifactQualityCertification {
  const issues: ArtifactQualityIssue[] = [];

  for (const field of REQUIRED_REGISTRY_TEXT_FIELDS) {
    if (!hasMeaningfulValue(entry[field])) {
      issues.push({
        code: 'REGISTRY_CONTRACT_INCOMPLETE',
        artifact: entry.artifact,
        path: `registry.${field}`,
        message: `${entry.artifact} registry field ${field} must be populated.`,
        penalty: 10,
      });
    }
  }

  if (!Array.isArray(entry.requiredFields) || entry.requiredFields.length === 0) {
    issues.push({
      code: 'REGISTRY_CONTRACT_INCOMPLETE',
      artifact: entry.artifact,
      path: 'registry.requiredFields',
      message: `${entry.artifact} must declare required fields.`,
      penalty: 20,
    });
  }

  if (!Array.isArray(entry.consumerStageIds) || entry.consumerStageIds.length === 0) {
    issues.push({
      code: 'REGISTRY_CONTRACT_INCOMPLETE',
      artifact: entry.artifact,
      path: 'registry.consumerStageIds',
      message: `${entry.artifact} must declare at least one consumer.`,
      penalty: 10,
    });
  }

  if (entry.requiredForAuthorExposure && entry.fitGapStatus === 'critical') {
    issues.push({
      code: 'AUTHOR_EXPOSURE_CRITICAL_GAP',
      artifact: entry.artifact,
      path: 'registry.fitGapStatus',
      message: `${entry.artifact} is required for author exposure and still marked critical. Runtime must block or certify before release.`,
      penalty: 0,
    });
  }

  const score = clampScore(100 - issues.reduce((sum, issue) => sum + issue.penalty, 0));
  const contractStatus = contractStatusFor({ entry, issues });
  return {
    artifact: entry.artifact,
    score_0_100: score,
    threshold_0_100: EVALUATE_ARTIFACT_QUALITY_THRESHOLD,
    certified: contractStatus === 'clean',
    contract_status: contractStatus,
    sipoc_metrics: sipocMetricsFor(entry),
    issues,
  };
}

export function evaluateArtifactPayloadQuality(params: {
  artifact: string;
  content: unknown;
  registryEntry?: ArtifactRegistryEntry;
}): ArtifactQualityCertification {
  const entry = params.registryEntry ?? ARTIFACT_REGISTRY.find((candidate) => candidate.artifact === params.artifact);
  const issues: ArtifactQualityIssue[] = [];

  if (!isRecord(params.content)) {
    issues.push({
      code: 'ARTIFACT_NOT_OBJECT',
      artifact: params.artifact,
      path: '$',
      message: `${params.artifact} content must be a JSON object.`,
      penalty: 100,
    });
  }

  if (entry) {
    for (const metricField of ['completenessMetric', 'accuracyMetric', 'dirtyDataRule'] as const) {
      if (!hasMeaningfulValue(entry[metricField])) {
        issues.push({
          code: 'SIPOC_METRIC_MISSING',
          artifact: params.artifact,
          path: `registry.${metricField}`,
          message: `${params.artifact} is missing required SIPOC/FIPOC metric ${metricField}.`,
          penalty: 25,
        });
      }
    }

    const perFieldPenalty = Math.max(8, Math.ceil(100 / Math.max(entry.requiredFields.length, 1)));
    for (const requiredField of entry.requiredFields) {
      const value = findFieldValue(params.content, requiredField);
      if (value === undefined) {
        issues.push({
          code: 'REQUIRED_FIELD_MISSING',
          artifact: params.artifact,
          path: requiredField,
          message: `${params.artifact} is missing required field ${requiredField}.`,
          penalty: perFieldPenalty,
        });
      } else if (!hasMeaningfulValue(value)) {
        issues.push({
          code: 'REQUIRED_FIELD_EMPTY',
          artifact: params.artifact,
          path: requiredField,
          message: `${params.artifact} has empty required field ${requiredField}.`,
          penalty: perFieldPenalty,
        });
      }
    }
  } else {
    issues.push({
      code: 'REGISTRY_CONTRACT_INCOMPLETE',
      artifact: params.artifact,
      path: 'registry',
      message: `${params.artifact} has no ARTIFACT_REGISTRY contract; SIPOC metrics are unavailable.`,
      penalty: 30,
    });
  }

  if (hasBlockingArtifactSignal(params.content)) {
    issues.push({
      code: 'BLOCKING_ARTIFACT_SIGNAL',
      artifact: params.artifact,
      path: '$.blocking|$.verdict|$.status',
      message: `${params.artifact} contains a blocking/failing status signal; it must not be treated as clean regardless of structural completeness.`,
      penalty: 100,
    });
  }

  const score = clampScore(100 - issues.reduce((sum, issue) => sum + issue.penalty, 0));
  const contractStatus = contractStatusFor({ entry, issues });
  return {
    artifact: params.artifact,
    score_0_100: score,
    threshold_0_100: EVALUATE_ARTIFACT_QUALITY_THRESHOLD,
    certified: contractStatus === 'clean',
    contract_status: contractStatus,
    sipoc_metrics: sipocMetricsFor(entry),
    issues,
  };
}

export function evaluateAllArtifactRegistryContracts(): ArtifactQualityCertification[] {
  return ARTIFACT_REGISTRY.map(evaluateArtifactRegistryContractQuality);
}
