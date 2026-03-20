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
 *   QG_LONG_REC           — action > 300 chars
 *   QG_LONG_EVIDENCE      — evidence snippet > 200 chars
 *   QG_LONG_OVERVIEW      — one_paragraph_summary > 500 chars
 *   QG_CRITERIA_MISSING   — output does not contain all 13 criteria
 *   QG_SCORE_RANGE        — score not in integer 0-10
 *   QG_INDEPENDENCE_VIOLATION — Pass 2 reuses non-manuscript rationale phrasing from Pass 1
 */

import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { SynthesisOutput, QualityGateResult, QualityGateCheck, SinglePassOutput } from "./types";

export const QG_MIN_REC_LENGTH = 50;
export const QG_MAX_REC_LENGTH = 300;
export const QG_MAX_EVIDENCE_LENGTH = 200;
export const QG_MAX_OVERVIEW_LENGTH = 500;
export const QG_INDEPENDENCE_NGRAM_SIZE = 8;
export const QG_INDEPENDENCE_MIN_OVERLAPS_PER_CRITERION = 2;

function tokenizeForOverlap(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

function collectNgrams(text: string, n: number): string[] {
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

/**
 * Run all quality gate checks against a SynthesisOutput.
 * Returns a QualityGateResult (pass=true iff all non-warn checks pass).
 */
export function runQualityGate(
  synthesis: SynthesisOutput,
  pass1?: SinglePassOutput,
  pass2?: SinglePassOutput,
): QualityGateResult {
  const checks: QualityGateCheck[] = [];
  const warnings: string[] = [];

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

  // ── Check 4: Recommendation length (50-300 chars) ────────────────────────
  const shortRecs: string[] = [];
  const longRecs: string[] = [];
  for (const c of synthesis.criteria) {
    for (const r of c.recommendations) {
      if (r.action.length < QG_MIN_REC_LENGTH)
        shortRecs.push(`${c.key}: "${r.action}"`);
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

  // ── Check 5: Evidence excerpt length (≤200 chars) ────────────────────────
  const longEvidence: string[] = [];
  for (const c of synthesis.criteria) {
    for (const e of c.evidence) {
      if (e.snippet.length > QG_MAX_EVIDENCE_LENGTH) {
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
        ? `${longEvidence.length} evidence excerpt(s) exceed ${QG_MAX_EVIDENCE_LENGTH} chars`
        : `All evidence excerpts ≤ ${QG_MAX_EVIDENCE_LENGTH} chars`,
  });

  // ── Check 6: Overview length (≤500 chars) ────────────────────────────────
  const overviewLen = synthesis.overall.one_paragraph_summary.length;
  checks.push({
    check_id: "overview_length",
    passed: overviewLen <= QG_MAX_OVERVIEW_LENGTH,
    error_code: overviewLen > QG_MAX_OVERVIEW_LENGTH ? "QG_LONG_OVERVIEW" : undefined,
    details: `Overview: ${overviewLen} chars (max ${QG_MAX_OVERVIEW_LENGTH})`,
  });

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

  // ── Check 8: Pass independence (rationale phrasing only; calibrated) ─────
  if (pass1 && pass2) {
    const ngramSize = QG_INDEPENDENCE_NGRAM_SIZE;

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
    for (const c of pass2.criteria) {
      let overlapCount = 0;
      for (const gram of collectNgrams(c.rationale, ngramSize)) {
        if (evidenceNgrams.has(gram)) {
          continue;
        }
        if (pass1Ngrams.has(gram)) {
          overlapCount += 1;
        }
      }

      if (overlapCount >= QG_INDEPENDENCE_MIN_OVERLAPS_PER_CRITERION) {
        violations.push(
          `${c.key}: ${overlapCount} shared non-evidence ${ngramSize}-gram(s) with Pass 1 rationale`,
        );
      }
    }

    checks.push({
      check_id: "pass_independence",
      passed: violations.length === 0,
      error_code: violations.length > 0 ? "QG_INDEPENDENCE_VIOLATION" : undefined,
      details:
        violations.length > 0
          ? `${violations.length} Pass 2 criterion/criteria exceed calibrated rationale-overlap threshold (n=${ngramSize}, min=${QG_INDEPENDENCE_MIN_OVERLAPS_PER_CRITERION})`
          : `Pass 1 / Pass 2 independence confirmed (n=${ngramSize})`,
    });

    if (violations.length > 0) {
      warnings.push(...violations);
    }
  }

  // ── Warn: Confidence minimum (soft fail) ─────────────────────────────────
  // (Not available in SynthesisOutput directly — carries over from A6 layer)
  // Reserved for future integration.

  const failedHardChecks = checks.filter((c) => !c.passed);
  return {
    pass: failedHardChecks.length === 0,
    checks,
    warnings,
  };
}
