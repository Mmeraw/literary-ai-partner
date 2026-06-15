import { STORY_LAYER_KEYS } from '@/lib/evaluation/artifacts/artifactTypes';

type LayerDecision = {
  status?: unknown;
  comment?: unknown;
};

const STATUS_NORMALIZATION_MAP: Record<string, string> = {
  approved: 'accepted',
  approved_with_comment: 'accepted_with_comment',
  accepted: 'accepted',
  accepted_with_comment: 'accepted_with_comment',
  rejected: 'rejected',
  rejected_with_comment: 'rejected_with_comment',
};

const ALLOWED_STATUSES = new Set([
  'accepted',
  'accepted_with_comment',
  'rejected',
  'rejected_with_comment',
]);

const REQUIRED_LAYER_KEYS = new Set<string>(STORY_LAYER_KEYS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasNonEmptyComment(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function normalizeLayerDecisionsForPersistence(layerDecisions: unknown): Record<string, LayerDecision> | null {
  if (!isRecord(layerDecisions)) {
    return null;
  }

  const normalized: Record<string, LayerDecision> = {};
  for (const [key, rawDecision] of Object.entries(layerDecisions)) {
    if (!isRecord(rawDecision)) {
      normalized[key] = { status: rawDecision };
      continue;
    }

    const rawStatus = typeof rawDecision.status === 'string' ? rawDecision.status.trim().toLowerCase() : '';
    normalized[key] = {
      ...rawDecision,
      status: STATUS_NORMALIZATION_MAP[rawStatus] ?? rawDecision.status,
    };
  }

  return normalized;
}

export function validateLayerDecisionsForApproval(layerDecisions: unknown): { ok: true } | { ok: false; error: string } {
  const normalizedLayerDecisions = normalizeLayerDecisionsForPersistence(layerDecisions);

  if (!normalizedLayerDecisions) {
    return {
      ok: false,
      error: `All ${STORY_LAYER_KEYS.length} layer decisions are required to approve the Story Ledger.`,
    };
  }

  const keys = Object.keys(normalizedLayerDecisions);
  if (keys.length !== STORY_LAYER_KEYS.length) {
    return {
      ok: false,
      error: `All ${STORY_LAYER_KEYS.length} layer decisions are required to approve the Story Ledger. Received ${keys.length}.`,
    };
  }

  for (const key of keys) {
    if (!REQUIRED_LAYER_KEYS.has(key)) {
      return {
        ok: false,
        error: `Layer decision key "${key}" is not recognized by the canonical Story Layer contract.`,
      };
    }
  }

  for (const key of STORY_LAYER_KEYS) {
    const rawDecision = normalizedLayerDecisions[key];
    if (!rawDecision) {
      return {
        ok: false,
        error: `Layer decision "${key}" is missing or malformed.`,
      };
    }

    const status = typeof rawDecision.status === 'string' ? rawDecision.status.trim() : '';
    if (!ALLOWED_STATUSES.has(status)) {
      return {
        ok: false,
        error: `Layer decision "${key}" has invalid status "${String(rawDecision.status ?? '')}".`,
      };
    }

    if (status.includes('with_comment') || status.startsWith('rejected')) {
      if (!hasNonEmptyComment(rawDecision.comment)) {
        return {
          ok: false,
          error: `Layer decision "${key}" requires a non-empty comment when status is "${status}".`,
        };
      }
    }
  }

  return { ok: true };
}