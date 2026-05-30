import { STORY_LAYER_KEYS } from '@/lib/evaluation/artifacts/artifactTypes';

type LayerDecision = {
  status?: unknown;
  comment?: unknown;
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

export function validateLayerDecisionsForApproval(layerDecisions: unknown): { ok: true } | { ok: false; error: string } {
  if (!isRecord(layerDecisions)) {
    return {
      ok: false,
      error: 'All 9 layer decisions are required to approve the Story Ledger.',
    };
  }

  const keys = Object.keys(layerDecisions);
  if (keys.length !== STORY_LAYER_KEYS.length) {
    return {
      ok: false,
      error: `All 9 layer decisions are required to approve the Story Ledger. Received ${keys.length}.`,
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
    const rawDecision = layerDecisions[key] as LayerDecision | undefined;
    if (!rawDecision || !isRecord(rawDecision)) {
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