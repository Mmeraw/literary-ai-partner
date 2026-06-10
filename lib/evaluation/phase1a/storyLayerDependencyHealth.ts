import type { Pass1aCharacterLedger, CharacterLedgerV2, RecommendationBlocker } from '@/lib/evaluation/pipeline/types';
import type { StoryLayerCoreLayerKey } from '@/lib/evaluation/artifacts/artifactTypes';

export const CANONICAL_IDENTITY_DEPENDENT_LAYER_KEYS = [
  'cast_role_tier_layer',
  'identity_pronoun_layer',
  'pov_structure_layer',
  'relationship_network_layer',
  'object_symbol_layer',
  'location_timeline_worldstate_layer',
  'threat_antagonist_ending_layer',
  'source_integrity_layer',
] as const satisfies readonly StoryLayerCoreLayerKey[];

export type CanonicalIdentityDependentLayerKey =
  (typeof CANONICAL_IDENTITY_DEPENDENT_LAYER_KEYS)[number];

export type LayerHealthTruthStatus = 'clean' | 'degraded' | 'blocked';
export type LayerVisibilityHealthStatus = 'valid' | 'degraded_but_usable' | 'invalid_withheld';

export type IdentityRiskCode =
  | 'MISSING_CANONICAL_IDENTITY_LAYER'
  | 'INVALID_IDENTITY_NAME_STATE_TOKEN_WARNING'
  | 'SAME_NAME_AMBIGUITY'
  | 'UNRESOLVED_CANONICAL_IDENTITY_GROUPS'
  | 'DUPLICATE_CORE_IDENTITY_CANDIDATES'
  | 'IDENTITY_BLOCKER_ACTIVE';

export type StoryLayerDependencyFailureClass = 'DEPENDENT_LAYER_FAILED_IDENTITY_INHERITANCE';
export type StoryLayerDependencySecondaryFailureClass = 'DEPENDENT_LAYER_CLEAN_STATUS_BYPASS';

export const INHERITED_IDENTITY_RISK_WARNING =
  'This layer depends on Canonical Identity, which has unresolved identity risk. Review with caution: character names, relationships, objects, locations, or threats may inherit identity errors.';

export const SPARSE_SHORT_FORM_IDENTITY_WARNING =
  'Canonical Identity is missing or empty because the submitted short-form text does not provide enough character evidence. Treat dependent layers as degraded/caution, not as an operator-blocking failure.';

export type LayerHealthMetadata = {
  truth_status: LayerHealthTruthStatus;
  status: LayerVisibilityHealthStatus;
  reason: string;
  warning_codes: IdentityRiskCode[];
  visible_to_user: boolean;
  visible_to_admin: boolean;
  inherited_from?: StoryLayerCoreLayerKey[];
  warning_copy?: string;
};

export type StoryLayerDependencyWarning = {
  layer: CanonicalIdentityDependentLayerKey;
  depends_on: 'canonical_identity_layer';
  inherited_status: Exclude<LayerHealthTruthStatus, 'clean'>;
  failure_class: StoryLayerDependencyFailureClass;
  secondary_failure_class: StoryLayerDependencySecondaryFailureClass;
  risk_codes: IdentityRiskCode[];
  message: string;
  blocks_clean_status: true;
  admin_visibility_exception: string;
};

export type IdentityQualityCheck = {
  key: string;
  severity: 'hard_fail' | 'warning';
  message: string;
  layer: StoryLayerCoreLayerKey;
  evidenceReference?: string;
};

export type StoryLayerDependencyAssessment = {
  canonicalIdentityHealth: LayerHealthMetadata;
  dependencyWarnings: StoryLayerDependencyWarning[];
  qualityChecks: IdentityQualityCheck[];
};

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function collectIdentityBlockers(ledgerV2: CharacterLedgerV2): RecommendationBlocker[] {
  const identityLedgerBlockers = ledgerV2.identityLedger
    .flatMap((entry) => entry.recommendationBlockers ?? [])
    .filter((blocker) => isCanonicalIdentityDefectBlocker(blocker));
  const activeIdentityBlockers = (ledgerV2.activeBlockers ?? []).filter((blocker) =>
    isCanonicalIdentityDefectBlocker(blocker),
  );
  return [...identityLedgerBlockers, ...activeIdentityBlockers];
}

function isTemporalRecommendationGuardrail(blocker: RecommendationBlocker): boolean {
  if (blocker.severity !== 'suppress') return false;

  const rule = blocker.rule.toLowerCase();
  const hasTemporalBoundary =
    typeof blocker.validAfterChapter === 'string' && blocker.validAfterChapter.trim().length > 0;

  return hasTemporalBoundary || /before|until|not yet valid|do not use this name|not introduced|do not share a scene/.test(rule);
}

function isCanonicalIdentityDefectBlocker(blocker: RecommendationBlocker): boolean {
  if (isTemporalRecommendationGuardrail(blocker)) {
    return false;
  }

  const rule = blocker.rule.toLowerCase();

  if (blocker.type === 'name_state_violation') {
    return /invalid canonical|placeholder|contradict|conflict|collision|ambiguous|unresolved alias|missing required character id/.test(rule);
  }

  // existing_feature_violation and co_presence_violation are content-level
  // guardrails, not identity defects. They may reference character names
  // (e.g. "Unnamed first-person narrator") without indicating an identity problem.
  if (blocker.type === 'existing_feature_violation' || blocker.type === 'co_presence_violation') {
    return false;
  }

  return /identity|alias|name/.test(rule);
}

function describeIdentityRiskCodes(riskCodes: IdentityRiskCode[]): string {
  const labels: Record<IdentityRiskCode, string> = {
    MISSING_CANONICAL_IDENTITY_LAYER: 'missing Canonical Identity layer',
    INVALID_IDENTITY_NAME_STATE_TOKEN_WARNING: 'invalid identity/name-state token warnings',
    SAME_NAME_AMBIGUITY: 'same-name ambiguity',
    UNRESOLVED_CANONICAL_IDENTITY_GROUPS: 'unresolved canonical identity groups',
    DUPLICATE_CORE_IDENTITY_CANDIDATES: 'duplicate core identity candidates',
    IDENTITY_BLOCKER_ACTIVE: 'active identity blocker codes',
  };

  return riskCodes.map((code) => labels[code]).join(', ');
}

export function assessStoryLayerIdentityDependencies(params: {
  ledger: Pass1aCharacterLedger;
  ledgerV2: CharacterLedgerV2;
  layers?: Partial<Record<StoryLayerCoreLayerKey, Record<string, unknown>>> | null;
  allowSparseMissingIdentity?: boolean;
}): StoryLayerDependencyAssessment {
  const { ledger, ledgerV2, layers, allowSparseMissingIdentity = false } = params;

  const riskCodes: IdentityRiskCode[] = [];
  const qualityChecks: IdentityQualityCheck[] = [];

  const canonicalIdentityLayer = layers?.canonical_identity_layer;
  const canonicalGroups = Array.isArray(canonicalIdentityLayer?.identity_groups)
    ? (canonicalIdentityLayer.identity_groups as unknown[])
    : [];
  const missingCanonicalIdentity =
    !canonicalIdentityLayer ||
    Object.keys(canonicalIdentityLayer).length === 0 ||
    ledgerV2.identityLedger.length === 0 ||
    canonicalGroups.length === 0;

  if (missingCanonicalIdentity) {
    riskCodes.push('MISSING_CANONICAL_IDENTITY_LAYER');
  }

  const unresolvedIdentityConflicts = (ledgerV2.stateConflicts ?? []).filter((conflict) => {
    if (conflict.resolution !== 'unresolved') return false;
    const field = conflict.field.toLowerCase();
    return field.includes('name') || field.includes('identity');
  });
  const contradictoryIdentityGroups = ledgerV2.identityLedger.filter(
    (entry) => Array.isArray(entry.contradictions) && entry.contradictions.length > 0,
  );
  if (unresolvedIdentityConflicts.length > 0 || contradictoryIdentityGroups.length > 0) {
    riskCodes.push('UNRESOLVED_CANONICAL_IDENTITY_GROUPS');
  }

  const identityBlockers = collectIdentityBlockers(ledgerV2);
  if (identityBlockers.length > 0) {
    riskCodes.push('IDENTITY_BLOCKER_ACTIVE');
    riskCodes.push('INVALID_IDENTITY_NAME_STATE_TOKEN_WARNING');
  }

  const nameOwners = new Map<string, Set<string>>();
  for (const entry of ledgerV2.identityLedger) {
    const ownerId = entry.characterId;
    const names = new Set<string>([
      entry.canonicalName,
      ...(entry.aliases ?? []),
      ...(entry.nameHistory ?? []).map((item) => item.name),
    ].filter(Boolean));
    for (const name of names) {
      const normalized = normalizeName(name);
      if (!normalized) continue;
      if (!nameOwners.has(normalized)) nameOwners.set(normalized, new Set<string>());
      nameOwners.get(normalized)!.add(ownerId);
    }
  }

  const sameNameAmbiguity = Array.from(nameOwners.values()).some((owners) => owners.size > 1);
  if (sameNameAmbiguity) {
    riskCodes.push('SAME_NAME_AMBIGUITY');
  }

  const coreCandidateNames = ledgerV2.identityLedger
    .filter((entry) => entry.importanceLevel === 'primary' || entry.importanceLevel === 'major')
    .map((entry) => normalizeName(entry.canonicalName))
    .filter(Boolean);
  const duplicateCoreCandidates = coreCandidateNames.some(
    (name, index) => coreCandidateNames.indexOf(name) !== index,
  );
  if (duplicateCoreCandidates) {
    riskCodes.push('DUPLICATE_CORE_IDENTITY_CANDIDATES');
  }

  const dedupedRiskCodes = Array.from(new Set(riskCodes));
  const sparseMissingIdentity = missingCanonicalIdentity && allowSparseMissingIdentity;
  const canonicalTruthStatus: LayerHealthTruthStatus = missingCanonicalIdentity && !sparseMissingIdentity
    ? 'blocked'
    : dedupedRiskCodes.length > 0
      ? 'degraded'
      : 'clean';

  const canonicalVisibilityStatus: LayerVisibilityHealthStatus = canonicalTruthStatus === 'blocked'
    ? 'invalid_withheld'
    : canonicalTruthStatus === 'degraded'
      ? 'degraded_but_usable'
      : 'valid';

  const riskSummary = describeIdentityRiskCodes(dedupedRiskCodes);
  const canonicalReason = canonicalTruthStatus === 'clean'
    ? 'Canonical Identity is clean.'
    : sparseMissingIdentity
      ? SPARSE_SHORT_FORM_IDENTITY_WARNING
      : canonicalTruthStatus === 'blocked'
        ? 'Canonical Identity is missing or empty. Dependent layers cannot present as clean until identity is restored.'
        : `Canonical Identity is degraded: ${riskSummary}.`;

  if (canonicalTruthStatus === 'blocked') {
    qualityChecks.push({
      key: 'canonical_identity_missing_or_empty',
      severity: 'hard_fail',
      message: canonicalReason,
      layer: 'canonical_identity_layer',
      evidenceReference: 'pass1a_story_layer_v1.layers.canonical_identity_layer',
    });
  } else if (canonicalTruthStatus === 'degraded') {
    qualityChecks.push({
      key: sparseMissingIdentity ? 'canonical_identity_sparse_short_form_insufficient_evidence' : 'canonical_identity_degraded',
      severity: 'warning',
      message: canonicalReason,
      layer: 'canonical_identity_layer',
      evidenceReference: 'pass1a_story_layer_v1.layers.canonical_identity_layer',
    });
  }

  const dependencyWarnings: StoryLayerDependencyWarning[] = [];
  if (canonicalTruthStatus !== 'clean') {
    for (const layer of CANONICAL_IDENTITY_DEPENDENT_LAYER_KEYS) {
      const inheritedStatus = canonicalTruthStatus === 'blocked' ? 'blocked' : 'degraded';
      const message = `${INHERITED_IDENTITY_RISK_WARNING} Active identity risk: ${riskSummary || 'canonical identity unavailable'}.`;
      dependencyWarnings.push({
        layer,
        depends_on: 'canonical_identity_layer',
        inherited_status: inheritedStatus,
        failure_class: 'DEPENDENT_LAYER_FAILED_IDENTITY_INHERITANCE',
        secondary_failure_class: 'DEPENDENT_LAYER_CLEAN_STATUS_BYPASS',
        risk_codes: dedupedRiskCodes,
        message,
        blocks_clean_status: true,
        admin_visibility_exception:
          'The RevisionGrade admin account (tsavobc@hotmail.com) may view degraded or blocked dependent layers for QA/debugging, but those layers remain degraded or blocked and do not become clean canon.',
      });

      qualityChecks.push({
        key: `identity_dependency:${layer}`,
        severity: inheritedStatus === 'blocked' ? 'hard_fail' : 'warning',
        message,
        layer,
        evidenceReference: 'pass1a_story_layer_v1.layers.canonical_identity_layer',
      });
    }
  }

  return {
    canonicalIdentityHealth: {
      truth_status: canonicalTruthStatus,
      status: canonicalVisibilityStatus,
      reason: canonicalReason,
      warning_codes: dedupedRiskCodes,
      visible_to_user: canonicalTruthStatus !== 'blocked',
      visible_to_admin: true,
      warning_copy: canonicalTruthStatus === 'clean' ? undefined : INHERITED_IDENTITY_RISK_WARNING,
    },
    dependencyWarnings,
    qualityChecks,
  };
}

export function applyIdentityDependencyMetadata(
  layers: Record<StoryLayerCoreLayerKey, Record<string, unknown>>,
  assessment: StoryLayerDependencyAssessment,
): Record<StoryLayerCoreLayerKey, Record<string, unknown>> {
  const nextLayers = { ...layers };

  if (assessment.canonicalIdentityHealth.truth_status !== 'clean') {
    nextLayers.canonical_identity_layer = {
      ...nextLayers.canonical_identity_layer,
      health: assessment.canonicalIdentityHealth,
      identity_risk_metadata: {
        truth_status: assessment.canonicalIdentityHealth.truth_status,
        reason: assessment.canonicalIdentityHealth.reason,
        warning_codes: assessment.canonicalIdentityHealth.warning_codes,
      },
    };
  }

  for (const warning of assessment.dependencyWarnings) {
    const visibilityStatus: LayerVisibilityHealthStatus = warning.inherited_status === 'blocked'
      ? 'invalid_withheld'
      : 'degraded_but_usable';

    nextLayers[warning.layer] = {
      ...nextLayers[warning.layer],
      health: {
        truth_status: warning.inherited_status,
        status: visibilityStatus,
        reason: warning.message,
        warning_codes: warning.risk_codes,
        visible_to_user: warning.inherited_status !== 'blocked',
        visible_to_admin: true,
        inherited_from: ['canonical_identity_layer'],
        warning_copy: INHERITED_IDENTITY_RISK_WARNING,
      } satisfies LayerHealthMetadata,
      dependency_warning: warning,
    };
  }

  return nextLayers;
}

export function collectDependencyWarningsFromStoryLayers(
  layers: Record<string, Record<string, unknown>> | null | undefined,
): StoryLayerDependencyWarning[] {
  if (!layers) return [];

  return Object.values(layers)
    .map((layer) => layer?.dependency_warning)
    .filter((warning): warning is StoryLayerDependencyWarning => {
      return Boolean(
        warning &&
          typeof warning === 'object' &&
          'failure_class' in warning &&
          'layer' in warning,
      );
    });
}
