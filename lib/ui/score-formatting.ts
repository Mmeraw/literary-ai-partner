/**
 * Author-facing score display policy.
 *
 * Scores shown to users must never inflate precision or round upward. Internal
 * scoring data may retain decimals for calculations, but display/export
 * boundaries floor to whole numbers only.
 */

export function floorScoreForDisplay(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.floor(value) : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? Math.floor(parsed) : null;
  }

  return null;
}

export function formatScoreForDisplay(value: unknown, fallback = '—'): string {
  const floored = floorScoreForDisplay(value);
  return floored === null ? fallback : String(floored);
}

export function formatScoreFractionForDisplay(value: unknown, denominator: number, fallback = '—'): string {
  return `${formatScoreForDisplay(value, fallback)}/${denominator}`;
}

export function formatSignedScoreForDisplay(value: unknown, fallback = '—'): string {
  const floored = floorScoreForDisplay(value);
  if (floored === null) return fallback;
  return floored > 0 ? `+${floored}` : String(floored);
}