export type StoryLayerContent = {
  layers?: Record<string, Record<string, unknown>>;
  layer_completion_summary?: {
    total_layers: number;
    populated_layers: number;
    empty_layers?: string[];
    degraded_layers?: string[];
  } | null;
};

export type LedgerQualityReportContent = {
  quality_report?: {
    gate_ready_status?: 'reviewable' | 'blocked' | 'repair_required';
    grouped_warning_summary?: Record<string, string[]>;
    blocking_reasons?: string[];
  } | null;
} | null;

export const STORY_LAYER_ORDER = [
  'canonical_identity_layer',
  'cast_role_tier_layer',
  'identity_pronoun_layer',
  'pov_structure_layer',
  'relationship_network_layer',
  'object_symbol_layer',
  'location_timeline_worldstate_layer',
  'threat_antagonist_ending_layer',
  'source_integrity_layer',
] as const;

export type StoryLayerKey = (typeof STORY_LAYER_ORDER)[number];

export type LayerVisibilityStatus =
  | 'valid'
  | 'passed'
  | 'show'
  | 'show_full_layer'
  | 'show_clean_summary_only'
  | 'repaired_by_later_passes'
  | 'degraded_but_usable'
  | 'invalid_withheld'
  | 'internal_only'
  | 'quarantined'
  | 'failed'
  | 'not_applicable';

export type LayerVisibilityDecision = {
  status?: LayerVisibilityStatus;
  display_status?: LayerVisibilityStatus;
  visibility_status?: LayerVisibilityStatus;
  health?: LayerVisibilityStatus;
  visibleToUser?: boolean;
  visible_to_user?: boolean;
  includedInLayerReport?: boolean;
  included_in_layer_report?: boolean;
  reason?: string;
};

const STORY_LEDGER_ADMIN_EMAILS = new Set(
  (process.env.REVISIONGRADE_ADMIN_EMAILS ?? 'tsavobc@hotmail.com')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

const USER_VISIBLE_LAYER_STATUSES = new Set<LayerVisibilityStatus>([
  'valid',
  'passed',
  'show',
  'show_full_layer',
  'show_clean_summary_only',
  'repaired_by_later_passes',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isStoryLedgerAdmin(user: { email?: string | null } | null | undefined): boolean {
  const email = user?.email?.trim().toLowerCase();
  return Boolean(email && STORY_LEDGER_ADMIN_EMAILS.has(email));
}

function visibilityCandidateStatus(value: unknown): string | null {
  if (typeof value === 'boolean') return value ? 'valid' : 'invalid_withheld';
  if (typeof value === 'string') return value.trim().toLowerCase();
  if (!isRecord(value)) return null;

  if (value.visibleToUser === true || value.visible_to_user === true) return 'valid';
  if (value.includedInLayerReport === true || value.included_in_layer_report === true) return 'valid';
  if (value.visibleToUser === false || value.visible_to_user === false) return 'invalid_withheld';
  if (value.includedInLayerReport === false || value.included_in_layer_report === false) return 'invalid_withheld';

  const status = value.status ?? value.display_status ?? value.visibility_status ?? value.health;
  return typeof status === 'string' ? status.trim().toLowerCase() : null;
}

function layerExplicitVisibilityStatus(
  layerKey: StoryLayerKey,
  layer: Record<string, unknown> | undefined,
  qualityReport: LedgerQualityReportContent,
  content: StoryLayerContent | null,
): string | null {
  const qualitySummary = qualityReport?.quality_report?.grouped_warning_summary;
  if (qualitySummary && Array.isArray(qualitySummary[layerKey])) {
    return qualitySummary[layerKey].length > 0 ? 'blocked' : 'valid';
  }

  const layerCandidates = [
    layer?.visibility_decision,
    layer?.visibility,
    layer?.quality_gate,
    layer?.quality,
    layer?.health,
    layer?.metadata,
  ];

  for (const candidate of layerCandidates) {
    const status = visibilityCandidateStatus(candidate);
    if (status) return status;
  }

  return null;
}

export function layerPassesUserVisibilityGate(
  layerKey: StoryLayerKey,
  layer: Record<string, unknown> | undefined,
  qualityReport: LedgerQualityReportContent,
  content: StoryLayerContent | null,
): boolean {
  if (!layer || Object.keys(layer).length === 0) return false;

  const explicitStatus = layerExplicitVisibilityStatus(layerKey, layer, qualityReport, content);
  if (explicitStatus) {
    return USER_VISIBLE_LAYER_STATUSES.has(explicitStatus as LayerVisibilityStatus);
  }

  const qualitySummary = qualityReport?.quality_report?.grouped_warning_summary;
  if (qualitySummary && Object.prototype.hasOwnProperty.call(qualitySummary, layerKey)) {
    return false;
  }

  // Transitional fallback until every story-layer artifact carries explicit
  // quality metadata: show populated layers unless the completion summary
  // explicitly marks them empty or degraded. That keeps the gate server-side
  // without hiding layers that never received quality metadata.
  const emptyLayers = content?.layer_completion_summary?.empty_layers ?? [];
  const degradedLayers = content?.layer_completion_summary?.degraded_layers ?? [];

  return !emptyLayers.includes(layerKey) && !degradedLayers.includes(layerKey);
}

function summarizeVisibleLayers(
  visibleLayerKeys: string[],
  fallback: StoryLayerContent['layer_completion_summary'] | null,
) {
  return {
    total_layers: visibleLayerKeys.length,
    populated_layers: visibleLayerKeys.length,
    empty_layers: [] as string[],
    degraded_layers: [] as string[],
    ...(fallback && visibleLayerKeys.length === 0 ? fallback : {}),
  };
}

export function filterStoryLayersForViewer(
  layers: Record<string, Record<string, unknown>> | null,
  content: StoryLayerContent | null,
  qualityReport: LedgerQualityReportContent,
  isAdminViewer: boolean,
): {
  storyLayers: Record<string, Record<string, unknown>> | null;
  visibleLayerKeys: string[];
  withheldLayerKeys: string[];
  layerCompletionSummary: StoryLayerContent['layer_completion_summary'] | null;
} {
  if (!layers) {
    return {
      storyLayers: null,
      visibleLayerKeys: [],
      withheldLayerKeys: [],
      layerCompletionSummary: content?.layer_completion_summary ?? null,
    };
  }

  const populatedKeys = STORY_LAYER_ORDER.filter((key) => {
    const layer = layers[key];
    return layer && Object.keys(layer).length > 0;
  });

  if (isAdminViewer) {
    return {
      storyLayers: layers,
      visibleLayerKeys: populatedKeys,
      withheldLayerKeys: [],
      layerCompletionSummary:
        content?.layer_completion_summary ?? {
          total_layers: STORY_LAYER_ORDER.length,
          populated_layers: populatedKeys.length,
          empty_layers: STORY_LAYER_ORDER.filter((key) => !populatedKeys.includes(key)),
          degraded_layers: [],
        },
    };
  }

  const visibleLayerKeys = populatedKeys.filter((key) =>
    layerPassesUserVisibilityGate(key, layers[key], qualityReport, content),
  );
  const withheldLayerKeys = populatedKeys.filter((key) => !visibleLayerKeys.includes(key));

  const filteredLayers = Object.fromEntries(
    visibleLayerKeys.map((key) => [key, layers[key]]),
  ) as Record<string, Record<string, unknown>>;

  return {
    storyLayers: visibleLayerKeys.length > 0 ? filteredLayers : null,
    visibleLayerKeys,
    withheldLayerKeys,
    layerCompletionSummary: summarizeVisibleLayers(
      visibleLayerKeys,
      content?.layer_completion_summary ?? null,
    ),
  };
}
