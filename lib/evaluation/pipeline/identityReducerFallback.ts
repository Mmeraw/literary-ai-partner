export type IdentityMergeStatus = 'OK' | 'DEGRADED_FALLBACK_TO_RAW' | 'FAILED_CRITICAL';

export type CanonicalIdentityRoleTier =
  | 'co_protagonist'
  | 'complex_antagonist'
  | 'functional_scene_character';

export type CanonicalIdentityGroup = {
  canonical_identity_group: string;
  aliases: string[];
  role_tier: CanonicalIdentityRoleTier;
  primary_pov_anchor: boolean;
};

export type CanonicalIdentityLayerPayload = {
  merge_status: IdentityMergeStatus;
  diagnostic_logs?: string;
  canonical_identity_groups: CanonicalIdentityGroup[];
};

export type RawIdentityFallbackCard = {
  character_name?: unknown;
  name?: unknown;
  aliases?: unknown;
  alternate_names?: unknown;
  role_description?: unknown;
  context?: unknown;
  role_signal?: unknown;
  narrative_weight_signal?: unknown;
  is_pov_character?: unknown;
  primary_pov_anchor?: unknown;
};

type IdentityGroupCandidate = {
  canonical_identity_group?: unknown;
  aliases?: unknown;
  role_tier?: unknown;
  primary_pov_anchor?: unknown;
};

function stripJsonFence(raw: string): string {
  return raw.replace(/```json/g, '').replace(/```/g, '').trim();
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(asString).filter((item): item is string => Boolean(item));
}

function isCanonicalRoleTier(value: unknown): value is CanonicalIdentityRoleTier {
  return value === 'co_protagonist' ||
    value === 'complex_antagonist' ||
    value === 'functional_scene_character';
}

function toIdentityGroup(candidate: IdentityGroupCandidate): CanonicalIdentityGroup | null {
  const canonical = asString(candidate.canonical_identity_group);
  if (!canonical || !Array.isArray(candidate.aliases) || !isCanonicalRoleTier(candidate.role_tier)) {
    return null;
  }

  return {
    canonical_identity_group: canonical,
    aliases: asStringArray(candidate.aliases),
    role_tier: candidate.role_tier,
    primary_pov_anchor: candidate.primary_pov_anchor === true,
  };
}

function parseStrictIdentityGroups(rawModelOutput: string): CanonicalIdentityGroup[] {
  const parsed = JSON.parse(stripJsonFence(rawModelOutput)) as unknown;
  const source = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { identities?: unknown }).identities)
      ? (parsed as { identities: unknown[] }).identities
      : null;

  if (!source) {
    throw new Error('Identity reducer expected an array or { identities: [] } payload.');
  }

  const groups = source.map((item) => toIdentityGroup(item as IdentityGroupCandidate));
  const invalidIndex = groups.findIndex((group) => group === null);
  if (invalidIndex >= 0) {
    throw new Error(`Identity reducer payload failed validation at index ${invalidIndex}.`);
  }

  return groups as CanonicalIdentityGroup[];
}

function resolveFallbackName(card: RawIdentityFallbackCard): string {
  return asString(card.character_name) ?? asString(card.name) ?? 'Unidentified Figure';
}

function resolveFallbackAliases(card: RawIdentityFallbackCard, detectedName: string): string[] {
  const aliases = [
    detectedName,
    ...asStringArray(card.aliases),
    ...asStringArray(card.alternate_names),
  ];
  return [...new Set(aliases)];
}

function resolveFallbackRoleTier(card: RawIdentityFallbackCard): CanonicalIdentityRoleTier {
  const roleContext = [
    card.role_description,
    card.context,
    card.role_signal,
    card.narrative_weight_signal,
  ]
    .map((value) => String(value ?? '').toLowerCase())
    .join(' ');

  if (
    roleContext.includes('hero') ||
    roleContext.includes('protagonist') ||
    roleContext.includes('lead') ||
    roleContext.includes('primary')
  ) {
    return 'co_protagonist';
  }

  if (
    roleContext.includes('villain') ||
    roleContext.includes('antagonist') ||
    roleContext.includes('threat') ||
    roleContext.includes('adversary')
  ) {
    return 'complex_antagonist';
  }

  return 'functional_scene_character';
}

function buildFallbackGroups(rawFallbackCards: RawIdentityFallbackCard[]): CanonicalIdentityGroup[] {
  return rawFallbackCards.map((card) => {
    const detectedName = resolveFallbackName(card);
    return {
      canonical_identity_group: detectedName,
      aliases: resolveFallbackAliases(card, detectedName),
      role_tier: resolveFallbackRoleTier(card),
      primary_pov_anchor: card.is_pov_character === true || card.primary_pov_anchor === true,
    };
  });
}

export function reduceIdentityGroups(
  rawModelOutput: string,
  rawFallbackCards: RawIdentityFallbackCard[],
): CanonicalIdentityLayerPayload {
  if (!rawModelOutput || rawModelOutput.trim().length < 10) {
    return {
      merge_status: 'FAILED_CRITICAL',
      diagnostic_logs: 'CRITICAL_REDUCER_ERROR: LLM output stream truncated or generated zero tokens. Fallback impossible.',
      canonical_identity_groups: [],
    };
  }

  try {
    return {
      merge_status: 'OK',
      canonical_identity_groups: parseStrictIdentityGroups(rawModelOutput),
    };
  } catch (error) {
    return {
      merge_status: 'DEGRADED_FALLBACK_TO_RAW',
      diagnostic_logs: error instanceof Error ? error.message : String(error),
      canonical_identity_groups: buildFallbackGroups(rawFallbackCards),
    };
  }
}
