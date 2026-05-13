export function normalizeTitle(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export function normalizeManuscriptId(
  manuscriptId?: number | string | null,
): number | null {
  if (typeof manuscriptId === "number") {
    if (!Number.isFinite(manuscriptId) || manuscriptId <= 0) return null;
    return Math.floor(manuscriptId);
  }

  if (typeof manuscriptId === "string") {
    const trimmed = manuscriptId.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.floor(parsed);
  }

  return null;
}
