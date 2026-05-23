/**
 * Canonical dialogue vocabulary registry.
 *
 * This file is runtime canon for dialogue-attribution detection. WAVE modules
 * must import this registry instead of maintaining local tag regex lists.
 */

export const CANON_DIALOGUE_TAGS = [
  "said",
  "asked",
  "replied",
  "answered",
  "responded",
  "whispered",
  "murmured",
  "muttered",
  "breathed",
  "snapped",
  "shouted",
  "yelled",
  "called",
  "cried",
  "growled",
  "hissed",
  "rasped",
] as const;

export type CanonDialogueTag = (typeof CANON_DIALOGUE_TAGS)[number];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const CANON_DIALOGUE_TAG_PATTERN_SOURCE = CANON_DIALOGUE_TAGS
  .map(escapeRegExp)
  .join("|");

export function buildCanonDialogueTagRegex(flags = "gi"): RegExp {
  return new RegExp(`\\b(?:${CANON_DIALOGUE_TAG_PATTERN_SOURCE})\\b`, flags);
}

export function countCanonDialogueTags(text: string): number {
  return text.match(buildCanonDialogueTagRegex("gi"))?.length ?? 0;
}

export function hasCanonDialogueTag(text: string): boolean {
  return buildCanonDialogueTagRegex("i").test(text);
}
