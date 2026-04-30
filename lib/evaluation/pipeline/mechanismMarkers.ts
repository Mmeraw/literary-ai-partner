/**
 * Canonical mechanism marker lexicons shared across Pass 3 and Pass 4 checks.
 *
 * Purpose:
 * - Avoid prompt/gate lexical drift that causes false-negative quality gate failures.
 * - Keep dialogue mechanism terminology aligned in one source of truth.
 */

export const DIALOGUE_MECHANISM_MARKERS = Object.freeze([
  "attribution",
  "tag",
  "speaker",
  "beat",
  "quote",
  "quotation",
  "subtext",
  "voicing",
  "interruption",
  "turn-taking",
  "turn taking",
  "direct speech",
  "reported speech",
  "rendering",
]);
