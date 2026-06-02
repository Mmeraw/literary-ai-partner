/**
 * Ledger Corruption Assessor
 *
 * Measures the corruption level of a story ledger (pass1a_story_layer_v1)
 * and produces a corruption score (0.0–1.0) that downstream processes use
 * to calibrate their confidence.
 *
 * Philosophy: Degraded inputs ALWAYS pass. The corruption score tells
 * downstream processes how much to trust the ledger — it never blocks.
 */

const CANONICAL_LAYER_NAMES = [
  'canonical_identity_layer',
  'cast_role_tier_layer',
  'identity_pronoun_layer',
  'location_timeline_worldstate_layer',
  'object_symbol_layer',
  'pov_structure_layer',
  'relationship_network_layer',
  'source_integrity_layer',
  'threat_antagonist_ending_layer',
] as const;

type LayerHealthStatus = 'healthy' | 'degraded_but_usable' | 'degraded' | 'missing' | 'empty' | 'unknown';

export interface LayerCorruptionDetail {
  layer_name: string;
  health_status: LayerHealthStatus;
  /** 0 = fully healthy, 1 = completely corrupt/missing */
  corruption: number;
  warning_codes: string[];
  reason: string;
}

export interface CorruptionAssessment {
  /** Overall corruption score 0.0 (pristine) to 1.0 (completely unusable) */
  corruption_score: number;
  /** Per-layer breakdown */
  layer_details: LayerCorruptionDetail[];
  /** Layers that are missing entirely */
  missing_layers: string[];
  /** Layers that are degraded but present */
  degraded_layers: string[];
  /** Total layers present (of 9 canonical) */
  layers_present: number;
  /** Total layers healthy */
  layers_healthy: number;
  /** Human-readable summary */
  summary: string;
  /** Whether the ledger is usable at all for downstream processing */
  usable: boolean;
}

function assessLayerHealth(layerName: string, layer: unknown): LayerCorruptionDetail {
  if (layer === null || layer === undefined) {
    return {
      layer_name: layerName,
      health_status: 'missing',
      corruption: 1.0,
      warning_codes: ['LAYER_MISSING'],
      reason: `${layerName} is entirely missing from the story ledger.`,
    };
  }

  if (typeof layer !== 'object' || Array.isArray(layer)) {
    return {
      layer_name: layerName,
      health_status: 'empty',
      corruption: 0.9,
      warning_codes: ['LAYER_MALFORMED'],
      reason: `${layerName} is malformed (not an object).`,
    };
  }

  const record = layer as Record<string, unknown>;
  const keys = Object.keys(record);

  if (keys.length === 0) {
    return {
      layer_name: layerName,
      health_status: 'empty',
      corruption: 0.9,
      warning_codes: ['LAYER_EMPTY'],
      reason: `${layerName} is an empty object with no data.`,
    };
  }

  // Check for the built-in health field
  const health = record.health as Record<string, unknown> | undefined;
  if (health && typeof health === 'object') {
    const status = health.status as string | undefined;
    const warningCodes = Array.isArray(health.warning_codes) ? health.warning_codes as string[] : [];

    if (status === 'healthy' || status === 'complete') {
      return {
        layer_name: layerName,
        health_status: 'healthy',
        corruption: 0.0,
        warning_codes: [],
        reason: `${layerName} is healthy.`,
      };
    }

    if (status === 'degraded_but_usable') {
      // Degraded but usable — corruption proportional to warning count
      const warningPenalty = Math.min(0.4, warningCodes.length * 0.1);
      return {
        layer_name: layerName,
        health_status: 'degraded_but_usable',
        corruption: 0.15 + warningPenalty,
        warning_codes: warningCodes,
        reason: health.reason as string || `${layerName} is degraded but usable.`,
      };
    }

    if (status === 'degraded' || status === 'failed') {
      return {
        layer_name: layerName,
        health_status: 'degraded',
        corruption: 0.6 + Math.min(0.3, warningCodes.length * 0.1),
        warning_codes: warningCodes,
        reason: health.reason as string || `${layerName} is degraded.`,
      };
    }
  }

  // No health field but has data — assume mildly degraded (old format)
  const dataKeyCount = keys.filter(k => k !== 'health' && k !== 'schema_version').length;
  if (dataKeyCount >= 3) {
    return {
      layer_name: layerName,
      health_status: 'unknown',
      corruption: 0.1,
      warning_codes: ['NO_HEALTH_FIELD'],
      reason: `${layerName} has data but no health indicator.`,
    };
  }

  return {
    layer_name: layerName,
    health_status: 'unknown',
    corruption: 0.3,
    warning_codes: ['SPARSE_DATA', 'NO_HEALTH_FIELD'],
    reason: `${layerName} has minimal data and no health indicator.`,
  };
}

/**
 * Assess the corruption level of a story ledger.
 * Returns a structured assessment with overall score and per-layer details.
 */
export function assessLedgerCorruption(
  layers: Record<string, unknown> | null | undefined,
): CorruptionAssessment {
  if (!layers || typeof layers !== 'object') {
    return {
      corruption_score: 1.0,
      layer_details: CANONICAL_LAYER_NAMES.map(name => ({
        layer_name: name,
        health_status: 'missing' as const,
        corruption: 1.0,
        warning_codes: ['LAYER_MISSING'],
        reason: `${name} is entirely missing (no layers object).`,
      })),
      missing_layers: [...CANONICAL_LAYER_NAMES],
      degraded_layers: [],
      layers_present: 0,
      layers_healthy: 0,
      summary: 'Story ledger has no layers — completely empty.',
      usable: false,
    };
  }

  const details: LayerCorruptionDetail[] = [];
  const missingLayers: string[] = [];
  const degradedLayers: string[] = [];
  let healthyCount = 0;
  let presentCount = 0;

  for (const layerName of CANONICAL_LAYER_NAMES) {
    const layer = (layers as Record<string, unknown>)[layerName];
    const detail = assessLayerHealth(layerName, layer);
    details.push(detail);

    if (detail.health_status === 'missing') {
      missingLayers.push(layerName);
    } else {
      presentCount++;
      if (detail.health_status === 'healthy') {
        healthyCount++;
      } else {
        degradedLayers.push(layerName);
      }
    }
  }

  // Compute overall corruption score: weighted average of layer corruptions
  // Missing layers weigh more heavily (a missing layer is worse than a degraded one)
  const totalCorruption = details.reduce((sum, d) => sum + d.corruption, 0);
  const overallScore = Math.min(1.0, totalCorruption / CANONICAL_LAYER_NAMES.length);

  // Usability threshold: if more than half the layers are missing, it's unusable
  const usable = presentCount >= 5;

  let summary: string;
  if (overallScore === 0) {
    summary = 'Story ledger is pristine — all 9 layers healthy.';
  } else if (overallScore < 0.2) {
    summary = `Story ledger is mostly healthy (${healthyCount}/9 pristine, ${degradedLayers.length} degraded).`;
  } else if (overallScore < 0.5) {
    summary = `Story ledger is moderately degraded (${degradedLayers.length} degraded, ${missingLayers.length} missing). Usable with reduced confidence.`;
  } else if (usable) {
    summary = `Story ledger is significantly degraded (score ${overallScore.toFixed(2)}). Proceed with low confidence.`;
  } else {
    summary = `Story ledger is critically corrupt (${missingLayers.length} missing layers). Downstream results will be unreliable.`;
  }

  return {
    corruption_score: Math.round(overallScore * 100) / 100,
    layer_details: details,
    missing_layers: missingLayers,
    degraded_layers: degradedLayers,
    layers_present: presentCount,
    layers_healthy: healthyCount,
    summary,
    usable,
  };
}
