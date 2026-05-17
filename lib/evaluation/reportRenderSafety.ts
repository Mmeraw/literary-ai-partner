// canon-audit-allow: vocabulary-detection
// Reason: 'commercial' below is a DREAM subscore dimension (publishing shelf axis),
// not a canonical evaluation criterion key alias.
import type { LongformDreamDocument } from "@/lib/evaluation/pipeline/runPass3bLongform";

export type DreamScoreDimension = "quality" | "readiness" | "commercial" | "literary";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function getDisplayRecord(value: unknown): Record<string, unknown> | null {
  return asRecord(value);
}

export function getDisplayText(value: unknown, fallback = "—"): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return fallback;
}

export function getDisplayDateTime(isoLike: string | null | undefined, fallback = "Unknown"): string {
  if (typeof isoLike !== "string" || isoLike.trim().length === 0) {
    return fallback;
  }

  const parsed = new Date(isoLike);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return parsed.toLocaleString();
}

export function getDisplayDreamScore(
  dreamDoc: LongformDreamDocument | null | undefined,
  dimension: DreamScoreDimension,
): string {
  const value = asRecord((dreamDoc as unknown as Record<string, unknown> | null)?.dream_scores)?.[dimension];
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "—";
}

export function getDisplayDreamList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}

export function getDisplayObjectArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null);
}

export function getDisplayDreamMarketField(
  dreamDoc: LongformDreamDocument | null | undefined,
  field: "best_shelf" | "marketable_hook" | "market_danger",
): string | null {
  const marketShelf = asRecord((dreamDoc as unknown as Record<string, unknown> | null)?.market_shelf);
  if (!marketShelf) return null;

  const value = getDisplayText(marketShelf[field], "").trim();
  return value.length > 0 ? value : null;
}