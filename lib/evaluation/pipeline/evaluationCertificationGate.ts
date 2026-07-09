/**
 * Artifact Certification Authority (ACA) — Evaluation Certification Gate (ECG)
 *
 * The single certification authority that every completed evaluation must pass
 * before it becomes a customer-visible artifact.
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  DESIGN INVARIANT: The ACA is a referee, never an editor.       ║
 * ║  It emits CERTIFIED or NOT CERTIFIED and nothing else.          ║
 * ║  It never mutates, repairs, or regenerates evaluation content.  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Pipeline order:
 *   Pass 3 output
 *       │
 *       ▼
 *   normalizeArtifact()        ← SEPARATE pre-stage (cosmetic, deterministic)
 *       │
 *       ▼
 *   runEvaluationCertificationGate()   ← THIS FILE — verdict only
 *       │
 *       ├── ECG_MODE=OFF        → skip gate, always CERTIFIED
 *       ├── ECG_MODE=WARN_ONLY  → run all checks, log failures, still CERTIFIED
 *       └── ECG_MODE=ENFORCE    → run all checks, FATAL → CERTIFICATION_FAILED → job fails
 *
 * ECG_MODE env var (default: WARN_ONLY):
 *   OFF        — gate disabled; use during initial deploy / backward compat
 *   WARN_ONLY  — runs all 28 invariants, emits logs, persists regardless (measure before enforce)
 *   ENFORCE    — FATAL violations block persistence; forces Pass 3 regeneration
 *
 * Invariant taxonomy:
 *   FATAL      — blocks certification in ENFORCE mode; logs in WARN_ONLY.
 *                Requires regeneration of the affected section — never silent repair.
 *   ADVISORY   — always logged; never blocks. Cosmetic issues caught post-normalization.
 *
 * CERTIFICATION_REGISTRY: all 28 invariants declared with domain, code, severity,
 * authority source (provenance), and test coverage tags. Queryable by domain for
 * coverage reporting analogous to SIPOC gap tracking.
 *
 * Error code prefix convention:
 *   ECG_AUTH_*   — score authority / provenance consistency
 *   ECG_IDENT_*  — identity separation between sections
 *   ECG_EXEC_*   — executive summary editorial contract
 *   ECG_TEXT_*   — text integrity (truncation, placeholders)
 *   ECG_REC_*    — recommendation integrity
 *   ECG_ART_*    — artifact completeness (required fields)
 */

import { getECGMode, type ECGMode } from '@/lib/evaluation/policy';
import {
  trimAtSentenceBoundary as trimAtSentenceBoundaryShared,
  detectProseScoreDivergence,
  detectRawFallbackSentinel,
  endsMidSentence,
} from '@/lib/text/authorFacingProse';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum Jaccard similarity that triggers an identity duplication fatal. */
const IDENTITY_OVERLAP_THRESHOLD = 0.72;

/** Minimum chars for a meaningful text field. */
const MIN_MEANINGFUL_LENGTH = 20;

/** Placeholder phrases that indicate unfilled template slots. */
const PLACEHOLDER_PATTERNS = [
  /\[insert\b/i,
  /\bTBD\b/,
  /\bfiller\b/i,
  /lorem ipsum/i,
  /\bPlaceholder\b/i,
  /\bN\/A\b/,
  /\bundefined\b/,
  /\bnull\b/,
];

// ─────────────────────────────────────────────────────────────────────────────
// CERTIFICATION_REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

export type InvariantDomain =
  | 'AUTHORITY'    // Score provenance and consistency
  | 'IDENTITY'     // Separation between distinct content sections
  | 'SUMMARY'      // Executive summary editorial contract
  | 'TEXT'         // Text integrity (truncation, placeholders)
  | 'RECOMMEND'    // Recommendation structure
  | 'COMPLETENESS' // Required field presence
  | 'RENDERER';    // Future: presentation-layer contracts

export type InvariantSeverity = 'FATAL' | 'ADVISORY';

export interface InvariantRegistryEntry {
  /** Unique code, stable across versions. */
  code: string;
  domain: InvariantDomain;
  severity: InvariantSeverity;
  /** Human-readable description of what this invariant enforces. */
  description: string;
  /**
   * Provenance: the authoritative source that OWNS this value.
   * Any mismatch between this source and the artifact field is a certification failure.
   */
  authority: string;
  /** Which artifact section this invariant guards. */
  section: string;
  /** Tags for coverage reporting (analogous to SIPOC rows). */
  tags: string[];
}

/**
 * CERTIFICATION_REGISTRY — the canonical list of all 28 invariants.
 * Query by domain for coverage reporting; query by code for test linkage.
 */
export const CERTIFICATION_REGISTRY: InvariantRegistryEntry[] = [
  // ── AUTHORITY domain (score provenance) ─────────────────────────────────
  {
    code: 'ECG_AUTH_SCORE_MISMATCH',
    domain: 'AUTHORITY',
    severity: 'FATAL',
    description: 'overview.overall_score_0_100 must equal weighted.overall_score_0_100 from the scoring engine.',
    authority: 'weighted.overall_score_0_100 (computeWeightedScore)',
    section: 'overview.overall_score_0_100',
    tags: ['score', 'provenance', 'authority-chain'],
  },
  {
    code: 'ECG_AUTH_EXEC_SUMMARY_SCORE_MISMATCH',
    domain: 'AUTHORITY',
    severity: 'FATAL',
    description: 'Executive summary may not reference a score value that differs from the canonical score. Score hallucination by Pass 3 must cause regeneration, not silent repair.',
    authority: 'weighted.overall_score_0_100 (computeWeightedScore)',
    section: 'overview.one_paragraph_summary',
    tags: ['score', 'provenance', 'pass3', 'exec-summary'],
  },
  {
    code: 'ECG_AUTH_CRITERION_SCORE_RANGE',
    domain: 'AUTHORITY',
    severity: 'FATAL',
    description: 'Every criterion score must be an integer in [0, 10].',
    authority: 'Pass 1 + Pass 2 scoring (computeWeightedScore)',
    section: 'criteria[].final_score_0_10',
    tags: ['score', 'criteria', 'range'],
  },

  // ── IDENTITY domain (content separation) ────────────────────────────────
  {
    code: 'ECG_IDENT_PITCH_DUPLICATION',
    domain: 'IDENTITY',
    severity: 'FATAL',
    description: 'one_sentence_pitch and one_paragraph_pitch must be editorially distinct. They serve different market purposes: hook vs. synopsis.',
    authority: 'Pass 3 synthesis (runPass3Synthesis)',
    section: 'overview.one_sentence_pitch / overview.one_paragraph_pitch',
    tags: ['pitch', 'identity', 'pass3'],
  },
  {
    code: 'ECG_IDENT_PITCH_SUMMARY_OVERLAP',
    domain: 'IDENTITY',
    severity: 'FATAL',
    description: 'Pitch fields must not substantially duplicate the executive summary. Executive summary is editorial; pitches are market-facing.',
    authority: 'Pass 3 synthesis (runPass3Synthesis)',
    section: 'overview.one_sentence_pitch / overview.one_paragraph_summary',
    tags: ['pitch', 'identity', 'exec-summary'],
  },
  {
    code: 'ECG_IDENT_PITCH_PREMISE_OVERLAP',
    domain: 'IDENTITY',
    severity: 'FATAL',
    description: 'Pitch fields must not be copied from enrichment.premise. Premise is a raw descriptor; pitches are crafted editorial text.',
    authority: 'Pass 3 synthesis (runPass3Synthesis)',
    section: 'overview.one_paragraph_pitch / enrichment.premise',
    tags: ['pitch', 'premise', 'identity'],
  },

  // ── SUMMARY domain (executive summary contract) ──────────────────────────
  {
    code: 'ECG_EXEC_MISSING',
    domain: 'SUMMARY',
    severity: 'FATAL',
    description: 'Executive summary must be present and substantive. It must answer: why this score, strongest craft elements, principal blocker, first revision priority.',
    authority: 'Pass 3 synthesis (runPass3Synthesis)',
    section: 'overview.one_paragraph_summary',
    tags: ['exec-summary', 'completeness'],
  },
  {
    code: 'ECG_EXEC_PITCH_LANGUAGE',
    domain: 'SUMMARY',
    severity: 'FATAL',
    description: 'Executive summary must not contain marketing or jacket-copy language. It is an editorial diagnostic, not a sales pitch.',
    authority: 'Pass 3 synthesis (runPass3Synthesis)',
    section: 'overview.one_paragraph_summary',
    tags: ['exec-summary', 'tone'],
  },
  {
    code: 'ECG_EXEC_NO_EVAL_LANGUAGE',
    domain: 'SUMMARY',
    severity: 'FATAL',
    description: 'Executive summary must contain evaluation language (criterion names, score references, or revision direction). It must diagnose, not describe.',
    authority: 'Pass 3 synthesis (runPass3Synthesis)',
    section: 'overview.one_paragraph_summary',
    tags: ['exec-summary', 'content'],
  },
  {
    code: 'ECG_EXEC_SCORE_ABSENT',
    domain: 'SUMMARY',
    severity: 'ADVISORY',
    description: 'Executive summary does not reference the canonical score. Recommended but not required.',
    authority: 'Pass 3 synthesis (runPass3Synthesis)',
    section: 'overview.one_paragraph_summary',
    tags: ['exec-summary', 'score', 'advisory'],
  },

  // ── TEXT domain (integrity) ───────────────────────────────────────────────
  {
    code: 'ECG_TEXT_TRUNCATED_WORD',
    domain: 'TEXT',
    severity: 'FATAL',
    description: 'A text field contains a truncated word or incomplete sentence. Likely caused by a hard character-count cut mid-token. Use trimAtWordBoundary before persistence.',
    authority: 'normalizeArtifact() pre-stage',
    section: 'any text field',
    tags: ['truncation', 'text-integrity'],
  },
  {
    code: 'ECG_TEXT_PLACEHOLDER',
    domain: 'TEXT',
    severity: 'FATAL',
    description: 'A text field contains placeholder text ([insert], TBD, N/A, etc.). All template slots must be filled before certification.',
    authority: 'Pass 3 synthesis (runPass3Synthesis)',
    section: 'any text field',
    tags: ['placeholder', 'text-integrity'],
  },
  {
    code: 'ECG_TEXT_MIDSENTENCE_TERMINATION',
    domain: 'TEXT',
    severity: 'FATAL',
    description: 'A full-sentence author-facing text field (pitch/premise/strength/risk) ends mid-sentence — no terminal punctuation, or a dangling connective/comma/colon/semicolon/em-dash/open-bracket. Global invariant: no author-facing text may end mid-sentence.',
    authority: 'Pass 3 synthesis (runPass3Synthesis)',
    section: 'overview pitches / enrichment.premise / strengths / risks',
    tags: ['truncation', 'text-integrity', 'mid-sentence'],
  },

  // ── RECOMMEND domain (recommendation structure) ──────────────────────────
  {
    code: 'ECG_REC_TOO_SHORT',
    domain: 'RECOMMEND',
    severity: 'FATAL',
    description: 'Recommendation action is shorter than 50 chars. Recommendations must be actionable editorial directives.',
    authority: 'Pass 3 synthesis (runPass3Synthesis)',
    section: 'recommendations[].action',
    tags: ['recommendations', 'length'],
  },
  {
    code: 'ECG_REC_PLACEHOLDER',
    domain: 'RECOMMEND',
    severity: 'FATAL',
    description: 'Recommendation action contains placeholder text. Must be fully generated.',
    authority: 'Pass 3 synthesis (runPass3Synthesis)',
    section: 'recommendations[].action',
    tags: ['recommendations', 'placeholder'],
  },
  {
    code: 'ECG_REC_LOWERCASE_START',
    domain: 'RECOMMEND',
    severity: 'ADVISORY',
    description: 'Recommendation action starts with a lowercase letter. normalizeArtifact() should have fixed this before certification.',
    authority: 'normalizeArtifact() pre-stage',
    section: 'recommendations[].action',
    tags: ['recommendations', 'typography', 'advisory'],
  },
  {
    code: 'ECG_REC_MISSING_TERMINAL_PUNCT',
    domain: 'RECOMMEND',
    severity: 'ADVISORY',
    description: 'Recommendation action does not end with terminal punctuation. normalizeArtifact() should have fixed this.',
    authority: 'normalizeArtifact() pre-stage',
    section: 'recommendations[].action',
    tags: ['recommendations', 'typography', 'advisory'],
  },

  // ── COMPLETENESS domain (required fields) ────────────────────────────────
  {
    code: 'ECG_ART_MISSING_EXEC_SUMMARY',
    domain: 'COMPLETENESS',
    severity: 'FATAL',
    description: 'overview.one_paragraph_summary is absent or empty.',
    authority: 'Pass 3 synthesis (runPass3Synthesis)',
    section: 'overview.one_paragraph_summary',
    tags: ['completeness', 'exec-summary'],
  },
  {
    code: 'ECG_ART_MISSING_SENTENCE_PITCH',
    domain: 'COMPLETENESS',
    severity: 'FATAL',
    description: 'overview.one_sentence_pitch is absent or empty. Pass 3 must generate a distinct market hook.',
    authority: 'Pass 3 synthesis (runPass3Synthesis)',
    section: 'overview.one_sentence_pitch',
    tags: ['completeness', 'pitch'],
  },
  {
    code: 'ECG_ART_MISSING_PARAGRAPH_PITCH',
    domain: 'COMPLETENESS',
    severity: 'FATAL',
    description: 'overview.one_paragraph_pitch is absent or empty. Pass 3 must generate a distinct story synopsis.',
    authority: 'Pass 3 synthesis (runPass3Synthesis)',
    section: 'overview.one_paragraph_pitch',
    tags: ['completeness', 'pitch'],
  },
  {
    code: 'ECG_ART_MISSING_PREMISE',
    domain: 'COMPLETENESS',
    severity: 'FATAL',
    description: 'enrichment.premise is absent or empty.',
    authority: 'Pass 3 enrichment (computeEnrichment)',
    section: 'enrichment.premise',
    tags: ['completeness', 'enrichment'],
  },
  {
    code: 'ECG_ART_MISSING_STRENGTHS',
    domain: 'COMPLETENESS',
    severity: 'FATAL',
    description: 'top_3_strengths is absent or has no meaningful entries.',
    authority: 'Pass 3 synthesis (runPass3Synthesis)',
    section: 'overview.top_3_strengths',
    tags: ['completeness', 'strengths'],
  },
  {
    code: 'ECG_ART_MISSING_RISKS',
    domain: 'COMPLETENESS',
    severity: 'FATAL',
    description: 'top_3_risks is absent or has no meaningful entries.',
    authority: 'Pass 3 synthesis (runPass3Synthesis)',
    section: 'overview.top_3_risks',
    tags: ['completeness', 'risks'],
  },
  {
    code: 'ECG_ART_MISSING_RATIONALE',
    domain: 'COMPLETENESS',
    severity: 'FATAL',
    description: 'One or more scored criteria are missing their final_rationale.',
    authority: 'Pass 2 + Pass 3 scoring',
    section: 'criteria[].final_rationale',
    tags: ['completeness', 'criteria', 'rationale'],
  },
  {
    code: 'ECG_ART_MISSING_CONFIDENCE',
    domain: 'COMPLETENESS',
    severity: 'FATAL',
    description: 'governance.confidence is absent. Must be set before certification.',
    authority: 'criterionConfidence.ts (computeCriterionConfidence)',
    section: 'governance.confidence',
    tags: ['completeness', 'governance', 'confidence'],
  },
  {
    code: 'ECG_ART_MISSING_RECOMMENDATIONS',
    domain: 'COMPLETENESS',
    severity: 'FATAL',
    description: 'No quick_wins or strategic_revisions present. Every evaluation must produce at least one actionable recommendation.',
    authority: 'Pass 3 synthesis (runPass3Synthesis)',
    section: 'recommendations',
    tags: ['completeness', 'recommendations'],
  },

  // ── RENDERER domain (presentation contracts) ─────────────────────────────
  {
    code: 'ECG_RENDERER_VERDICT_UNKNOWN',
    domain: 'RENDERER',
    severity: 'FATAL',
    description: 'overview.verdict must be a recognized value (e.g. "market_ready", "not_market_ready", "conditional"). Unknown values will cause renderer failures.',
    authority: 'market_readiness_calculator',
    section: 'overview.verdict',
    tags: ['renderer', 'verdict'],
  },
  {
    code: 'ECG_RENDERER_GENRE_MISSING',
    domain: 'RENDERER',
    severity: 'ADVISORY',
    description: 'enrichment.diagnosed_genre is absent. Genre is displayed on the report header.',
    authority: 'Pass 3 enrichment (computeEnrichment)',
    section: 'enrichment.diagnosed_genre',
    tags: ['renderer', 'enrichment', 'advisory'],
  },
  {
    code: 'ECG_RENDERER_AUDIENCE_MISSING',
    domain: 'RENDERER',
    severity: 'ADVISORY',
    description: 'enrichment.target_audience is absent. Audience context is displayed on the report.',
    authority: 'Pass 3 enrichment (computeEnrichment)',
    section: 'enrichment.target_audience',
    tags: ['renderer', 'enrichment', 'advisory'],
  },
  {
    code: 'ECG_RENDERER_SCORE_LABEL_MISMATCH',
    domain: 'RENDERER',
    severity: 'FATAL',
    description: 'governance.confidence_label must be present when confidence is set. The renderer cannot display a confidence badge without a label.',
    authority: 'criterionConfidence.ts (computeCriterionConfidence)',
    section: 'governance.confidence_label',
    tags: ['renderer', 'governance', 'confidence'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Registry helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Look up a registry entry by code. Returns undefined if not found (unknown code). */
export function getRegistryEntry(code: string): InvariantRegistryEntry | undefined {
  return CERTIFICATION_REGISTRY.find((e) => e.code === code);
}

/** Return all registry entries for a given domain. */
export function getRegistryByDomain(domain: InvariantDomain): InvariantRegistryEntry[] {
  return CERTIFICATION_REGISTRY.filter((e) => e.domain === domain);
}

/** Produce a coverage summary analogous to SIPOC gap tracking. */
export function getCertificationCoverage(): Record<InvariantDomain, { total: number; fatal: number; advisory: number }> {
  const domains: InvariantDomain[] = ['AUTHORITY', 'IDENTITY', 'SUMMARY', 'TEXT', 'RECOMMEND', 'COMPLETENESS', 'RENDERER'];
  return Object.fromEntries(
    domains.map((d) => {
      const entries = getRegistryByDomain(d);
      return [d, {
        total: entries.length,
        fatal: entries.filter((e) => e.severity === 'FATAL').length,
        advisory: entries.filter((e) => e.severity === 'ADVISORY').length,
      }];
    }),
  ) as Record<InvariantDomain, { total: number; fatal: number; advisory: number }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Input shape
// ─────────────────────────────────────────────────────────────────────────────

export interface ECGOverview {
  overall_score_0_100?: number | null;
  verdict?: string | null;
  one_paragraph_summary?: string | null;
  one_sentence_pitch?: string | null;
  one_paragraph_pitch?: string | null;
  top_3_strengths?: string[] | null;
  top_3_risks?: string[] | null;
}

export interface ECGEnrichment {
  premise?: string | null;
  diagnosed_genre?: string | null;
  target_audience?: string | null;
}

export interface ECGRecommendation {
  action?: string | null;
}

export interface ECGRecommendations {
  quick_wins?: ECGRecommendation[] | null;
  strategic_revisions?: ECGRecommendation[] | null;
}

export interface ECGCriterion {
  key?: string | null;
  final_score_0_10?: number | null;
  final_rationale?: string | null;
}

export interface ECGGovernance {
  confidence?: number | null;
  confidence_label?: string | null;
}

export interface ECGInput {
  /** The computed canonical overall score — the only score authority. */
  canonicalScore: number;
  overview: ECGOverview;
  enrichment?: ECGEnrichment | null;
  recommendations?: ECGRecommendations | null;
  criteria?: ECGCriterion[] | null;
  governance?: ECGGovernance | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Output shape
// ─────────────────────────────────────────────────────────────────────────────

export type ECGStatus = 'CERTIFIED' | 'CERTIFICATION_FAILED' | 'SKIPPED';

export interface ECGViolation {
  code: string;
  domain: InvariantDomain;
  severity: InvariantSeverity;
  /** Human-readable failure message with context values. */
  message: string;
  /** Artifact section that failed. */
  section: string;
  /** Authority source that owns the correct value. */
  authority: string;
}

export interface ECGResult {
  status: ECGStatus;
  mode: ECGMode;
  /** All violations found (FATAL + ADVISORY). */
  violations: ECGViolation[];
  /** FATAL violations only. Empty → certifiable. */
  fatal: ECGViolation[];
  /** ADVISORY violations only. Never block certification. */
  advisory: ECGViolation[];
  /** ISO timestamp. */
  certified_at: string;
  /** One-line summary for logging and governance.warnings. */
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers (internal — not exported, no mutation)
// ─────────────────────────────────────────────────────────────────────────────

function norm(text: string | null | undefined): string {
  return (text ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function meaningful(text: string | null | undefined, minLen = MIN_MEANINGFUL_LENGTH): boolean {
  return (text ?? '').trim().length >= minLen;
}

function jaccardWords(a: string, b: string): number {
  const wordsA = new Set(norm(a).split(/\s+/).filter(Boolean));
  const wordsB = new Set(norm(b).split(/\s+/).filter(Boolean));
  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const w of wordsA) if (wordsB.has(w)) intersection++;
  return intersection / (wordsA.size + wordsB.size - intersection);
}

function isSubstantiallyIdentical(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  return jaccardWords(a, b) >= IDENTITY_OVERLAP_THRESHOLD;
}

function hasPlaceholder(text: string): boolean {
  return PLACEHOLDER_PATTERNS.some((p) => p.test(text));
}

function extractScoreMentions(text: string): number[] {
  const matches: number[] = [];
  const re = /\b(\d{1,3})\/100\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    matches.push(parseInt(m[1], 10));
  }
  return matches;
}

function hasTruncatedWord(text: string): boolean {
  const t = (text ?? '').trim();
  if (!t) return false;
  if (t.endsWith('…') || t.endsWith('...')) return false;
  const lastCharVal = t.charAt(t.length - 1);
  if (/[a-z]$/i.test(lastCharVal)) {
    const tokens = t.split(/\s+/);
    const last = tokens[tokens.length - 1];
    if (last.length < 3) return true;
    if (
      last.length >= 5 &&
      /[aeiou]$/i.test(last) &&
      !/(?:tion|ance|ence|ure|age|ive|ize|ise|ate|ous|ful|ness|ment|ity|ary|ory|ery|ing|ed|er|est|al|ic|ical|ia|ea)$/i.test(last)
    ) {
      return true;
    }
  }
  return /[a-z]{4,}[^a-z\s.!?,;:'")\]}\-—–]\s/i.test(text);
}

/** Build a violation from a registry entry + runtime context message. */
function violation(code: string, message: string): ECGViolation {
  const entry = getRegistryEntry(code);
  return {
    code,
    domain: entry?.domain ?? 'COMPLETENESS',
    severity: entry?.severity ?? 'FATAL',
    message,
    section: entry?.section ?? 'unknown',
    authority: entry?.authority ?? 'unknown',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Invariant checkers (pure — read-only, no mutation)
// ─────────────────────────────────────────────────────────────────────────────

function checkAuthority(input: ECGInput): ECGViolation[] {
  const vs: ECGViolation[] = [];
  const reported = input.overview.overall_score_0_100;

  // AUTH-1: Overview score must equal canonical
  if (reported !== input.canonicalScore) {
    vs.push(violation(
      'ECG_AUTH_SCORE_MISMATCH',
      `overview.overall_score_0_100 is ${reported} but canonical score is ${input.canonicalScore}. ` +
      `Authority: weighted.overall_score_0_100 (computeWeightedScore). ` +
      `Do not patch the score — fix the assembly that writes overview.overall_score_0_100.`,
    ));
  }

  // AUTH-2: Executive summary must not reference a different score.
  //
  // Uses the shared, pure detectProseScoreDivergence inspector. The gate (this
  // function) keeps ALL authority — the helper only reports the facts. Two
  // directions are distinguished so the message is actionable:
  //   - inflation (prose > canonical): a hard FLOOR-POLICY violation ("always
  //     round DOWN — never inflate"). The gate must NEVER reconcile upward.
  //   - non-inflating divergence (prose < canonical, e.g. floor-vs-round 64-vs-68):
  //     still a mismatch the author must not see; regenerate with score grounding
  //     (or reconcile the prose DOWN to the canonical value — never up).
  const summary = input.overview.one_paragraph_summary ?? '';
  if (summary) {
    const divergence = detectProseScoreDivergence(summary, input.canonicalScore);
    if (divergence.diverges) {
      const wrong = divergence.proseScores.filter((s) => s !== input.canonicalScore);
      const floorNote = divergence.inflates
        ? `At least one prose score EXCEEDS the canonical score — this violates the floor rounding policy ("always round down, never inflate"). ` +
          `Never reconcile the prose upward. `
        : `Prose score is at or below canonical (e.g. a floor-vs-round divergence). ` +
          `Reconcile downward toward the canonical value or regenerate — never inflate. `;
      vs.push(violation(
        'ECG_AUTH_EXEC_SUMMARY_SCORE_MISMATCH',
        `Executive summary references ${wrong.map(s => `${s}/100`).join(', ')} but canonical score is ${input.canonicalScore}/100. ` +
        floorNote +
        `Regenerate Pass 3 with explicit score grounding — do not patch the text upward.`,
      ));
    }
  }

  // AUTH-3: Criterion scores must be integers 0–10
  const bad = (input.criteria ?? []).filter((c) => {
    const s = c.final_score_0_10;
    return s !== null && s !== undefined && (!Number.isInteger(s) || s < 0 || s > 10);
  });
  if (bad.length > 0) {
    vs.push(violation(
      'ECG_AUTH_CRITERION_SCORE_RANGE',
      `${bad.length} criterion/criteria have scores outside integer [0, 10]: ${bad.map(c => `${c.key}=${c.final_score_0_10}`).join(', ')}.`,
    ));
  }

  return vs;
}

function checkIdentity(input: ECGInput): ECGViolation[] {
  const vs: ECGViolation[] = [];
  const sentence = input.overview.one_sentence_pitch ?? '';
  const paragraph = input.overview.one_paragraph_pitch ?? '';
  const summary = input.overview.one_paragraph_summary ?? '';
  const premise = input.enrichment?.premise ?? '';

  type Pair = [string, string, string, string];
  const pairs: Pair[] = [
    [sentence, paragraph,  'one_sentence_pitch',  'one_paragraph_pitch'],
    [sentence, summary,    'one_sentence_pitch',  'one_paragraph_summary'],
    [paragraph, summary,   'one_paragraph_pitch', 'one_paragraph_summary'],
    [sentence, premise,    'one_sentence_pitch',  'premise'],
    [paragraph, premise,   'one_paragraph_pitch', 'premise'],
  ];

  for (const [a, b, aLabel, bLabel] of pairs) {
    if (!meaningful(a) || !meaningful(b)) continue;
    if (!isSubstantiallyIdentical(a, b)) continue;

    // Map pair to correct registry code
    let code = 'ECG_IDENT_PITCH_DUPLICATION';
    if (bLabel === 'one_paragraph_summary' || aLabel === 'one_paragraph_summary') {
      code = 'ECG_IDENT_PITCH_SUMMARY_OVERLAP';
    } else if (bLabel === 'premise' || aLabel === 'premise') {
      code = 'ECG_IDENT_PITCH_PREMISE_OVERLAP';
    }

    vs.push(violation(
      code,
      `"${aLabel}" and "${bLabel}" are substantially identical (Jaccard ≥ ${IDENTITY_OVERLAP_THRESHOLD} or containment). ` +
      `These fields serve distinct editorial purposes. Regenerate the offending Pass 3 field — do not deduplicate algorithmically.`,
    ));
  }

  return vs;
}

function checkSummary(input: ECGInput): ECGViolation[] {
  const vs: ECGViolation[] = [];
  const summary = (input.overview.one_paragraph_summary ?? '').trim();

  if (!meaningful(summary)) {
    vs.push(violation('ECG_EXEC_MISSING',
      'overview.one_paragraph_summary is absent or too short. Must answer: why this score, strongest craft elements, principal blocker, first revision priority.'));
    return vs; // remaining checks meaningless without a summary
  }

  const pitchPhrases = [
    /\bgrab\b.*\breader\b/i,
    /\bpage-turner\b/i,
    /\bcan't put it down\b/i,
    /\bmust[- ]read\b/i,
  ];
  if (pitchPhrases.some((p) => p.test(summary))) {
    vs.push(violation('ECG_EXEC_PITCH_LANGUAGE',
      'Executive summary contains marketing/jacket-copy language. Must be an editorial diagnostic, not a pitch.'));
  }

  const hasEvalLang = /\b(criterion|criteria|score|revision|craft|narrative|prose|pacing|voice|dialogue|character)\b/i.test(summary);
  if (!hasEvalLang) {
    vs.push(violation('ECG_EXEC_NO_EVAL_LANGUAGE',
      'Executive summary lacks evaluation language (criterion names, score references, revision direction). Must diagnose, not describe.'));
  }

  // ADVISORY: score mention present (encouraged but not required)
  const mentions = extractScoreMentions(summary);
  if (mentions.length === 0) {
    vs.push(violation('ECG_EXEC_SCORE_ABSENT',
      `Executive summary does not reference the canonical score (${input.canonicalScore}/100). Recommended for reader orientation.`));
  }

  if (hasTruncatedWord(summary)) {
    vs.push(violation('ECG_TEXT_TRUNCATED_WORD',
      `Executive summary appears truncated mid-word. normalizeArtifact() must trim at word boundary before gate runs.`));
  }

  if (hasPlaceholder(summary)) {
    vs.push(violation('ECG_TEXT_PLACEHOLDER',
      `Executive summary contains placeholder text. All template slots must be filled before certification.`));
  }

  return vs;
}

function checkText(input: ECGInput): ECGViolation[] {
  const vs: ECGViolation[] = [];

  const fields: Array<[string, string | null | undefined]> = [
    ['one_sentence_pitch', input.overview.one_sentence_pitch],
    ['one_paragraph_pitch', input.overview.one_paragraph_pitch],
    ['premise', input.enrichment?.premise],
    ...(input.overview.top_3_strengths ?? []).map((s, i) => [`top_3_strengths[${i}]`, s] as [string, string]),
    ...(input.overview.top_3_risks ?? []).map((s, i) => [`top_3_risks[${i}]`, s] as [string, string]),
  ];

  for (const [label, value] of fields) {
    if (!value?.trim()) continue;
    if (hasTruncatedWord(value)) {
      vs.push(violation('ECG_TEXT_TRUNCATED_WORD',
        `"${label}" appears to contain a truncated word. Run trimAtWordBoundary in normalizeArtifact() before certification.`));
    }
    if (hasPlaceholder(value)) {
      vs.push(violation('ECG_TEXT_PLACEHOLDER',
        `"${label}" contains placeholder text. Fill all template slots before certification.`));
    }
    // Global invariant: known full-sentence prose must not end mid-sentence.
    // endsMidSentence is a pure inspector; this gate keeps the pass/fail authority.
    if (endsMidSentence(value)) {
      vs.push(violation('ECG_TEXT_MIDSENTENCE_TERMINATION',
        `"${label}" ends mid-sentence (missing terminal punctuation or a dangling connective/comma/colon/em-dash/open-bracket). Pass 3 must emit complete sentences: "…${value.trim().slice(-40)}"`));
    }
  }

  for (const c of input.criteria ?? []) {
    if ((c.final_rationale ?? '').trim() && hasPlaceholder(c.final_rationale!)) {
      vs.push(violation('ECG_TEXT_PLACEHOLDER',
        `Criterion "${c.key}" rationale contains placeholder text.`));
    }
  }

  return vs;
}

function checkRecommendations(input: ECGInput): ECGViolation[] {
  const vs: ECGViolation[] = [];

  const allRecs: Array<[ECGRecommendation, string]> = [
    ...(input.recommendations?.quick_wins ?? []).map(r => [r, 'quick_wins'] as [ECGRecommendation, string]),
    ...(input.recommendations?.strategic_revisions ?? []).map(r => [r, 'strategic_revisions'] as [ECGRecommendation, string]),
  ];

  for (const [rec, source] of allRecs) {
    const action = (rec.action ?? '').trim();
    if (!action) continue;

    if (action.length < 50) {
      vs.push(violation('ECG_REC_TOO_SHORT',
        `Recommendation in "${source}" is ${action.length} chars (min 50): "${action}"`));
    }
    if (hasPlaceholder(action)) {
      vs.push(violation('ECG_REC_PLACEHOLDER',
        `Recommendation in "${source}" contains placeholder text: "${action.substring(0, 80)}"`));
    }
    // ADVISORY: typography normalization should have handled these
    if (action.charAt(0) !== action.charAt(0).toUpperCase()) {
      vs.push(violation('ECG_REC_LOWERCASE_START',
        `Recommendation in "${source}" starts lowercase. normalizeArtifact() should have corrected this: "${action.substring(0, 60)}"`));
    }
    if (!/[.!?…)]$/.test(action)) {
      vs.push(violation('ECG_REC_MISSING_TERMINAL_PUNCT',
        `Recommendation in "${source}" lacks terminal punctuation. normalizeArtifact() should have corrected this: "…${action.slice(-40)}"`));
    }
  }

  return vs;
}

function checkCompleteness(input: ECGInput): ECGViolation[] {
  const vs: ECGViolation[] = [];

  if (!meaningful(input.overview.one_paragraph_summary))
    vs.push(violation('ECG_ART_MISSING_EXEC_SUMMARY', 'overview.one_paragraph_summary is absent or empty.'));
  // A pitch that is the raw fallback SENTINEL ("A distinct market hook was not
  // generated…") is effectively ABSENT — it must never certify as satisfied,
  // else the sentinel would leak to the author. detectRawFallbackSentinel is a
  // pure inspector; this gate keeps the pass/fail authority.
  if (!meaningful(input.overview.one_sentence_pitch) || detectRawFallbackSentinel(input.overview.one_sentence_pitch))
    vs.push(violation('ECG_ART_MISSING_SENTENCE_PITCH', 'overview.one_sentence_pitch is absent, empty, or a raw fallback sentinel. Pass 3 must generate a distinct market hook.'));
  if (!meaningful(input.overview.one_paragraph_pitch) || detectRawFallbackSentinel(input.overview.one_paragraph_pitch))
    vs.push(violation('ECG_ART_MISSING_PARAGRAPH_PITCH', 'overview.one_paragraph_pitch is absent, empty, or a raw fallback sentinel. Pass 3 must generate a distinct story synopsis.'));
  if (!meaningful(input.enrichment?.premise))
    vs.push(violation('ECG_ART_MISSING_PREMISE', 'enrichment.premise is absent or empty.'));

  const strengths = (input.overview.top_3_strengths ?? []).filter(s => meaningful(s));
  if (strengths.length < 1)
    vs.push(violation('ECG_ART_MISSING_STRENGTHS', 'top_3_strengths is absent or has no meaningful entries.'));
  const risks = (input.overview.top_3_risks ?? []).filter(s => meaningful(s));
  if (risks.length < 1)
    vs.push(violation('ECG_ART_MISSING_RISKS', 'top_3_risks is absent or has no meaningful entries.'));

  const criteriaWithoutRationale = (input.criteria ?? []).filter(
    c => c.final_score_0_10 !== null && c.final_score_0_10 !== undefined && !meaningful(c.final_rationale),
  );
  if (criteriaWithoutRationale.length > 0)
    vs.push(violation('ECG_ART_MISSING_RATIONALE',
      `${criteriaWithoutRationale.length} scored criterion/criteria missing rationale: ${criteriaWithoutRationale.map(c => c.key).join(', ')}.`));

  if (input.governance?.confidence === null || input.governance?.confidence === undefined)
    vs.push(violation('ECG_ART_MISSING_CONFIDENCE', 'governance.confidence is absent.'));

  const totalRecs =
    (input.recommendations?.quick_wins?.length ?? 0) +
    (input.recommendations?.strategic_revisions?.length ?? 0);
  if (totalRecs === 0)
    vs.push(violation('ECG_ART_MISSING_RECOMMENDATIONS', 'No quick_wins or strategic_revisions present. At least one actionable recommendation is required.'));

  return vs;
}

function checkRenderer(input: ECGInput): ECGViolation[] {
  const vs: ECGViolation[] = [];

  const KNOWN_VERDICTS = new Set([
    'market_ready', 'not_market_ready', 'conditional', 'not_evaluable',
    'coverage_limited', 'withheld',
  ]);
  const verdict = input.overview.verdict ?? '';
  if (verdict && !KNOWN_VERDICTS.has(verdict)) {
    vs.push(violation('ECG_RENDERER_VERDICT_UNKNOWN',
      `overview.verdict "${verdict}" is not a recognized value. Known: ${[...KNOWN_VERDICTS].join(', ')}. The renderer will fail to display the verdict badge.`));
  }

  // ADVISORY: enrichment fields
  if (!meaningful(input.enrichment?.diagnosed_genre)) {
    vs.push(violation('ECG_RENDERER_GENRE_MISSING', 'enrichment.diagnosed_genre is absent. Genre is displayed on the report header.'));
  }
  if (!meaningful(input.enrichment?.target_audience)) {
    vs.push(violation('ECG_RENDERER_AUDIENCE_MISSING', 'enrichment.target_audience is absent. Audience context is displayed on the report.'));
  }

  // governance.confidence_label required when confidence is set.
  // A confidence label is a short controlled-vocabulary badge (e.g.
  // "High Confidence", "Medium", "Low") — NOT free-form prose — so it must be
  // checked for PRESENCE (non-empty), not against the 20-char MIN_MEANINGFUL_LENGTH
  // prose threshold. The prose threshold falsely rejected valid labels like
  // "High Confidence" (15 chars), suppressing the badge the author should see.
  if (
    input.governance?.confidence !== null &&
    input.governance?.confidence !== undefined &&
    !meaningful(input.governance?.confidence_label, 1)
  ) {
    vs.push(violation('ECG_RENDERER_SCORE_LABEL_MISMATCH',
      'governance.confidence is set but governance.confidence_label is absent. The renderer cannot display a confidence badge without a label.'));
  }

  return vs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: trimAtWordBoundary (also used by normalizeArtifact pre-stage)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trim a text string to at most `maxLength` chars at a word boundary,
 * appending an ellipsis. Never cuts mid-word. Exported for use in
 * normalizeArtifact() and qualityGate.ts.
 */
export function trimAtWordBoundary(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  const candidate = text.substring(0, maxLength - 1);
  const lastSpace = candidate.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.6) {
    return candidate.substring(0, lastSpace).replace(/[\s,;:.\u2014\-]+$/u, '') + '\u2026';
  }
  return candidate.replace(/[\s,;:.\u2014\-]+$/u, '') + '\u2026';
}

/**
 * Trim a text string at a COMPLETE-SENTENCE boundary. Governance rule
 * NO_MIDSENTENCE_TRUNCATION: an over-budget field must never be cut mid-sentence
 * (and never mid-word).
 *
 * The implementation lives ONCE in `lib/text/authorFacingProse.ts`; this is a
 * thin re-export so existing importers (normalizeArtifact, qualityGate) keep
 * working. See that module for behavior.
 */
export const trimAtSentenceBoundary = trimAtSentenceBoundaryShared;

// ─────────────────────────────────────────────────────────────────────────────
// Main gate function — verdict only, no mutation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the Artifact Certification Authority gate.
 *
 * The gate is a REFEREE. It reads `input`, runs all invariant checkers,
 * and emits a verdict. It NEVER mutates `input`.
 *
 * Behaviour is controlled by ECG_MODE (from environment via policy.ts):
 *   OFF        → returns SKIPPED immediately (no checks run)
 *   WARN_ONLY  → runs all checks, always returns CERTIFIED, logs violations
 *   ENFORCE    → runs all checks, FATAL violations → CERTIFICATION_FAILED
 *
 * @param input   Read-only snapshot of the assembled evaluation artifact.
 * @returns ECGResult with status, violations, and summary.
 */
export function runEvaluationCertificationGate(input: ECGInput): ECGResult {
  const certified_at = new Date().toISOString();
  const mode = getECGMode();

  if (mode === 'OFF') {
    return {
      status: 'SKIPPED',
      mode,
      violations: [],
      fatal: [],
      advisory: [],
      certified_at,
      summary: 'ECG_MODE=OFF — gate skipped, artifact not certified.',
    };
  }

  // ── Run all invariant checkers (pure, read-only) ─────────────────────────
  const allViolations: ECGViolation[] = [
    ...checkAuthority(input),
    ...checkIdentity(input),
    ...checkSummary(input),
    ...checkText(input),
    ...checkRecommendations(input),
    ...checkCompleteness(input),
    ...checkRenderer(input),
  ];

  const fatal    = allViolations.filter(v => v.severity === 'FATAL');
  const advisory = allViolations.filter(v => v.severity === 'ADVISORY');

  // ── Determine status based on mode ──────────────────────────────────────
  let status: ECGStatus;
  if (mode === 'WARN_ONLY') {
    // Always CERTIFIED in WARN_ONLY — violations are logged, not enforced.
    status = 'CERTIFIED';
  } else {
    // ENFORCE: any FATAL violation blocks certification.
    status = fatal.length === 0 ? 'CERTIFIED' : 'CERTIFICATION_FAILED';
  }

  const summary =
    status === 'CERTIFIED' && fatal.length === 0
      ? `ECG CERTIFIED (mode=${mode}) — 0 fatal, ${advisory.length} advisory. Score=${input.canonicalScore}.`
      : status === 'CERTIFIED' && mode === 'WARN_ONLY'
      ? `ECG WARN_ONLY — ${fatal.length} fatal (not enforced), ${advisory.length} advisory. Score=${input.canonicalScore}. Fatals: ${fatal.map(v => v.code).join(', ')}.`
      : `ECG CERTIFICATION_FAILED (mode=${mode}) — ${fatal.length} fatal, ${advisory.length} advisory. Score=${input.canonicalScore}. Fatals: ${fatal.map(v => v.code).join(', ')}.`;

  return {
    status,
    mode,
    violations: allViolations,
    fatal,
    advisory,
    certified_at,
    summary,
  };
}

/**
 * Build an ECGInput from the assembled evaluation data.
 * This is the ONLY place where ECGInput is constructed — keeps the mapping centralized.
 */
export function buildECGInput(
  result: {
    overview?: ECGOverview | null;
    enrichment?: ECGEnrichment | null;
    recommendations?: ECGRecommendations | null;
    criteria?: ECGCriterion[] | null;
    governance?: ECGGovernance | null;
  },
  canonicalScore: number,
): ECGInput {
  return {
    canonicalScore,
    overview: result.overview ?? {},
    enrichment: result.enrichment ?? null,
    recommendations: result.recommendations ?? null,
    criteria: result.criteria ?? null,
    governance: result.governance ?? null,
  };
}
