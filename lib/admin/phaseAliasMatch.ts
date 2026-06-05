export function normalizePhaseAlias(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function matchesNormalizedPhaseAlias(phase: string, alias: string): boolean {
  const normalized = normalizePhaseAlias(phase);
  const normalizedAlias = normalizePhaseAlias(alias);

  if (!normalized || !normalizedAlias) return false;

  return (
    normalized === normalizedAlias
    || normalized.startsWith(`${normalizedAlias}_`)
    || normalized.includes(`_${normalizedAlias}_`)
    || normalized.endsWith(`_${normalizedAlias}`)
  );
}
