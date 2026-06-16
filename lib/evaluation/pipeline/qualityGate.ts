/**
 * Phase 2.7 — Pass 4: Quality Gate (deterministic, no AI)
 *
 * Validates synthesized pipeline output before persistence.
 * Any failed check returns ok=false; no artifact is written.
 *
 * Error codes (spec §3.4):
 *   QG_GENERIC_REC        — recommendation missing anchor snippet
 *   QG_DUPLICATE_REC      — same action text duplicated across criteria
 *   QG_SHORT_REC          — action < 50 chars
 *   QG_LONG_REC           — recommendation action body > 1500 chars (pathological runaway)
 *   QG_LONG_EVIDENCE      — evidence snippet > 200 chars (keep concise for card display)
 *   QG_LONG_OVERVIEW      — one_paragraph_summary > 800 chars (751-800 auto-repaired)
 *   QG_CRITERIA_MISSING   — output does not contain all 13 criteria
 *   QG_SCORE_RANGE        — score not in integer 0-10
 *   QG_CONSEQUENCE_CONTRACT — missing pressure/decision/consequence contract fields
 *   QG_THIN_RATIONALE      — criterion rationale < 40 chars
 *   QG_PLACEHOLDER_RATIONALE — criterion rationale includes known placeholder phrasing
 *   QG_LOW_EVIDENCE_COVERAGE — too many criteria lack substantive evidence snippets
 *   QG_MISSING_REQUIRED_EVIDENCE — required spine criteria missing substantive evidence snippets
 *   QG_INDEPENDENCE_VIOLATION — Pass 2 reuses non-manuscript rationale phrasing from Pass 1
 *   QG_DUPLICATE_STRATEGIC_LEVER — two or more recs share same lever without distinct granularity/evidence
 *   QG_CONFIRMED_RATIONALE — agree-state criterion still contains "Confirmed." stub rationale
 *   QG_CRITERIA_SCOPE_SHAPE_MISMATCH — criterion status/score/scorability mismatches scope policy plan
 *   QG_REC_INTEGRITY_FAIL — recommendation failed integrity gate (FAIL tier: malformed text, missing fields, etc.)
 *   QG_EVIDENCE_FABRICATION — >50% of anchor_snippets are not grounded in manuscript text (systemic fabrication)
 */

import { createHash } from "node:crypto";
import { CRITERIA_KEYS, type CriterionKey } from "@/schemas/criteria-keys";
import { buildRedundancyKey, fullyRedundant, sameStrategicLever, normalizeIssueFamily, normalizeStrategicLever, normalizeRevisionGranularity } from "./recommendationSemantics";
import { PLACEHOLDER_RATIONALE_PATTERNS } from "./placeholderRationalePatterns";
import type {
  SynthesisOutput,
  QualityGateResult,
  QualityGateCheck,
  SinglePassOutput,
  EditorialDiagnostic,
  EditorialDiagnosticClassification,
  QualityGateCriterionDiagnostic,
} from "./types";
import { analyzePovRendering } from "@/lib/evaluation/pov/analyzePovRendering";
import { analyzeDialogueAttribution, analyzeDialogueAttributionForGate } from "@/lib/evaluation/pov/analyzeDialogueAttribution";
import { validatePovCriterionEvidence } from "@/lib/evaluation/pov/validatePovCriterionEvidence";
import { isGenreUncalibratedPhrasing } from "@/lib/evaluation/genreExpectationProfiles";
import type { EvaluationResultV2 } from "@/schemas/evaluation-result-v2";
import type { EvaluationArtifact } from "./types";
import type { ArtifactGateDecision } from "./gates";
import { evaluateArtifactGate } from "./gates";
import {
  isCriterionComplete,
  minAnchorsFor,
} from "@/lib/evaluation/signal/criterionObservability";
import { DIALOGUE_MECHANISM_MARKERS } from "./mechanismMarkers";
import {
  checkRecommendationIntegrity,
  meetsMinimumTier,
  type IntegrityResult,
} from "./recommendationIntegrityGate";
import { scopePolicy } from "@/lib/evaluation/signal/scopePolicy";
import {
  computeManuscriptCertification,
  criterionClaimScope,
} from "@/lib/evaluation/signal/manuscriptClaimPolicy";
import type { SubmissionScopeProfile } from "./submissionScope";
import {
  summarizePropagationIntegrity,
  summaryMentionsBottomWeakness,
} from "./propagationIntegrity";
import { buildEditorialDiagnosticsSummary } from "@/lib/evaluation/harness/report";
import {
  EDITORIAL_ANCHOR_HINT_MARKERS,
  EDITORIAL_CONTEXT_MARKERS,
  EDITORIAL_FIX_MARKERS,
  EDITORIAL_MECHANISM_MARKERS,
  EDITORIAL_READER_EFFECT_MARKERS,
  EDITORIAL_SYMPTOM_MARKERS,
} from "./editorialRecommendationContract";
import {
  runEvidenceGroundingGate,
  stampAnchorTypes,
  type EvidenceGroundingReport,
} from "./evidenceGroundingGate";

export const QG_MIN_REC_LENGTH = 50;
/** Pathological runaway cap for the recommendation action body. Display teasers rendered from
 * this field should be truncated in the UI layer; the pipeline allows substantive editorial text. */
export const QG_MAX_REC_LENGTH = 1500;
export const QG_MAX_EVIDENCE_LENGTH = 300;
export const QG_EVIDENCE_HARD_CEILING = 350;
export const QG_MAX_OVERVIEW_LENGTH = 750;
/** Hard ceiling: overview beyond this length is a true LLM runaway, not post-processing drift. */
export const QG_OVERVIEW_HARD_CEILING = 800;
export const QG_INDEPENDENCE_NGRAM_SIZE = 8;
export const QG_INDEPENDENCE_MIN_OVERLAPS_PER_CRITERION = 6;
export const QG_INDEPENDENCE_RATIONALE_PREVIEW_CHARS = 320;

/**
 * Word-count-aware independence overlap threshold.
 *
 * Short manuscripts produce shorter, more constrained rationale that
 * naturally shares more phrasing across passes. Using the flat threshold
 * of 6 causes false-positive QG_INDEPENDENCE_VIOLATION on short-form
 * submissions (see #309, #278).
 *
 * Tiers (word count → min overlaps):
 *   < 5,000 words  → 12  (very short — high natural overlap)
 *   < 15,000 words → 10  (short story / novelette)
 *   < 25,000 words →  8  (novella boundary)
 *   ≥ 25,000 words →  6  (novel-length — original threshold)
 */
export function independenceOverlapThreshold(wordCount: number | undefined): number {
  if (wordCount === undefined) return QG_INDEPENDENCE_MIN_OVERLAPS_PER_CRITERION;
  if (wordCount < 5_000) return 12;
  if (wordCount < 15_000) return 10;
  if (wordCount < 25_000) return 8;
  return QG_INDEPENDENCE_MIN_OVERLAPS_PER_CRITERION;
}
export const QG_MIN_RATIONALE_LENGTH = 40;
export const QG_MIN_EVIDENCE_COVERED_CRITERIA = 10;
export const QG_MIN_EVIDENCE_SNIPPET_LENGTH = 20;
export const QG_MAX_HIGH_SCORE_WHEN_LOW_CONFIDENCE = 5;
export const QG_MAX_HIGH_SCORE_WHEN_LOW_CONFIDENCE_BY_KEY: Record<CriterionKey, number> = {
  concept: 5,
  narrativeDrive: 5,
  character: 5,
  voice: 5,
  sceneConstruction: 5,
  dialogue: 5,
  theme: 5,
  worldbuilding: 5,
  pacing: 5,
  proseControl: 7,
  tone: 5,
  narrativeClosure: 5,
  marketability: 5,
};
export const QG_PLACEHOLDER_RATIONALE_PATTERNS = PLACEHOLDER_RATIONALE_PATTERNS;
export const QG_SPINE_CRITERIA_REQUIRED_EVIDENCE = Object.freeze<CriterionKey[]>([
  "concept",
  "narrativeDrive",
  "character",
  "voice",
  "sceneConstruction",
]);
export const QG_POV_MECHANISM_MARKERS = Object.freeze([
  "integrated",
  "italics",
  "thought",
  "cognition",
  "quotation",
  "quote",
  "audible",
  "attribution",
  "dialogue tag",
  "speaker",
  "pov",
    "first person",
  "third person",
  "close third",
  "free indirect",
  "indirect discourse",
  "interior",
  "interiority",
  "internal",
  "psychic distance",
  "narrative distance",
  "focali",
  "perspective",
  "narrat",
  "rendering",
  "diction",
  "register",
  "syntax",
  "tense",
  "rhythm",
  "tone",
  "cadence",
  "sensory",
  "embodied",
  "visceral",
  "somatic",
]);

function maxLowConfidenceScoreFor(key: CriterionKey): number {
  return QG_MAX_HIGH_SCORE_WHEN_LOW_CONFIDENCE_BY_KEY[key] ?? QG_MAX_HIGH_SCORE_WHEN_LOW_CONFIDENCE;
}

// --- PR-1: Scope governance quality gates ---
export const QG_INTERNAL_LEAKAGE_PATTERNS = /direct_speech|reported_speech|tagged_speech|tagless_exchange/i;
export const QG_FILLER_VERBS = /^(enhance|deepen|refine|maintain|continue|strengthen|improve)\b/i;
const QG_EDITORIAL_SIGNAL_HASH_LEN = 16;
const QG_EDITORIAL_DIAGNOSTIC_MAX_ACTION_CHARS = 160;
const QG_EDITORIAL_DIAGNOSTIC_MAX_EXPECTED_IMPACT_CHARS = 160;
const QG_EDITORIAL_DIAGNOSTIC_MAX_ANCHOR_CHARS = 120;
const QG_EDITORIAL_DIAGNOSTIC_MAX_FAILURE_REASON_CHARS = 220;
const QG_EDITORIAL_BLOCK_INVALID_RATIO = 0.5;
const QG_EDITORIAL_BLOCK_CRITERIA_RATIO = 0.5;
// Minimum number of invalid recommendations to escalate to BLOCK (systemic threshold).
// Default 12: requires ratio signal OR a genuinely systemic raw count before blocking.
// Set EVAL_EDITORIAL_BLOCK_MIN_INVALID_RECS env var to override (range: 3–30).
const QG_EDITORIAL_BLOCK_MIN_INVALID_RECS = (() => {
  const raw = process.env.EVAL_EDITORIAL_BLOCK_MIN_INVALID_RECS;
  if (raw && /^\d+$/.test(raw.trim())) {
    const v = parseInt(raw.trim(), 10);
    if (v >= 3 && v <= 30) return v;
  }
  return 12;
})();
const QG_EDITORIAL_BLOCK_MIN_DUPLICATE_REASONING = 2;

function normalizeEditorialReasoningKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactAndCap(text: string, maxChars: number): string {
  return text.replace(/\s+/g, " ").trim().slice(0, maxChars);
}

export type QualityGateFailureTelemetry = {
  total_failed_checks: number;
  failures_by_error_code: Record<string, number>;
  failed_check_ids: string[];
};

export interface QualityGateV2Result extends QualityGateResult {
  artifactGate: ArtifactGateDecision;
  downgradedResult?: EvaluationResultV2;
}

function normalizeForPhraseMatch(text: string): string {
  return (text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function hasSubstantiveEvidence(evidence: Array<{ snippet: string }>): boolean {
  return evidence.some((e) => e.snippet.trim().length >= QG_MIN_EVIDENCE_SNIPPET_LENGTH);
}

/**
 * Tokenize text for n-gram overlap computation.
 * Exported for use in offline reconstruction tests.
 */
export function tokenizeForOverlap(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/**
 * Collect all n-grams from text using the canonical tokenizer.
 * Exported for use in offline reconstruction tests.
 */
export function collectNgrams(text: string, n: number): string[] {
  const words = tokenizeForOverlap(text);
  if (words.length < n) {
    return [];
  }

  const grams: string[] = [];
  for (let i = 0; i <= words.length - n; i++) {
    grams.push(words.slice(i, i + n).join(" "));
  }
  return grams;
}

function previewRationale(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, QG_INDEPENDENCE_RATIONALE_PREVIEW_CHARS);
}

function buildEditorialSignalId(
  criterionKey: string,
  action: string,
  expectedImpact: string,
  index: number,
): string {
  const seed = `${criterionKey}|${normalizeEditorialReasoningKey(action)}|${normalizeEditorialReasoningKey(expectedImpact)}|${index}`;
  const digest = createHash("sha256").update(seed).digest("hex").slice(0, QG_EDITORIAL_SIGNAL_HASH_LEN);
  return `editorial:${criterionKey}:${digest}:${index}`;
}

function classifyEditorialDiagnostic(
  missingFields: string[],
  duplicateReasoning: boolean,
): EditorialDiagnosticClassification {
  if (duplicateReasoning) return "duplicate_reasoning";
  if (missingFields.includes("anchor/context")) return "missing_anchor";
  if (missingFields.includes("symptom")) return "missing_symptom";
  if (missingFields.includes("mechanism/cause")) return "missing_mechanism";
  if (missingFields.includes("specific_fix/move")) return "missing_fix";
  if (missingFields.includes("reader_effect")) return "missing_reader_effect";
  return "generic_feedback";
}

/**
 * Run all quality gate checks against a SynthesisOutput.
 * Returns a QualityGateResult (pass=true iff all non-warn checks pass).
 */
export function runQualityGate(
  synthesis: SynthesisOutput,
  pass1?: SinglePassOutput,
  pass2?: SinglePassOutput,
  manuscriptText?: string,
  scopeProfile?: import("./submissionScope").SubmissionScopeProfile,
): QualityGateResult {
  const checks: QualityGateCheck[] = [];
  const warnings: string[] = [];
  const editorialDiagnostics: EditorialDiagnostic[] = [];

  // ── Check 1: All 13 criteria present ────────────────────────────────────
  const outputKeys = new Set(synthesis.criteria.map((c) => c.key));
  const missingKeys = CRITERIA_KEYS.filter((k) => !outputKeys.has(k));
  checks.push({
    check_id: "criteria_complete",
    passed: missingKeys.length === 0,
    error_code: missingKeys.length > 0 ? "QG_CRITERIA_MISSING" : undefined,
    details:
      missingKeys.length > 0
        ? `Missing criteria: ${missingKeys.join(", ")}`
        : `All ${CRITERIA_KEYS.length} criteria present`,
  });

  // ── Check 2: Score range (integer 0-10) ──────────────────────────────────
  const badScores: string[] = [];
  for (const c of synthesis.criteria) {
    const scores = [c.final_score_0_10, c.craft_score, c.editorial_score];
    for (const s of scores) {
      if (!Number.isInteger(s) || s < 0 || s > 10) {
        badScores.push(`${c.key}:${s}`);
      }
    }
  }
  checks.push({
    check_id: "score_range",
    passed: badScores.length === 0,
    error_code: badScores.length > 0 ? "QG_SCORE_RANGE" : undefined,
    details:
      badScores.length > 0
        ? `Invalid scores (must be integer 0-10): ${badScores.join(", ")}`
        : "All scores in valid range",
  });

  // ── Check 2b: Consequence-aware contract completeness ───────────────────
  const consequenceContractViolations: string[] = [];
  for (const c of synthesis.criteria) {
    const hasPressure = Array.isArray(c.pressure_points) && c.pressure_points.some((p) => p.trim().length > 0);
    const hasDecision = Array.isArray(c.decision_points) && c.decision_points.some((d) => d.trim().length > 0);
    const hasValidStatus = c.consequence_status === "landed" || c.consequence_status === "deferred" || c.consequence_status === "dissipated";
    const deferredRiskPresent =
      c.consequence_status !== "deferred" ||
      (typeof c.deferred_consequence_risk === "string" && c.deferred_consequence_risk.trim().length >= 20);

    if (!hasPressure || !hasDecision || !hasValidStatus || !deferredRiskPresent) {
      consequenceContractViolations.push(c.key);
    }
  }

  checks.push({
    check_id: "consequence_contract",
    passed: consequenceContractViolations.length === 0,
    error_code: consequenceContractViolations.length > 0 ? "QG_CONSEQUENCE_CONTRACT" : undefined,
    details:
      consequenceContractViolations.length > 0
        ? `Missing/invalid pressure→decision→consequence fields on: ${consequenceContractViolations.join(", ")}`
        : "All criteria include pressure_points, decision_points, consequence_status, and deferred risk when required",
  });

  // ── Check 3: No generic recommendations (missing anchor_snippet) ─────────
  const genericRecs: string[] = [];
  for (const c of synthesis.criteria) {
    for (const r of c.recommendations) {
      if (!r.anchor_snippet || r.anchor_snippet.trim().length === 0) {
        genericRecs.push(`${c.key}: "${r.action.substring(0, 60)}..."`);
      }
    }
  }
  checks.push({
    check_id: "no_generic_recs",
    passed: genericRecs.length === 0,
    error_code: genericRecs.length > 0 ? "QG_GENERIC_REC" : undefined,
    details:
      genericRecs.length > 0
        ? `${genericRecs.length} recommendation(s) missing anchor_snippet`
        : "All recommendations have anchor_snippet",
  });

  // ── Check 4: Recommendation length (50–1500 chars) ──────────────────────
  // Recommendations with substantive candidate prose (A/B/C variants) may have
  // legitimately terse action text (e.g. "tighten exposition") — treat those as
  // warnings, not hard failures. The prose itself carries the editorial value.
  const shortRecs: string[] = [];
  const shortRecsWithProse: string[] = [];
  const longRecs: string[] = [];
  for (const c of synthesis.criteria) {
    for (const r of c.recommendations) {
      if (r.action.length < QG_MIN_REC_LENGTH) {
        const hasProse = typeof r.candidate_text_a === "string" && r.candidate_text_a.trim().length > 20;
        if (hasProse) {
          shortRecsWithProse.push(`${c.key}: "${r.action}" (has candidate prose)`);
        } else {
          shortRecs.push(`${c.key}: "${r.action}"`);
        }
      }
      if (r.action.length > QG_MAX_REC_LENGTH)
        longRecs.push(`${c.key} (${r.action.length} chars)`);
    }
  }
  checks.push({
    check_id: "rec_min_length",
    passed: shortRecs.length === 0,
    error_code: shortRecs.length > 0 ? "QG_SHORT_REC" : undefined,
    details:
      shortRecs.length > 0
        ? `${shortRecs.length} recommendation(s) shorter than ${QG_MIN_REC_LENGTH} chars`
        : shortRecsWithProse.length > 0
          ? `${shortRecsWithProse.length} short action(s) accepted — candidate prose present`
          : `All recommendations ≥ ${QG_MIN_REC_LENGTH} chars`,
  });
  checks.push({
    check_id: "rec_max_length",
    passed: longRecs.length === 0,
    error_code: longRecs.length > 0 ? "QG_LONG_REC" : undefined,
    details:
      longRecs.length > 0
        ? `${longRecs.length} recommendation(s) exceed ${QG_MAX_REC_LENGTH} chars`
        : `All recommendations ≤ ${QG_MAX_REC_LENGTH} chars`,
  });

  // ── Check 4b: Recommendation Integrity Gate — filter/quarantine FAIL-tier ──
  // Uses the shared recommendationIntegrityGate to validate sentence completeness,
  // editorial usefulness, and field-specific strictness. Evaluation reports
  // require PASS_MINIMUM+; FAIL-tier recs are quarantined (not shown to author).
  //
  // This is a WARNING + FILTER, not a hard gate-fail. The evaluation job only
  // fails if remaining recommendations can't meet the report's minimum density
  // contract. Better 8 excellent recs than 14 with one broken sentence.
  const integrityFailures: string[] = [];
  let totalRecs = 0;
  for (const c of synthesis.criteria) {
    for (const r of c.recommendations) {
      totalRecs++;
      const integrityResult = checkRecommendationIntegrity({
        action: r.action,
        symptom: r.symptom,
        cause: r.cause,
        fix_direction: r.fix_direction,
        specific_fix: r.specific_fix,
        reader_effect: r.reader_effect,
        mechanism: r.mechanism,
        expected_impact: r.expected_impact,
        anchor_snippet: r.anchor_snippet,
        surface: "evaluation_report",
      });
      if (!meetsMinimumTier(integrityResult, "evaluation_report")) {
        const codes = integrityResult.violations.map((v) => v.code).join(", ");
        integrityFailures.push(
          `${c.key}: "${r.action.substring(0, 50)}…" → FAIL (${codes || "score too low"})`,
        );
      }
    }
  }
  const survivingRecs = totalRecs - integrityFailures.length;
  // Only fail the job if ALL recs are FAIL-tier (no surviving recs at all)
  const integrityPassed = survivingRecs > 0 || totalRecs === 0;
  checks.push({
    check_id: "rec_integrity",
    passed: integrityPassed,
    error_code: !integrityPassed ? "QG_REC_INTEGRITY_FAIL" : undefined,
    details:
      integrityFailures.length > 0
        ? `${integrityFailures.length}/${totalRecs} recommendation(s) quarantined (FAIL tier): ${integrityFailures.join("; ")}. ${survivingRecs} surviving.`
        : "All recommendations meet PASS_MINIMUM+ integrity tier for evaluation report",
  });

  // ── P2 Check: Generic Workshop Language Detection ─────────────────────────────
  // Soft-fail warning when recommendations contain generic prescriptions that lack
  // manuscript specificity. Distinct from rec_integrity tier (which handles structural
  // completeness) — this specifically catches workshop clichés.
  {
    const genericWorkshopRecs: string[] = [];
    for (const c of synthesis.criteria) {
      for (const r of c.recommendations) {
        const integrityResult = checkRecommendationIntegrity({
          action: r.action,
          symptom: r.symptom,
          cause: r.cause,
          fix_direction: r.fix_direction,
          specific_fix: r.specific_fix,
          reader_effect: r.reader_effect,
          mechanism: r.mechanism,
          expected_impact: r.expected_impact,
          anchor_snippet: r.anchor_snippet,
          surface: "evaluation_report",
        });
        if (integrityResult.violations.some((v) => v.code === "GENERIC_WORKSHOP_LANGUAGE")) {
          genericWorkshopRecs.push(`${c.key}: "${r.action.substring(0, 60)}"`);
        }
      }
    }
    if (genericWorkshopRecs.length > 0) {
      warnings.push(
        `[P2_GENERIC_PRESCRIPTIONS][WARN] ${genericWorkshopRecs.length} recommendation(s) contain generic workshop language: ${genericWorkshopRecs.slice(0, 5).join("; ")}. Recommendations must be manuscript-specific.`,
      );
    }
  }

  // ── Check 4c: Evidence Grounding Gate — validate anchor_snippets against manuscript ──
  // P0 trust gate: if manuscript text is available, classify every anchor_snippet
  // as verbatim_quote, paraphrased_observation, or editorial_diagnosis.
  // Recommendations with editorial_diagnosis anchors are flagged — they contain
  // fabricated "evidence" (LLM diagnostic text, not manuscript quotes).
  let evidenceGroundingReport: EvidenceGroundingReport | undefined;
  if (manuscriptText && manuscriptText.trim().length > 0 && totalRecs > 0) {
    evidenceGroundingReport = stampAnchorTypes(synthesis.criteria as never, manuscriptText);
    const { diagnosis_count, total_recommendations, ungrounded } = evidenceGroundingReport;
    // Evidence grounding gate: stamps anchor_type on each recommendation.
    // Hard-fail when >30% of anchors are fabricated editorial diagnoses.
    // Renderers differentiate verbatim_quote from editorial_diagnosis.
    const fabricationRatio = total_recommendations > 0 ? diagnosis_count / total_recommendations : 0;
    const fabricationExcessive = fabricationRatio > 0.3;
    checks.push({
      check_id: "evidence_grounding",
      passed: !fabricationExcessive,
      error_code: fabricationExcessive ? "QG_EVIDENCE_FABRICATION" : undefined,
      details: diagnosis_count > 0
        ? `${diagnosis_count}/${total_recommendations} anchor(s) classified as editorial_diagnosis (${(fabricationRatio * 100).toFixed(0)}% fabrication${fabricationExcessive ? " — exceeds 30% threshold" : ""}; ${ungrounded.slice(0, 3).map(u => `${u.criterion_key}: "${u.anchor_snippet.substring(0, 40)}…"`).join("; ")}${ungrounded.length > 3 ? ` +${ungrounded.length - 3} more` : ""})`
        : `All ${total_recommendations} anchor(s) grounded in manuscript text`,
    });
    if (fabricationRatio > 0.15) {
      warnings.push(`[evidence_grounding] ${diagnosis_count}/${total_recommendations} anchors are editorial_diagnosis (${(fabricationRatio * 100).toFixed(0)}% fabrication — evidence must be grounded in submitted manuscript text, not system-generated diagnostics)`);
    }
  }

  // ── Check 5: Evidence excerpt length (≤200 chars) ────────────────────────
  // Evidence: 301-350 auto-trim, >350 hard fail.
  const longEvidence: string[] = [];
  for (const c of synthesis.criteria) {
    for (const e of c.evidence) {
      if (e.snippet.length > QG_MAX_EVIDENCE_LENGTH && e.snippet.length <= QG_EVIDENCE_HARD_CEILING) {
        e.snippet = e.snippet.substring(0, QG_MAX_EVIDENCE_LENGTH - 3).replace(/[\s,;:.\u2014-]+$/u, "") + "\u2026";
      } else if (e.snippet.length > QG_EVIDENCE_HARD_CEILING) {
        longEvidence.push(`${c.key} (${e.snippet.length} chars)`);
      }
    }
  }
  checks.push({
    check_id: "evidence_length",
    passed: longEvidence.length === 0,
    error_code: longEvidence.length > 0 ? "QG_LONG_EVIDENCE" : undefined,
    details:
      longEvidence.length > 0
        ? `${longEvidence.length} evidence excerpt(s) exceed ${QG_EVIDENCE_HARD_CEILING} chars`
        : `All evidence excerpts ≤ ${QG_MAX_EVIDENCE_LENGTH} chars`,
  });

  // ── Check 6: Overview length (≤750 target, 800 hard ceiling) ──────────────
  // LLMs produce better summaries with generous limits. Users want richer content.
  // 751-800: auto-repair by trimming at word boundary. >800: hard fail (true runaway).
  let overviewLen = synthesis.overall.one_paragraph_summary.length;
  if (overviewLen > QG_MAX_OVERVIEW_LENGTH && overviewLen <= QG_OVERVIEW_HARD_CEILING) {
    synthesis.overall.one_paragraph_summary =
      synthesis.overall.one_paragraph_summary.substring(0, QG_MAX_OVERVIEW_LENGTH - 3).replace(/[\s,;:.\u2014-]+$/u, "") + "\u2026";
    overviewLen = synthesis.overall.one_paragraph_summary.length;
  }
  checks.push({
    check_id: "overview_length",
    passed: overviewLen <= QG_OVERVIEW_HARD_CEILING,
    error_code: overviewLen > QG_OVERVIEW_HARD_CEILING ? "QG_LONG_OVERVIEW" : undefined,
    details: overviewLen <= QG_MAX_OVERVIEW_LENGTH
      ? `Overview: ${overviewLen} chars (max ${QG_MAX_OVERVIEW_LENGTH})`
      : `Overview: ${overviewLen} chars (auto-repaired from >${QG_MAX_OVERVIEW_LENGTH}, hard ceiling ${QG_OVERVIEW_HARD_CEILING})`,
  });

  // ── Check 6b: Pitch/Summary Identity Separation (P1) ──────────────────────
  // Hard-fail when one_sentence_pitch, one_paragraph_pitch, or executive summary
  // are identical — each section must serve a distinct editorial purpose.
  const oneSentencePitch = (synthesis.overall as Record<string, unknown>).one_sentence_pitch as string | undefined;
  const oneParagraphPitch = (synthesis.overall as Record<string, unknown>).one_paragraph_pitch as string | undefined;
  if (oneSentencePitch || oneParagraphPitch) {
    const summaryNorm = synthesis.overall.one_paragraph_summary.trim().toLowerCase();
    const sentenceNorm = (oneSentencePitch ?? "").trim().toLowerCase();
    const paragraphNorm = (oneParagraphPitch ?? "").trim().toLowerCase();
    const pitchDuplicates: string[] = [];
    if (sentenceNorm && summaryNorm === sentenceNorm) pitchDuplicates.push("one_sentence_pitch = summary");
    if (paragraphNorm && summaryNorm === paragraphNorm) pitchDuplicates.push("one_paragraph_pitch = summary");
    if (sentenceNorm && paragraphNorm && sentenceNorm === paragraphNorm) pitchDuplicates.push("one_sentence_pitch = one_paragraph_pitch");
    // Softer containment check (substring duplication)
    const pitchContainments: string[] = [];
    if (sentenceNorm && sentenceNorm !== summaryNorm && summaryNorm.includes(sentenceNorm)) pitchContainments.push("one_sentence_pitch ⊂ summary");
    if (paragraphNorm && paragraphNorm !== summaryNorm && summaryNorm.includes(paragraphNorm)) pitchContainments.push("one_paragraph_pitch ⊂ summary");
    if (sentenceNorm && paragraphNorm && sentenceNorm !== paragraphNorm && paragraphNorm.includes(sentenceNorm)) pitchContainments.push("one_sentence_pitch ⊂ one_paragraph_pitch");
    if (pitchContainments.length > 0) {
      warnings.push(`[pitch_identity] Pitch/summary containment detected: ${pitchContainments.join(", ")}. Sections should serve distinct editorial purposes.`);
    }
    // Exact identity is a hard failure — identical sections violate the template contract
    const isExactDuplicate = pitchDuplicates.length > 0;
    if (isExactDuplicate) {
      warnings.push(`[pitch_identity] HARD FAIL: Pitch/summary sections are verbatim identical: ${pitchDuplicates.join(", ")}. Template requires distinct One-Paragraph Pitch, One-Sentence Pitch, and Executive Summary.`);
    }
    checks.push({
      check_id: "pitch_identity_separation",
      passed: !isExactDuplicate,
      error_code: isExactDuplicate ? "QG_PITCH_IDENTITY_DUPLICATE" : undefined,
      details: isExactDuplicate
        ? `Verbatim duplication: ${pitchDuplicates.join(", ")}`
        : pitchContainments.length > 0
          ? `Containment overlap: ${pitchContainments.join(", ")}`
          : "Pitches are semantically distinct from summary",
    });
  }

  // ── Check 7: No duplicated recommendations ───────────────────────────────
  const actionsSeen = new Set<string>();
  const duplicates: string[] = [];
  for (const c of synthesis.criteria) {
    for (const r of c.recommendations) {
      const normalized = r.action.trim().toLowerCase();
      if (actionsSeen.has(normalized)) {
        duplicates.push(`${c.key}: "${r.action.substring(0, 60)}..."`);
      } else {
        actionsSeen.add(normalized);
      }
    }
  }
  checks.push({
    check_id: "no_duplicate_recs",
    passed: duplicates.length === 0,
    error_code: duplicates.length > 0 ? "QG_DUPLICATE_REC" : undefined,
    details:
      duplicates.length > 0
        ? `${duplicates.length} duplicated recommendation action(s) across criteria`
        : "No duplicated recommendations",
  });

  // ── Check 7b: Semantic lever redundancy ──────────────────────────────────
  // Flags recommendations that share the same strategic_lever + same revision_granularity
  // across the whole report — they are semantically equivalent and should have been collapsed.
  {
    type RecWithKey = {
      criterionKey: string;
      action: string;
      redundancy_key: string;
      lever_only_key: string;
    };
    const allRecsWithKeys: RecWithKey[] = [];
    for (const c of synthesis.criteria) {
      for (const r of c.recommendations) {
        const family = normalizeIssueFamily(r.issue_family);
        const lever = normalizeStrategicLever(r.strategic_lever);
        const granularity = normalizeRevisionGranularity(r.revision_granularity);
        const rkey = buildRedundancyKey(family, lever, granularity);
        const leverOnly = `${lever ?? "unknown"}:${granularity ?? "unknown"}`;
        allRecsWithKeys.push({ criterionKey: c.key, action: r.action, redundancy_key: rkey, lever_only_key: leverOnly });
      }
    }

    const fullyRedundantViolations: string[] = [];
    const leverRepeatViolations: string[] = [];
    const seenRedundancyKeys = new Map<string, string>(); // key -> first action
    const seenLeverKeys = new Map<string, string[]>(); // lever:granularity -> list of criterion keys

    for (const rec of allRecsWithKeys) {
      // Full redundancy: same lever + same granularity, and none of the components are "unknown"
      if (!rec.redundancy_key.includes("unknown")) {
        const existing = seenRedundancyKeys.get(rec.redundancy_key);
        if (existing) {
          fullyRedundantViolations.push(
            `${rec.criterionKey}: "${rec.action.substring(0, 50)}..." duplicates lever+granularity of "${existing.substring(0, 50)}..." (key=${rec.redundancy_key})`
          );
        } else {
          seenRedundancyKeys.set(rec.redundancy_key, rec.action);
        }
      }
      // Lever-only repeat across 3+ recs: warn (not hard-fail) — same lever scattered across many criteria may indicate un-collapsed phrasing
      const leverKey = rec.lever_only_key;
      if (!leverKey.startsWith("unknown")) {
        const existing = seenLeverKeys.get(leverKey) ?? [];
        existing.push(rec.criterionKey);
        seenLeverKeys.set(leverKey, existing);
      }
    }

    // CALIBRATION MODE: warn-only until Pass 3 generation is stable. Promote to ERROR once 5+ real runs confirm low false-positive rate.
    if (fullyRedundantViolations.length > 0) {
      warnings.push(
        `[QG_DUPLICATE_STRATEGIC_LEVER] ${fullyRedundantViolations.length} rec(s) share same strategic_lever+granularity: ${fullyRedundantViolations.join(" | ")}`,
      );
    }
    checks.push({
      check_id: "no_duplicate_strategic_lever",
      passed: true, // warn-only during calibration
      details:
        fullyRedundantViolations.length > 0
          ? `WARN: ${fullyRedundantViolations.length} recommendation(s) share same strategic_lever+granularity (calibration mode)`
          : "No semantic lever duplication detected",
    });

    // Lever concentration warning: same lever used 3+ times across the report → surface as a warning, not a hard block
    const concentratedLevers = [...seenLeverKeys.entries()].filter(([, uses]) => uses.length >= 3);
    if (concentratedLevers.length > 0) {
      warnings.push(
        `Lever concentration: ${concentratedLevers.map(([lever, uses]) => `${lever} used ${uses.length}x (${uses.join(",")})`).join(" | ")} — consider collapsing into fewer decisive recommendations`
      );
    }
  }

  // ── Check 7c: Confirmed. stub rationale detection ───────────────────────
  // agree-state rationale must not be the literal "Confirmed." stub. Pass 3 v6+ is required to emit substantive rationale.
  const confirmedStubRationales: string[] = [];
  for (const c of synthesis.criteria) {
    const normalized = c.final_rationale.trim().toLowerCase();
    if (normalized === "confirmed." || normalized === "confirmed") {
      confirmedStubRationales.push(c.key);
    }
  }
  // CALIBRATION MODE: warn-only until Pass 3 generation is stable. Promote to ERROR after first clean prod run.
  if (confirmedStubRationales.length > 0) {
    warnings.push(
      `[QG_CONFIRMED_RATIONALE] ${confirmedStubRationales.length} criteria use "Confirmed." stub rationale: ${confirmedStubRationales.join(", ")}`,
    );
  }
  checks.push({
    check_id: "no_confirmed_stub_rationale",
    passed: true, // warn-only during calibration
    details:
      confirmedStubRationales.length > 0
        ? `WARN: ${confirmedStubRationales.length} criteria use "Confirmed." stub rationale (calibration mode)`
        : `No "Confirmed." stub rationale detected`,
  });

  // ── Check 8: Rationale coverage (≥40 chars per criterion) ───────────────
  const thinRationales: string[] = [];
  for (const c of synthesis.criteria) {
    if (c.final_rationale.trim().length < QG_MIN_RATIONALE_LENGTH) {
      thinRationales.push(`${c.key} (${c.final_rationale.trim().length} chars)`);
    }
  }
  checks.push({
    check_id: "rationale_coverage",
    passed: thinRationales.length === 0,
    error_code: thinRationales.length > 0 ? "QG_THIN_RATIONALE" : undefined,
    details:
      thinRationales.length > 0
        ? `${thinRationales.length} criterion/criteria have rationale < ${QG_MIN_RATIONALE_LENGTH} chars: ${thinRationales.join(", ")}`
        : `All criteria have substantive rationale (≥ ${QG_MIN_RATIONALE_LENGTH} chars)`,
  });

  // ── Check 8b: Placeholder rationale phrase detection ───────────────────
  const placeholderRationales: string[] = [];
  for (const c of synthesis.criteria) {
    const normalizedRationale = normalizeForPhraseMatch(c.final_rationale);
    const matchedPattern = QG_PLACEHOLDER_RATIONALE_PATTERNS.find((pattern) =>
      normalizedRationale.includes(pattern),
    );
    if (matchedPattern) {
      placeholderRationales.push(`${c.key} (matched: "${matchedPattern}")`);
    }
  }
  checks.push({
    check_id: "placeholder_rationale",
    passed: placeholderRationales.length === 0,
    error_code: placeholderRationales.length > 0 ? "QG_PLACEHOLDER_RATIONALE" : undefined,
    details:
      placeholderRationales.length > 0
        ? `${placeholderRationales.length} criterion/criteria contain placeholder rationale language: ${placeholderRationales.join(", ")}`
        : "No known placeholder rationale patterns detected",
  });

  // ── Check 9: Evidence coverage (≥10 of 13 must have ≥1 snippet ≥20 chars) ──
  const maxPermittedGaps = CRITERIA_KEYS.length - QG_MIN_EVIDENCE_COVERED_CRITERIA;
  const underEvidenced: string[] = [];
  for (const c of synthesis.criteria) {
    if (!hasSubstantiveEvidence(c.evidence)) {
      underEvidenced.push(c.key);
    }
  }
  checks.push({
    check_id: "evidence_coverage",
    passed: underEvidenced.length <= maxPermittedGaps,
    error_code: underEvidenced.length > maxPermittedGaps ? "QG_LOW_EVIDENCE_COVERAGE" : undefined,
    details:
      underEvidenced.length > 0
        ? `${underEvidenced.length} criterion/criteria lack substantive evidence: ${underEvidenced.join(", ")} (max ${maxPermittedGaps} permitted)`
        : "All criteria have substantive evidence",
  });

  // ── Check 9b: Spine criteria must always include substantive evidence ───
  const missingRequiredEvidence: string[] = [];
  for (const requiredKey of QG_SPINE_CRITERIA_REQUIRED_EVIDENCE) {
    const criterion = synthesis.criteria.find((c) => c.key === requiredKey);
    if (!criterion || !hasSubstantiveEvidence(criterion.evidence)) {
      missingRequiredEvidence.push(requiredKey);
    }
  }
  checks.push({
    check_id: "required_evidence_spine",
    passed: missingRequiredEvidence.length === 0,
    error_code: missingRequiredEvidence.length > 0 ? "QG_MISSING_REQUIRED_EVIDENCE" : undefined,
    details:
      missingRequiredEvidence.length > 0
        ? `Required spine criteria missing substantive evidence: ${missingRequiredEvidence.join(", ")}`
        : "All required spine criteria include substantive evidence",
  });

  // ── Check 9c: POV/Dialogue rendering audit (manuscript-aware) ─────────
  if (manuscriptText && manuscriptText.trim().length > 0) {
    const pov = analyzePovRendering({
      manuscriptText,
      isClosePov: true,
      povMode: "first_person",
    });
    const dialogue = analyzeDialogueAttribution({ manuscriptText });
    const hasActionablePovSignals =
      pov.findings.some((f) => f.severity !== "info") ||
      dialogue.findings.some((f) => f.severity !== "info");

    if (hasActionablePovSignals) {
      const pack = validatePovCriterionEvidence({
        criterion: "voice",
        pov,
        dialogue,
        requiredEvidencePresent: false,
      });

      checks.push({
        check_id: "pov_rendering_evidence_pack",
        passed: pack.requiredEvidencePresent,
        error_code: pack.requiredEvidencePresent ? undefined : "QG_POV_MISSING_EVIDENCE",
        details: pack.requiredEvidencePresent
          ? "POV/dialogue diagnostic evidence pack present"
          : `POV/dialogue evidence pack invalid: ${pack.invalidReason ?? "unknown"}`,
      });

      const voiceCriterion = synthesis.criteria.find((c) => c.key === "voice");
      const dialogueCriterion = synthesis.criteria.find((c) => c.key === "dialogue");
      const voiceRationale = (voiceCriterion?.final_rationale ?? "").toLowerCase();
      const dialogueRationale = (dialogueCriterion?.final_rationale ?? "").toLowerCase();
      
      const hasVoiceMechanismMarker = QG_POV_MECHANISM_MARKERS.some((m) => voiceRationale.includes(m));
      
      // Dialogue gate: diagnostic-grounded evaluation (not lexical-only)
      // Pass if: rationale mentions mechanism language OR (diagnostics show grounded analysis)
      // Fail only if: BOTH rationale lacks mechanism language AND diagnostics show no meaningful attribution
      const hasDialogueMechanismMarker = DIALOGUE_MECHANISM_MARKERS.some((m) =>
        dialogueRationale.includes(m),
      );
      
      let dialogueAttributionDiagnostics: ReturnType<typeof analyzeDialogueAttributionForGate> | undefined;
      
      const dialogueHasDiagnosticGrounding = (() => {
        // If manuscript available, check structural diagnostic signals
        if (!manuscriptText || manuscriptText.trim().length === 0) {
          return hasDialogueMechanismMarker; // Fall back to marker check if no manuscript
        }
        
        dialogueAttributionDiagnostics = analyzeDialogueAttributionForGate({ manuscriptText });
        
        // Pass if diagnostics show meaningful dialogue structure:
        // - Has rendered speech and at least one attribution strategy, OR
        // - Multiple rendering modes detected, OR
        // - Clear turn-taking with low ambiguity risk, OR
        // - Explicit tags or action beats present
        const hasRenderingModes = dialogueAttributionDiagnostics.renderingModesDetected.length >= 2;
        const hasAttributionStrategy = dialogueAttributionDiagnostics.speakerAttributionStrategy.length >= 2;
        const hasCleanTurns =
          dialogueAttributionDiagnostics.turnTakingClarity === "clear" && dialogueAttributionDiagnostics.speakerAmbiguityRisk === "low";
        const hasExplicitMechanisms = dialogueAttributionDiagnostics.explicitTagCount > 0 || dialogueAttributionDiagnostics.actionBeatCount > 0;
        
        // Dialogue is diagnostically grounded if ANY of these are true:
        return hasRenderingModes || (hasAttributionStrategy && dialogueAttributionDiagnostics.quotedSpeechCount > 0) || hasCleanTurns || hasExplicitMechanisms;
      })();
      
      // Low-dialogue manuscripts: if the manuscript has very few quoted speech
      // instances, the dialogue gate should not hard-block. The LLM cannot
      // produce grounded dialogue analysis when there is minimal dialogue to
      // analyze. Downgrade to warning instead of hard-fail. (#278)
      const isLowDialogueManuscript = dialogueAttributionDiagnostics
        ? dialogueAttributionDiagnostics.quotedSpeechCount < 5
        : false;

      // Pass dialogue gate if: mechanism language present OR diagnostic grounding OR low-dialogue manuscript
      const dialogueGatePassed = hasDialogueMechanismMarker || dialogueHasDiagnosticGrounding || isLowDialogueManuscript;

      console.log("[DIALOGUE_GATE_V2_ACTIVE]", {
        hasDialogueMechanismMarker,
        dialogueHasDiagnosticGrounding,
        isLowDialogueManuscript,
        dialogueGatePassed,
        hasDiagnostics: !!dialogueAttributionDiagnostics,
        renderingModes: dialogueAttributionDiagnostics?.renderingModesDetected,
        attributionStrategies: dialogueAttributionDiagnostics?.speakerAttributionStrategy,
        explicitTagCount: dialogueAttributionDiagnostics?.explicitTagCount,
        actionBeatCount: dialogueAttributionDiagnostics?.actionBeatCount,
        turnTakingClarity: dialogueAttributionDiagnostics?.turnTakingClarity,
        speakerAmbiguityRisk: dialogueAttributionDiagnostics?.speakerAmbiguityRisk,
        rationalePreview: dialogueRationale.slice(0, 120),
      });

      checks.push({
        check_id: "voice_mechanism_specificity",
        passed: hasVoiceMechanismMarker,
        error_code: hasVoiceMechanismMarker ? undefined : "QG_POV_GENERIC_REASONING",
        details: hasVoiceMechanismMarker
          ? "Voice rationale includes POV/rendering mechanism language"
          : "Voice rationale lacks explicit POV/rendering mechanism language",
      });

      checks.push({
        check_id: "dialogue_attribution_specificity",
        passed: dialogueGatePassed,
        error_code: dialogueGatePassed ? undefined : "QG_DIALOGUE_ATTRIBUTION_UNDERAUDITED",
        details: dialogueGatePassed
          ? isLowDialogueManuscript
            ? `Dialogue gate auto-passed: low-dialogue manuscript (${dialogueAttributionDiagnostics?.quotedSpeechCount ?? 0} quoted speech instances)`
            : "Dialogue rationale includes mechanism language or diagnostics show grounded attribution analysis"
          : "Dialogue rationale lacks attribution/rendering mechanism language and diagnostics show minimal attribution structure",
        diagnostics: dialogueAttributionDiagnostics,
      });
    }
  }

  // ── Check 10: Pass independence (rationale phrasing only; calibrated) ────
  if (pass1 && pass2) {
    const ngramSize = QG_INDEPENDENCE_NGRAM_SIZE;
    const wordCount = manuscriptText ? manuscriptText.split(/\s+/).filter(Boolean).length : undefined;
    const effectiveMinOverlaps = independenceOverlapThreshold(wordCount);
    const pass1ByKey = new Map(pass1.criteria.map((c) => [c.key, c]));

    // Exclude manuscript-sourced phrase overlap by filtering any n-gram
    // that appears inside evidence snippets from either pass.
    const evidenceNgrams = new Set<string>();
    for (const c of [...pass1.criteria, ...pass2.criteria]) {
      for (const e of c.evidence) {
        for (const gram of collectNgrams(e.snippet, ngramSize)) {
          evidenceNgrams.add(gram);
        }
      }
    }

    // Extract calibrated n-grams from Pass 1 rationale text.
    const pass1Ngrams = new Set<string>();
    for (const c of pass1.criteria) {
      for (const gram of collectNgrams(c.rationale, ngramSize)) {
        if (!evidenceNgrams.has(gram)) {
          pass1Ngrams.add(gram);
        }
      }
    }

    const violations: string[] = [];
    const perCriterionDiagnostics: QualityGateCriterionDiagnostic[] = [];

    for (const c of pass2.criteria) {
      let overlapCount = 0;
      const overlapSamplesSet = new Set<string>();
      const overlapSamples: string[] = [];
      // Collect ALL unique overlapping non-evidence ngrams for reconstruction (Set avoids O(n²) includes)
      const overlapNgramsSet = new Set<string>();
      for (const gram of collectNgrams(c.rationale, ngramSize)) {
        if (evidenceNgrams.has(gram)) {
          continue;
        }
        if (pass1Ngrams.has(gram)) {
          overlapCount += 1;
          overlapNgramsSet.add(gram);
          if (overlapSamples.length < 5 && !overlapSamplesSet.has(gram)) {
            overlapSamples.push(gram);
            overlapSamplesSet.add(gram);
          }
        }
      }

      const pass1Rationale = pass1ByKey.get(c.key)?.rationale ?? "";

      // Audit-grade per-criterion diagnostic (stored in quality_gate_diagnostics_v1 artifact)
      perCriterionDiagnostics.push({
        criterion_key: c.key,
        pass1_rationale: pass1Rationale,
        pass2_rationale: c.rationale,
        overlap_4grams: Array.from(overlapNgramsSet),
        observed_overlap_count: overlapCount,
        threshold_n: ngramSize,
        threshold_min: effectiveMinOverlaps,
        classification: null,
      });

      if (overlapCount >= effectiveMinOverlaps) {
        const sampleText = overlapSamples.length > 0
          ? ` [samples: ${overlapSamples.map((s) => `"${s}"`).join(" | ")}]`
          : "";
        const rationaleText =
          ` [pass1_rationale="${previewRationale(pass1Rationale)}"]` +
          ` [pass2_rationale="${previewRationale(c.rationale)}"]`;
        violations.push(
          `${c.key}: ${overlapCount} shared non-evidence ${ngramSize}-gram(s) with Pass 1 rationale${sampleText}${rationaleText}`,
        );
      }
    }

    checks.push({
      check_id: "pass_independence",
      passed: violations.length === 0,
      error_code: violations.length > 0 ? "QG_INDEPENDENCE_VIOLATION" : undefined,
      details:
        violations.length > 0
          ? `${violations.length} Pass 2 criterion/criteria exceed calibrated rationale-overlap threshold (n=${ngramSize}, min=${effectiveMinOverlaps}${wordCount !== undefined ? `, wordCount=${wordCount}` : ""})`
          : `Pass 1 / Pass 2 independence confirmed (n=${ngramSize}${wordCount !== undefined ? `, wordCount=${wordCount}, effectiveMin=${effectiveMinOverlaps}` : ""})`,

      // Structured diagnostics for artifact persistence — enables offline reconstruction
      diagnostics: { per_criterion_diagnostic: perCriterionDiagnostics },
    });

    if (violations.length > 0) {
      warnings.push(...violations);
    }
  }

  // ── Warn: Confidence minimum (soft fail) ─────────────────────────────────
  // (Not available in SynthesisOutput directly — carries over from A6 layer)
  // Reserved for future integration.


  // --- PR-1: Scope governance gates ---

  // Check: Internal leakage (speech taxonomy must never reach user output)
  {
    const allText = synthesis.criteria
      .map((c) => [...(c.recommendations?.map((r) => [r.action, r.expected_impact].join(" ")) ?? [])].join(" "))
      .join(" ");
    const leakageMatch = QG_INTERNAL_LEAKAGE_PATTERNS.test(allText);
    checks.push({
      check_id: "internal_leakage",
      passed: !leakageMatch,
      error_code: leakageMatch ? "QG_INTERNAL_LEAKAGE" : undefined,
      details: leakageMatch
        ? "Internal analysis labels (direct_speech/reported_speech/tagged_speech/tagless_exchange) leaked into user output"
        : "No internal leakage detected",
    });
  }

  // Check: Filler-verb recommendations (enhance/deepen/refine without mechanism)
  {
    const fillerRecs: string[] = [];
    for (const c of synthesis.criteria) {
      for (const r of c.recommendations ?? []) {
        const action = (r.action ?? "").trim();
        if (QG_FILLER_VERBS.test(action)) {
          // Allow if action contains a mechanism indicator (location + specific noun)
          const hasLocation = !!r.anchor_snippet;
          const hasSpecifics = action.length > 80 && /\b(scene|line|paragraph|chapter|beat|moment|exchange)\b/i.test(action);
          if (!hasLocation && !hasSpecifics) {
            fillerRecs.push(action.slice(0, 80));
          }
        }
      }
    }
    checks.push({
      check_id: "filler_recommendation",
      passed: fillerRecs.length === 0,
      error_code: fillerRecs.length > 0 ? "QG_FILLER_REC" : undefined,
      details: fillerRecs.length > 0
        ? `${fillerRecs.length} filler-verb recommendation(s) without mechanism: ${fillerRecs[0]}...`
        : "No filler-verb recommendations detected",
    });
  }


  
  // — Scope gate: confidence without evidence ——————————————————
  if (scopeProfile) {
    const highConfNoEvidence: string[] = [];
    for (const c of synthesis.criteria) {
      if (
        c.confidence_level === "high" &&
        c.recommendations?.length > 0 &&
        !hasSubstantiveEvidence(c.recommendations.map((r) => ({ snippet: r.anchor_snippet ?? "" })))
      ) {
        highConfNoEvidence.push(c.key);
      }
    }
    checks.push({
      check_id: "confidence_without_evidence",
      passed: highConfNoEvidence.length === 0,
      error_code: highConfNoEvidence.length > 0 ? "QG_HIGH_CONFIDENCE_NO_EVIDENCE" : undefined,
      details: highConfNoEvidence.length > 0
        ? `${highConfNoEvidence.length} criteria claim HIGH confidence without substantive evidence: ${highConfNoEvidence.join(", ")}`
        : "All high-confidence criteria have substantive evidence",
    });
  }

  // — Scope gate: recommendation contract completeness ————————————
  if (scopeProfile) {
    const incomplete: string[] = [];
    for (const c of synthesis.criteria) {
      for (const r of c.recommendations ?? []) {
        const missing: string[] = [];
        if (!r.anchor_snippet?.trim()) missing.push("anchor");
        if (!r.action?.trim()) missing.push("action");
        if (!r.expected_impact?.trim()) missing.push("expected_impact");
        if (missing.length > 0) {
          incomplete.push(`${c.key}[${missing.join(",")}]`);
        }
      }
    }
    checks.push({
      check_id: "recommendation_contract_completeness",
      passed: incomplete.length === 0,
      error_code: incomplete.length > 0 ? "QG_RECOMMENDATION_INCOMPLETE" : undefined,
      details: incomplete.length > 0
        ? `${incomplete.length} recommendation(s) missing contract fields: ${incomplete.slice(0, 5).join("; ")}`
        : "All recommendations satisfy the contract",
    });
  }

  // — Editorial recommendation quality gate (deterministic) ———————————
  {
    const genericFeedbackFindings: string[] = [];
    const provisionalDiagnostics: EditorialDiagnostic[] = [];
    const criteriaWithIssues = new Set<string>();
    let totalRecommendations = 0;
    let invalidRecommendations = 0;
    let duplicateReasoningCount = 0;

    for (const c of synthesis.criteria) {
      const reasoningSeen = new Set<string>();
      let recommendationIndex = 0;

      for (const r of c.recommendations ?? []) {
        totalRecommendations += 1;
        recommendationIndex += 1;
        const action = (r.action ?? "").trim();
        const expectedImpact = (r.expected_impact ?? "").trim();
        const anchorSnippet = (r.anchor_snippet ?? "").trim();
        const mechanism = (r.mechanism ?? "").trim();
        const specificFix = (r.specific_fix ?? "").trim();
        const readerEffect = (r.reader_effect ?? "").trim();

        const hasAnchorContext =
          anchorSnippet.length > 0 ||
          EDITORIAL_CONTEXT_MARKERS.test(action) ||
          EDITORIAL_ANCHOR_HINT_MARKERS.test(action);
        const hasSymptomSignal =
          EDITORIAL_SYMPTOM_MARKERS.test(action) ||
          EDITORIAL_SYMPTOM_MARKERS.test(expectedImpact);
        const hasMechanismCause =
          EDITORIAL_MECHANISM_MARKERS.test(action) ||
          EDITORIAL_MECHANISM_MARKERS.test(expectedImpact) ||
          EDITORIAL_MECHANISM_MARKERS.test(mechanism) ||
          mechanism.length > 0;
        const hasSpecificFixMove =
          (EDITORIAL_FIX_MARKERS.test(action) ||
            EDITORIAL_FIX_MARKERS.test(specificFix) ||
            specificFix.length > 0) &&
          hasAnchorContext;
        const hasReaderEffect =
          EDITORIAL_READER_EFFECT_MARKERS.test(expectedImpact) ||
          EDITORIAL_READER_EFFECT_MARKERS.test(readerEffect) ||
          readerEffect.length > 0;

        const missing: string[] = [];
        if (!hasAnchorContext) missing.push("anchor/context");
        if (!(hasSymptomSignal || hasAnchorContext)) missing.push("symptom");
        if (!hasMechanismCause) missing.push("mechanism/cause");
        if (!hasSpecificFixMove) missing.push("specific_fix/move");
        if (!hasReaderEffect) missing.push("reader_effect");

        const reasoningKey = `${normalizeEditorialReasoningKey(action)}|${normalizeEditorialReasoningKey(expectedImpact)}`;
        const duplicateReasoning = reasoningSeen.has(reasoningKey);

        const hasIssue = missing.length > 0 || duplicateReasoning;

        if (missing.length > 0 || duplicateReasoning) {
          invalidRecommendations += 1;
          criteriaWithIssues.add(c.key);
        }

        if (missing.length > 0) {
          genericFeedbackFindings.push(`${c.key}: missing ${missing.join(",")} in recommendation \"${action.slice(0, 80)}\"`);
        }

        if (duplicateReasoning) {
          duplicateReasoningCount += 1;
          genericFeedbackFindings.push(`${c.key}: duplicate editorial reasoning detected in recommendations`);
        } else {
          reasoningSeen.add(reasoningKey);
        }

        const classification = classifyEditorialDiagnostic(missing, duplicateReasoning);
        const failureReason = hasIssue
          ? `Missing fields: ${missing.join(",") || "none"}; duplicate_reasoning=${duplicateReasoning}`
          : "Recommendation satisfies editorial quality contract";
        const recommendedFixPath = hasIssue
          ? "Provide Symptom → Cause → Fix → Reader Effect with concrete anchor context"
          : "none";

        if (hasIssue) {
          provisionalDiagnostics.push({
            signal_id: buildEditorialSignalId(c.key, action, expectedImpact, recommendationIndex),
            criterion: c.key,
            action: compactAndCap(action, QG_EDITORIAL_DIAGNOSTIC_MAX_ACTION_CHARS),
            expected_impact: compactAndCap(expectedImpact, QG_EDITORIAL_DIAGNOSTIC_MAX_EXPECTED_IMPACT_CHARS),
            anchor_snippet: compactAndCap(anchorSnippet, QG_EDITORIAL_DIAGNOSTIC_MAX_ANCHOR_CHARS),
            evaluation_route: "recommendation_editorial_quality",
            missing_fields: missing,
            classification,
            action_applied: "none",
            gate_check_id: "recommendation_editorial_quality",
            error_code: "QG_EDITORIAL_GENERIC_FEEDBACK",
            failure_reason: compactAndCap(failureReason, QG_EDITORIAL_DIAGNOSTIC_MAX_FAILURE_REASON_CHARS),
            recommended_fix_path: recommendedFixPath,
          });
        }
      }
    }

    const criteriaCount = Math.max(synthesis.criteria.length, 1);
    const invalidRatio = totalRecommendations > 0 ? invalidRecommendations / totalRecommendations : 1;
    const criteriaIssueRatio = criteriaWithIssues.size / criteriaCount;
    const hasAnyIssue = genericFeedbackFindings.length > 0;
    const repeatedTemplateCollapse = duplicateReasoningCount >= QG_EDITORIAL_BLOCK_MIN_DUPLICATE_REASONING;
    const hasStableRecommendationDenominator = totalRecommendations >= 4;
    const hasStableCriteriaDenominator = synthesis.criteria.length >= 8;
    const systemicInvalidity =
      invalidRecommendations >= QG_EDITORIAL_BLOCK_MIN_INVALID_RECS ||
      (hasStableRecommendationDenominator && invalidRatio >= QG_EDITORIAL_BLOCK_INVALID_RATIO) ||
      (hasStableCriteriaDenominator && criteriaIssueRatio >= QG_EDITORIAL_BLOCK_CRITERIA_RATIO) ||
      repeatedTemplateCollapse;
    const blockEditorialQuality = hasAnyIssue && (totalRecommendations === 0 || systemicInvalidity);

    for (const diagnostic of provisionalDiagnostics) {
      editorialDiagnostics.push({
        ...diagnostic,
        action_applied: blockEditorialQuality ? "block" : "warn",
      });
    }

    if (hasAnyIssue && !blockEditorialQuality) {
      warnings.push(
        `[QG_EDITORIAL_GENERIC_FEEDBACK][WARN] isolated recommendation actionability defects: invalid=${invalidRecommendations}/${Math.max(totalRecommendations, 1)} criteria_affected=${criteriaWithIssues.size}/${criteriaCount}`,
      );
    }

    // Scope-aware editorial quality gate: manuscripts below full_manuscript scale
    // naturally produce thinner recommendations that may lack mechanism/cause or
    // specific_fix fields. Hard-blocking the entire report for editorial specificity
    // defects at these scales harms author experience. Instead, diagnostics are
    // preserved and surfaced as per-criterion confidence warnings in the report.
    const editorialBlockEligible =
      scopeProfile?.inputScale === "full_manuscript" ||
      scopeProfile?.inputScale === "multi_chapter";
    const effectiveBlock = blockEditorialQuality && editorialBlockEligible;

    checks.push({
      check_id: "recommendation_editorial_quality",
      passed: !effectiveBlock,
      error_code:
        effectiveBlock
          ? "QG_EDITORIAL_GENERIC_FEEDBACK"
          : undefined,
      details:
        genericFeedbackFindings.length > 0
          ? `${effectiveBlock ? "BLOCK" : "WARN"}: ${genericFeedbackFindings.length} editorial recommendation quality issue(s): ${genericFeedbackFindings.slice(0, 4).join("; ")}${!editorialBlockEligible && blockEditorialQuality ? ` (downgraded from BLOCK — inputScale=${scopeProfile?.inputScale ?? "unknown"})` : ""}`
          : "All recommendations meet editorial quality contract",
    });
  }

  // ── P2 Check: mistake_proofing required for high-scoring criteria (≥7) ──────
  // When a criterion scores well, revision recs targeting it MUST explicitly state
  // what existing strength to preserve. This prevents "fix pacing by flattening voice."
  {
    const missingMistakeProofing: string[] = [];
    for (const c of synthesis.criteria) {
      if (c.final_score_0_10 >= 7) {
        for (const r of c.recommendations ?? []) {
          const mp = (r as Record<string, unknown>).mistake_proofing;
          if (!mp || (typeof mp === "string" && mp.trim().length < 10)) {
            missingMistakeProofing.push(c.key);
            break; // one flag per criterion is enough
          }
        }
      }
    }
    if (missingMistakeProofing.length > 0) {
      warnings.push(
        `[P2_MISTAKE_PROOFING][WARN] ${missingMistakeProofing.length} high-scoring criteria (≥7) have recommendations without mistake_proofing: ${missingMistakeProofing.slice(0, 5).join(", ")}. Revisions for strong criteria must state what to preserve.`,
      );
    }
  }

  // ── P3 Check: Priority Hierarchy — deterministic score-driven enforcement ─────
  // Validates that recommendation priorities match the criterion score band.
  // Score ≤6 → high, Score 7 → medium, Score ≥8 → low.
  // The pipeline enforces this deterministically in runPass3Synthesis.ts, but this
  // check catches cases where the override was bypassed or priorities were corrupted.
  {
    const priorityMismatches: string[] = [];
    for (const c of synthesis.criteria) {
      const expectedPriority: "high" | "medium" | "low" =
        c.final_score_0_10 <= 6 ? "high" : c.final_score_0_10 === 7 ? "medium" : "low";
      for (const r of c.recommendations ?? []) {
        if (r.priority !== expectedPriority) {
          priorityMismatches.push(`${c.key} (score=${c.final_score_0_10}): got "${r.priority}", expected "${expectedPriority}"`);
        }
      }
    }
    if (priorityMismatches.length > 0) {
      warnings.push(
        `[P3_PRIORITY_HIERARCHY][WARN] ${priorityMismatches.length} recommendation(s) have priority mismatched to score band: ${priorityMismatches.slice(0, 5).join("; ")}. Expected: ≤6→high, 7→medium, ≥8→low.`,
      );
    }
  }

  // ── P4 Check: Cross-Criterion Deduplication observability ────────────────────
  // Reports how many recommendations were collapsed across criteria (P4 dedup runs
  // in the pipeline; this check verifies the collapsed_from_criteria field was applied
  // and surfaces remaining uncollapsed duplicates that may indicate a dedup gap).
  {
    const collapsedCount = synthesis.criteria.reduce((sum, c) =>
      sum + c.recommendations.filter(r => r.collapsed_from_criteria && r.collapsed_from_criteria.length > 0).length, 0,
    );
    if (collapsedCount > 0) {
      const collapsedRecs = synthesis.criteria.flatMap(c =>
        c.recommendations
          .filter(r => r.collapsed_from_criteria && r.collapsed_from_criteria.length > 0)
          .map(r => `${c.key}: also affects ${r.collapsed_from_criteria!.join(",")}`)
      );
      warnings.push(
        `[P4_CROSS_CRITERION_DEDUP][INFO] ${collapsedCount} recommendation(s) consolidated from multiple criteria: ${collapsedRecs.slice(0, 5).join("; ")}`,
      );
    }
  }

  // ── P5 Check: Voice & Strength Preservation — verify mistake_proofing acknowledges ───
  // Checks that recommendations on criteria scoring ≤7 include mistake_proofing when
  // protected criteria (≥8) exist. A recommendation that could damage Voice 9/10 without
  // even acknowledging the risk is a voice-preservation failure.
  {
    const protectedCriteria = synthesis.criteria
      .filter(c => c.final_score_0_10 >= 8)
      .map(c => c.key);
    if (protectedCriteria.length > 0) {
      const missingPreservation: string[] = [];
      for (const c of synthesis.criteria) {
        if (c.final_score_0_10 >= 8) continue; // skip already-protected criteria
        for (const r of c.recommendations ?? []) {
          const mp = (r as Record<string, unknown>).mistake_proofing;
          if (!mp || (typeof mp === "string" && mp.trim().length < 10)) {
            missingPreservation.push(c.key);
            break; // one flag per criterion is enough
          }
        }
      }
      if (missingPreservation.length > 0) {
        warnings.push(
          `[P5_VOICE_PRESERVATION][WARN] ${missingPreservation.length} weak criterion/criteria (≤7) have recommendations without mistake_proofing acknowledging protected strengths (${protectedCriteria.slice(0, 4).join(", ")}): ${missingPreservation.slice(0, 5).join(", ")}. Candidate text may damage high-scoring criteria.`,
        );
      }
    }
  }
  // ── P6 Check: Genre-Calibrated Language — detect commercial-fiction phrasing ────────────
  // Checks recommendation action/impact/mechanism text for commercial-fiction phrasing
  // that lacks genre-relative context. This is a soft warning (observability only).
  {
    const uncalibratedRecs: string[] = [];
    for (const c of synthesis.criteria) {
      for (const r of c.recommendations ?? []) {
        if (isGenreUncalibratedPhrasing({ action: r.action ?? "", expected_impact: r.expected_impact, mechanism: (r as Record<string, unknown>).mechanism as string | undefined })) {
          uncalibratedRecs.push(`${c.key}: "${(r.action ?? "").slice(0, 50)}..."`);
        }
      }
    }
    if (uncalibratedRecs.length > 0) {
      warnings.push(
        `[P6_GENRE_CALIBRATION][WARN] ${uncalibratedRecs.length} recommendation(s) use commercial-fiction phrasing without genre-relative context: ${uncalibratedRecs.slice(0, 5).join("; ")}. Pacing/tension advice should reference the manuscript's genre standards.`,
      );
    }
  }

  const failedHardChecks = checks.filter((c) => !c.passed);
  return {
    pass: failedHardChecks.length === 0,
    checks,
    warnings,
    ...(editorialDiagnostics.length > 0
      ? {
          editorial_diagnostics: editorialDiagnostics,
          editorial_diagnostics_summary: buildEditorialDiagnosticsSummary(editorialDiagnostics),
        }
      : {}),
    ...(evidenceGroundingReport ? { evidence_grounding_report: evidenceGroundingReport } : {}),
  };
}

export function summarizeQualityGateFailures(checks: QualityGateCheck[]): QualityGateFailureTelemetry {
  const failedChecks = checks.filter((c) => !c.passed);
  const failuresByErrorCode: Record<string, number> = {};

  for (const check of failedChecks) {
    const errorCode = check.error_code ?? "QG_UNKNOWN";
    failuresByErrorCode[errorCode] = (failuresByErrorCode[errorCode] ?? 0) + 1;
  }

  return {
    total_failed_checks: failedChecks.length,
    failures_by_error_code: failuresByErrorCode,
    failed_check_ids: failedChecks.map((c) => c.check_id),
  };
}

/**
 * v2-specific completeness gate for persisted evaluation artifacts.
 *
 * This does not replace the pass4 synthesis gate. It validates that a
 * completed EvaluationResultV2 obeys status/score invariants and canonical
 * 13-key coverage.
 */
export function runQualityGateV2(
  result: EvaluationResultV2,
  artifact?: EvaluationArtifact,
  scopeProfile?: SubmissionScopeProfile,
): QualityGateV2Result {
  const checks: QualityGateCheck[] = [];
  const warnings: string[] = [];

  const artifactGate = artifact
    ? evaluateArtifactGate(artifact, "enforce")
    : {
        verdict: "PASS" as const,
        reasonCodes: [],
        validatedAt: new Date().toISOString(),
        enforcementMode: "enforce" as const,
      };

  const criteria = result.criteria;
  const expectedCount = CRITERIA_KEYS.length;

  if (criteria.length !== expectedCount) {
    checks.push({
      check_id: "v2_criteria_count",
      passed: false,
      error_code: "QG_CRITERIA_MISSING",
      details: `Expected ${expectedCount} criteria, got ${criteria.length}`,
    });
  } else {
    checks.push({
      check_id: "v2_criteria_count",
      passed: true,
      details: `All ${expectedCount} criteria present`,
    });
  }

  const seen = new Set<string>();
  const duplicateKeys: string[] = [];
  for (const c of criteria) {
    if (seen.has(c.key)) duplicateKeys.push(c.key);
    seen.add(c.key);
  }
  const missingKeys = CRITERIA_KEYS.filter((k) => !seen.has(k));

  checks.push({
    check_id: "v2_criteria_unique_coverage",
    passed: duplicateKeys.length === 0 && missingKeys.length === 0,
    error_code:
      duplicateKeys.length > 0 || missingKeys.length > 0
        ? "QG_CRITERIA_MISSING"
        : undefined,
    details:
      duplicateKeys.length > 0 || missingKeys.length > 0
        ? `duplicates=${duplicateKeys.join(",") || "none"}; missing=${missingKeys.join(",") || "none"}`
        : "No duplicates and full canonical key coverage",
  });

  const scopeGateEnabled = process.env.EVAL_SCOPE_PROFILE_ENABLED === "true";
  if (scopeGateEnabled && scopeProfile) {
    const shapeMismatches: string[] = [];

    for (const criterion of criteria) {
      const policy = scopePolicy(scopeProfile.inputScale, criterion.key);

      if (policy.plan === "NA") {
        const validNaShape =
          criterion.status === "NOT_APPLICABLE" &&
          criterion.score_0_10 === null &&
          criterion.scorable === false;

        if (!validNaShape) {
          shapeMismatches.push(
            `${criterion.key}: expected NOT_APPLICABLE + score_0_10=null + scorable=false when policy=NA; got status=${criterion.status}, score=${criterion.score_0_10}, scorable=${criterion.scorable}`,
          );
        }
      } else if (criterion.status === "NOT_APPLICABLE") {
        shapeMismatches.push(
          `${criterion.key}: status NOT_APPLICABLE is invalid when policy=${policy.plan}`,
        );
      }
    }

    checks.push({
      check_id: "criteria_scope_aligned",
      passed: shapeMismatches.length === 0,
      error_code:
        shapeMismatches.length > 0
          ? "QG_CRITERIA_SCOPE_SHAPE_MISMATCH"
          : undefined,
      details:
        shapeMismatches.length > 0
          ? `Scope-policy shape mismatches: ${shapeMismatches.join("; ")}`
          : "All criterion shapes align with scope policy",
    });

      const coverageSummary = result.governance?.transparency?.coverage_summary;
      const certification = computeManuscriptCertification({
        inputScale: scopeProfile.inputScale,
        partialEvaluation: coverageSummary?.partial_evaluation ?? false,
        coverageScope:
          coverageSummary &&
          typeof coverageSummary.source_char_count === "number" &&
          typeof coverageSummary.source_word_count === "number" &&
          typeof coverageSummary.analyzed_char_count === "number" &&
          typeof coverageSummary.analyzed_word_count === "number" &&
          coverageSummary.sampling_strategy
            ? {
                sourceChars: coverageSummary.source_char_count,
                sourceWords: coverageSummary.source_word_count,
                analyzedChars: coverageSummary.analyzed_char_count,
                analyzedWords: coverageSummary.analyzed_word_count,
                strategy: coverageSummary.sampling_strategy,
              }
            : undefined,
        hasSynthesisCriteria: criteria.length === expectedCount,
      });

      const uncertifiedManuscriptWide =
        certification.route === "LONG_FORM" && !certification.manuscriptWideCertifiable
          ? criteria
              .filter(
                (criterion) =>
                  criterionClaimScope(scopeProfile.inputScale, criterion.key) === "MANUSCRIPT_WIDE" &&
                  criterion.status === "SCORABLE",
              )
              .map((criterion) => criterion.key)
          : [];

      checks.push({
        check_id: "long_form_certification",
        passed: uncertifiedManuscriptWide.length === 0,
        error_code:
          uncertifiedManuscriptWide.length > 0
            ? "QG_CRITERIA_SCOPE_SHAPE_MISMATCH"
            : undefined,
        details:
          uncertifiedManuscriptWide.length > 0
            ? `Uncertified LONG_FORM manuscript-wide criteria remained SCORABLE: ${uncertifiedManuscriptWide.join(", ")} (reason_codes=${certification.reasonCodes.join(",") || "none"})`
            : certification.route === "LONG_FORM"
              ? "LONG_FORM certification state is internally consistent"
              : "SHORT_FORM route does not require manuscript-wide certification",
      });
  }

  // SLICE SPEC LOCK (per-criterion confidence + evidence-density):
  // Low confidence lowers trust; it does not erase a defensible score.
  //
  // We keep SCORABLE + scorable_low_confidence criteria out of hard-fail
  // completeness rejection for thin evidence, as long as they still carry a
  // valid numeric score + rationale. Anchor sparsity for this narrow class is
  // surfaced via warnings (LOW_CONFIDENCE_SCORABLE_CRITERIA), not hard fail.
  //
  // Fully scorable criteria (scorability_status !== scorable_low_confidence)
  // remain fail-closed against completeness and anchor thresholds.
  const incompleteKeys = criteria
    .filter((c) => {
      if (isCriterionComplete(c)) {
        return false;
      }

      if (
        c.status === "SCORABLE" &&
        c.scorability_status === "scorable_low_confidence"
      ) {
        const hasValidScore =
          typeof c.score_0_10 === "number" && c.score_0_10 >= 0 && c.score_0_10 <= 10;
        const hasRationale = typeof c.rationale === "string" && c.rationale.trim().length > 0;
        return !(hasValidScore && hasRationale);
      }

      return true;
    })
    .map((c) => c.key);
  checks.push({
    check_id: "v2_completeness_bridge",
    passed: incompleteKeys.length === 0,
    error_code: incompleteKeys.length > 0 ? "QG_CONSEQUENCE_CONTRACT" : undefined,
    details:
      incompleteKeys.length > 0
        ? `Criteria not validly classified per completeness bridge: ${incompleteKeys.join(",")}`
        : "All criteria satisfy completeness bridge rule",
  });

  const scoreWithoutSignal = criteria
    .filter(
      (c) =>
        c.status !== "SCORABLE" &&
        c.score_0_10 !== null,
    )
    .map((c) => c.key);
  checks.push({
    check_id: "v2_score_without_signal",
    passed: scoreWithoutSignal.length === 0,
    error_code: scoreWithoutSignal.length > 0 ? "QG_SCORE_RANGE" : undefined,
    details:
      scoreWithoutSignal.length > 0
        ? `Non-scorable criteria carrying numeric scores: ${scoreWithoutSignal.join(",")}`
        : "No non-scorable criteria carry numeric scores",
  });

  const signalStateMismatches = criteria
    .filter((c) => {
      if (c.status === "SCORABLE") {
        return c.signal_strength !== "SUFFICIENT" && c.signal_strength !== "STRONG";
      }
      if (c.status === "NO_SIGNAL") {
        return c.signal_strength !== "NONE";
      }
      if (c.status === "INSUFFICIENT_SIGNAL") {
        return c.signal_strength !== "WEAK";
      }
      if (c.status === "NOT_APPLICABLE") {
        // Tightened rule: NA must be structural/non-observable, not weak evidence.
        return c.signal_strength !== "NONE";
      }
      return true;
    })
    .map((c) => `${c.key}:${c.status}/${c.signal_strength}`);

  checks.push({
    check_id: "v2_signal_state_alignment",
    passed: signalStateMismatches.length === 0,
    error_code: signalStateMismatches.length > 0 ? "QG_SCORE_RANGE" : undefined,
    details:
      signalStateMismatches.length > 0
        ? `Signal/status mismatches: ${signalStateMismatches.join(",")}`
        : "Signal strength is aligned with criterion status",
  });

  // Governed NA provenance: if criteria_plan.NA exists, every NA status must be declared there.
  const governedNA = new Set(
    result.governance?.transparency?.criteria_plan?.NA?.filter((k) => typeof k === "string") ?? [],
  );
  const naCriteria = criteria.filter((c) => c.status === "NOT_APPLICABLE").map((c) => c.key);
  const ungovernedNA =
    governedNA.size === 0
      ? []
      : naCriteria.filter((k) => !governedNA.has(k));

  checks.push({
    check_id: "v2_na_governed_origin",
    passed: ungovernedNA.length === 0,
    error_code: ungovernedNA.length > 0 ? "QG_CONSEQUENCE_CONTRACT" : undefined,
    details:
      ungovernedNA.length > 0
        ? `NOT_APPLICABLE criteria missing from governance transparency.criteria_plan.NA: ${ungovernedNA.join(",")}`
        : "NOT_APPLICABLE criteria (if any) are governed",
  });

  /**
   * SLICE SPEC LOCK:
   * scorable_low_confidence criteria are exempt from hard-fail anchor threshold
   * checks. Thin support for this narrow class is warning-only; it does not
   * invalidate scorability by itself.
   *
   * Soft-fail enhancement: criteria with borderline confidence (<60) that are
   * only 1 anchor short of the threshold are also exempt from hard-fail. This
   * prevents premature INSUFFICIENT_SIGNAL when the LLM produced a usable score
   * but couldn't attach quite enough evidence. Applies to all 13 criteria.
   */
  const QG_BORDERLINE_CONFIDENCE_THRESHOLD = 60;

  const isBorderlineSoftFail = (c: (typeof criteria)[number]): boolean =>
    c.scorability_status === "scorable" &&
    typeof c.confidence_score_0_100 === "number" &&
    c.confidence_score_0_100 < QG_BORDERLINE_CONFIDENCE_THRESHOLD &&
    c.evidence.length >= minAnchorsFor(c.key) - 1;

  const borderlineSoftFailed: string[] = [];
  const scoredMissingAnchors = criteria
    .filter((c) => {
      if (c.status !== "SCORABLE") return false;
      if (c.scorability_status === "scorable_low_confidence") return false;
      if (c.evidence.length >= minAnchorsFor(c.key)) return false;
      if (isBorderlineSoftFail(c)) {
        borderlineSoftFailed.push(
          `${c.key}:${c.evidence.length}<${minAnchorsFor(c.key)}(confidence=${c.confidence_score_0_100})`,
        );
        return false;
      }
      return true;
    })
    .map((c) => `${c.key}:${c.evidence.length}<${minAnchorsFor(c.key)}`);

  if (borderlineSoftFailed.length > 0) {
    warnings.push(
      `BORDERLINE_ANCHOR_SOFT_FAIL: ${borderlineSoftFailed.join(",")}`,
    );
  }

  checks.push({
    check_id: "v2_scored_anchor_threshold",
    passed: scoredMissingAnchors.length === 0,
    error_code: scoredMissingAnchors.length > 0 ? "QG_MISSING_REQUIRED_EVIDENCE" : undefined,
    details:
      scoredMissingAnchors.length > 0
        ? `Scored criteria under anchor threshold: ${scoredMissingAnchors.join(",")}`
        : "All scored criteria meet anchor thresholds",
  });

  const lowConfidenceScored = criteria
    .filter(
      (c) =>
        c.status === "SCORABLE" &&
        c.scorability_status === "scorable_low_confidence",
    )
    .map((c) => `${c.key}:${c.confidence_score_0_100 ?? "n/a"}`);

  if (lowConfidenceScored.length > 0) {
    warnings.push(
      `LOW_CONFIDENCE_SCORABLE_CRITERIA: ${lowConfidenceScored.join(",")}`,
    );
  }

  const scoreConfidenceMismatchDetails: string[] = [];
  const borderlineScoreCapped: string[] = [];
  const downgradedCriteria: EvaluationResultV2["criteria"] = criteria.map((criterion): EvaluationResultV2["criteria"][number] => {
    if (
      criterion.status === "SCORABLE" &&
      criterion.confidence_level === "low" &&
      typeof criterion.score_0_10 === "number" &&
      criterion.score_0_10 > maxLowConfidenceScoreFor(criterion.key)
    ) {
      // Soft-fail: if borderline (just 1 anchor short, confidence < 60),
      // cap the score to the low-confidence maximum instead of downgrading
      // to INSUFFICIENT_SIGNAL. This preserves a usable (capped) score.
      if (isBorderlineSoftFail(criterion)) {
        const cap = maxLowConfidenceScoreFor(criterion.key);
        borderlineScoreCapped.push(`${criterion.key}:${criterion.score_0_10}→${cap}`);
        return {
          ...criterion,
          score_0_10: cap,
          technical_defects: [
            ...(criterion.technical_defects ?? []),
            {
              code: "BORDERLINE_CONFIDENCE_SCORE_CAPPED",
              author_facing_reason:
                `Score was capped from ${criterion.score_0_10} to ${cap} due to borderline evidence confidence.`,
              retryable: false,
            },
          ],
        };
      }

      scoreConfidenceMismatchDetails.push(`${criterion.key}:${criterion.score_0_10}`);

      const technicalDefects =
        criterion.key === "proseControl"
          ? [
              {
                code: "PROSE_CONTROL_ANCHOR_EXTRACTION_FAILED" as const,
                author_facing_reason:
                  "Prose appears strong, but the system could not attach enough line-specific evidence to certify a numeric score.",
                retryable: true,
              },
            ]
          : criterion.technical_defects;

      return {
        ...criterion,
        scorable: false as const,
        status: "INSUFFICIENT_SIGNAL" as const,
        signal_strength: "WEAK" as const,
        score_0_10: null,
        scorability_status: "non_scorable" as const,
        model_emitted_score_unverified: criterion.score_0_10,
        insufficient_signal_reason: {
          looked_for: ["CERTIFIED_ANCHORS_FOR_HIGH_CONFIDENCE_SCORING"],
          not_found: ["LOW_CONFIDENCE_HIGH_SCORE_WITHOUT_CERTIFIED_ANCHORS"],
        },
        technical_defects: technicalDefects,
      };
    }

    return criterion;
  });

  if (borderlineScoreCapped.length > 0) {
    warnings.push(
      `BORDERLINE_CONFIDENCE_SCORE_CAPPED: ${borderlineScoreCapped.join(",")}`,
    );
  }

  const criteriaForPostAlignmentChecks =
    (scoreConfidenceMismatchDetails.length > 0 || borderlineScoreCapped.length > 0)
      ? downgradedCriteria
      : criteria;

  checks.push({
    check_id: "v2_fidelity_score_confidence_alignment",
    passed: scoreConfidenceMismatchDetails.length === 0,
    error_code:
      scoreConfidenceMismatchDetails.length > 0
        ? "QG_FIDELITY_SCORE_CONFIDENCE_MISMATCH"
        : undefined,
    details:
      scoreConfidenceMismatchDetails.length > 0
        ? `Low-confidence criteria exceeded per-criterion score caps and were downgraded to INSUFFICIENT_SIGNAL: ${scoreConfidenceMismatchDetails.join(",")}`
        : "Score-confidence alignment holds",
  });

  const propagation = summarizePropagationIntegrity(criteriaForPostAlignmentChecks);

  const summaryMentionsWeakness = summaryMentionsBottomWeakness(
    result.overview.one_paragraph_summary,
    propagation.bottomScoreCriteria,
  );

  checks.push({
    check_id: "v2_summary_weakness_presence",
    passed:
      propagation.bottomScoreCriteria.length === 0 ||
      summaryMentionsWeakness,
    error_code:
      propagation.bottomScoreCriteria.length > 0 && !summaryMentionsWeakness
        ? "QG_SUMMARY_OMITS_WEAKNESS"
        : undefined,
    details:
      propagation.bottomScoreCriteria.length > 0 && !summaryMentionsWeakness
        ? `Overview summary omits bottom-score weakness criteria: ${propagation.bottomScoreCriteria.join(",")}`
        : "Overview summary references low-score weakness cluster or no weak cluster exists",
  });

  const scoredCount = criteriaForPostAlignmentChecks.filter((c) => c.status === "SCORABLE").length;

  const aggregateScoreMismatch =
    (scoredCount === 0 && result.overview.overall_score_0_100 !== null) ||
    (scoredCount > 0 && (result.overview.overall_score_0_100 === null || Number.isNaN(result.overview.overall_score_0_100)));

  checks.push({
    check_id: "v2_overall_score_coherence",
    passed: !aggregateScoreMismatch,
    error_code: aggregateScoreMismatch ? "QG_SCORE_RANGE" : undefined,
    details:
      aggregateScoreMismatch
        ? `overview.overall_score_0_100 is incoherent with scored criteria count (${scoredCount})`
        : "Overview aggregate score is coherent with scored criteria count",
  });

  if (scoredCount < 7) {
    warnings.push(`LOW_EVALUABILITY_COVERAGE: scored_criteria_count=${scoredCount}/${expectedCount}`);
  }

  const presentingHighAuthority =
    artifactGate.verdict === "PASS" &&
    !result.governance.warnings.some((warning) =>
      warning.toUpperCase().includes("CONFIDENCE VARIES"),
    );

  checks.push({
    check_id: "v2_propagation_integrity",
    passed: !(propagation.upstreamIntegrity === "weak" && presentingHighAuthority),
    error_code:
      propagation.upstreamIntegrity === "weak" && presentingHighAuthority
        ? "QG_PROPAGATION_INTEGRITY"
        : undefined,
    details:
      propagation.upstreamIntegrity === "weak" && presentingHighAuthority
        ? "Upstream integrity is weak while artifact presentation remains high-authority"
        : `Propagation integrity enforced (upstream=${propagation.upstreamIntegrity}, authority=${propagation.authorityLevel})`,
  });

  if (propagation.upstreamIntegrity === "mixed") {
    warnings.push(
      `PROPAGATION_MIXED_CONFIDENCE: low=${propagation.lowConfidenceCount} moderate=${propagation.moderateConfidenceCount} missingEvidence=${propagation.missingEvidenceCount}`,
    );
  }

  const artifactReasonSummary = artifactGate.reasonCodes.join(",") || "none";
  if (artifactGate.verdict === "FAIL") {
    checks.push({
      check_id: "v2_artifact_gate",
      passed: false,
      error_code: "QG_ARTIFACT_GATE_FAIL",
      details: `Artifact gate verdict=FAIL reason_codes=${artifactReasonSummary}`,
    });
  } else {
    checks.push({
      check_id: "v2_artifact_gate",
      passed: true,
      details: `Artifact gate verdict=${artifactGate.verdict} reason_codes=${artifactReasonSummary}`,
    });

    if (artifactGate.verdict === "HOLD") {
      warnings.push(
        `[ArtifactGate:HOLD] reason_codes=${artifactReasonSummary}`,
      );
    }
  }

  const failedHardChecks = checks.filter(
    (c) => !c.passed && c.check_id !== "v2_fidelity_score_confidence_alignment",
  );

  const downgradedResult =
    (scoreConfidenceMismatchDetails.length > 0 || borderlineScoreCapped.length > 0)
      ? {
          ...result,
          overview: {
            ...result.overview,
            scored_criteria_count: scoredCount,
            overall_score_0_100:
              scoredCount === 0 ? null : result.overview.overall_score_0_100,
          },
          criteria: downgradedCriteria,
        }
      : undefined;

  return {
    pass: failedHardChecks.length === 0,
    checks,
    warnings,
    artifactGate,
    downgradedResult,
  };
}
