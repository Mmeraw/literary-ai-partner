/**
 * Canonical voice-protection registry.
 *
 * This is the pre-rewrite firewall for WAVE modules that may otherwise flatten
 * dialect, ritual repetition, chant/song cadence, crude humor, panic cognition,
 * or intentional symbolic echo into generic prose.
 */

export const VOICE_PROTECTION_CLASSES = [
  "VOICE_DIALECT",
  "CHARACTER_IDIOLECT",
  "RITUAL_REPETITION",
  "CHANT_OR_SONG",
  "CRUDE_HUMOR",
  "PANIC_COGNITION",
  "SYMBOLIC_ECHO",
  "INTENTIONAL_CADENCE",
] as const;

export type VoiceProtectionClass = (typeof VOICE_PROTECTION_CLASSES)[number];

export type VoiceProtectionRule = {
  id: string;
  protection: VoiceProtectionClass;
  pattern: RegExp;
  rationale: string;
};

export type VoiceProtectionHit = {
  ruleId: string;
  protection: VoiceProtectionClass;
  rationale: string;
  excerpt: string;
};

export const VOICE_PROTECTION_RULES: VoiceProtectionRule[] = [
  {
    id: "dialect-contraction-register",
    protection: "VOICE_DIALECT",
    pattern: /\b(?:ain't|gonna|wanna|ya|y'all|gotta|lemme|kinda|sorta)\b/i,
    rationale: "Dialect/contraction register may be character voice, not prose error.",
  },
  {
    id: "panic-cognition-word-repeat",
    protection: "PANIC_COGNITION",
    pattern: /\b([a-z][a-z'\-]{1,20})(?:[.!?,;:\s]+\1){1,}\b/i,
    rationale: "Immediate word repetition may encode panic, pressure, ritual emphasis, or cognition under stress.",
  },
  {
    id: "panic-cognition-phrase-repeat",
    protection: "PANIC_COGNITION",
    pattern: /\b([a-z][a-z'\-]{1,20}(?:\s+[a-z][a-z'\-]{1,20}){0,3})(?:[.!?,;:]\s+|\s+)\1\b/i,
    rationale: "Immediate phrase repetition may encode panic, pressure, ritual emphasis, or cognition under stress.",
  },
  {
    id: "chant-or-song-marker",
    protection: "CHANT_OR_SONG",
    pattern: /\b(?:chant|song|sang|sing|sung|refrain|chorus|hymn|lullaby)\b/i,
    rationale: "Chant/song/refrain language requires cadence protection before repetition cleanup.",
  },
  {
    id: "ritual-repetition-marker",
    protection: "RITUAL_REPETITION",
    pattern: /\b(?:ritual|refrain|again and again|over and over|echo|incantation|prayer)\b/i,
    rationale: "Ritualized repetition can be structural meaning rather than redundancy.",
  },
  {
    id: "symbolic-echo-marker",
    protection: "SYMBOLIC_ECHO",
    pattern: /\b(?:motif|symbol|echo|callback|talisman|totem)\b/i,
    rationale: "Symbolic echo/callback should be protected before line-level cleanup.",
  },
  {
    id: "crude-humor-register",
    protection: "CRUDE_HUMOR",
    pattern: /\b(?:ass|shit|damn|hell|piss|crap|fuck)\b/i,
    rationale: "Crude humor or profanity may be intentional voice/register and must not be normalized by default.",
  },
];

function excerptForMatch(text: string, matchIndex: number, matchLength: number): string {
  const start = Math.max(0, matchIndex - 40);
  const end = Math.min(text.length, matchIndex + matchLength + 40);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

export function classifyProtectedVoiceSpans(text: string): VoiceProtectionHit[] {
  const hits: VoiceProtectionHit[] = [];

  for (const rule of VOICE_PROTECTION_RULES) {
    const match = rule.pattern.exec(text);
    if (!match || match.index === undefined) {
      continue;
    }

    hits.push({
      ruleId: rule.id,
      protection: rule.protection,
      rationale: rule.rationale,
      excerpt: excerptForMatch(text, match.index, match[0].length),
    });
  }

  return hits;
}

export function isProtectedVoiceSpan(text: string): boolean {
  return classifyProtectedVoiceSpans(text).length > 0;
}

export function buildVoiceProtectionModifications(
  text: string,
  prefix = "voice-protection",
): string[] {
  return classifyProtectedVoiceSpans(text).map(
    (hit) => `${prefix}:${hit.protection}:${hit.ruleId}`,
  );
}
