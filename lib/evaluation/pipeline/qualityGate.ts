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
 *   QG_CONSEQUENCE_CONTRACT — missing pressure/decision/consequence contract fields
 *   QG_THIN_RATIONALE      — criterion rationale < 40 chars
 *   QG_PLACEHOLDER_RATIONALE — criterion rationale includes known placeholder phrasing
 *   QG_LOW_EVIDENCE_COVERAGE — too many criteria lack substantive evidence snippets
 *   QG_MISSING_REQUIRED_EVIDENCE — required spine criteria missing substantive evidence snippets
 *   QG_INDEPENDENCE_VIOLATION — Pass 2 reuses non-manuscript rationale phrasing from Pass 1
 */

import { CRITERIA_KEYS, type CriterionKey } from "@/schemas/criteria-keys";
import { PLACEHOLDER_RATIONALE_PATTERNS } from "./placeholderRationalePatterns";
import type { SynthesisOutput, QualityGateResult, QualityGateCheck, SinglePassOutput } from "./types";
import { analyzePovRendering } from "@/lib/evaluation/pov/analyzePovRendering";
import { analyzeDialogueAttribution } from "@/lib/evaluation/pov/analyzeDialogueAttribution";
import { validatePovCriterionEvidence } from "@/lib/evaluation/pov/validatePovCriterionEvidence";
import type { EvaluationResultV2 } from "@/schemas/evaluation-result-v2";
import {
  isCriterionComplete,
  minAnchorsFor,
} from "@/lib/evaluation/signal/criterionObservability";

export const QG_MIN_REC_LENGTH = 50;
export const QG_MAX_REC_LENGTH = 300;
export const QG_MAX_EVIDENCE_LENGTH = 200;
export const QG_MAX_OVERVIEW_LENGTH = 500;
export const QG_INDEPENDENCE_NGRAM_SIZE = 8;
export const QG_INDEPENDENCE_MIN_OVERLAPS_PER_CRITERION = 6;
export const QG_INDEPENDENCE_RATIONALE_PREVIEW_CHARS = 320;
export const QG_MIN_RATIONALE_LENGTH = 40;
export const QG_MIN_EVIDENCE_COVERED_CRITERIA = 10;
export const QG_MIN_EVIDENCE_SNIPPET_LENGTH = 20;
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

export type QualityGateFailureTelemetry = {
  total_failed_checks: number;
  failures_by_error_code: Record<string, number>;
  failed_check_ids: string[];
};

function normalizeForPhraseMatch(text: string): string {
  return (text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function hasSubstantiveEvidence(evidence: Array<{ snippet: string }>): boolean {
  return evidence.some((e) => e.snippet.trim().length >= QG_MIN_EVIDENCE_SNIPPET_LENGTH);
}

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

function previewRationale(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, QG_INDEPENDENCE_RATIONALE_PREVIEW_CHARS);
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
      const hasDialogueMechanismMarker = [
        "attribution",
        "tag",
        "speaker",
        "quote",
        "dialogue",
        "beat",
      ].some((m) => dialogueRationale.includes(m));

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
        passed: hasDialogueMechanismMarker,
        error_code: hasDialogueMechanismMarker ? undefined : "QG_DIALOGUE_ATTRIBUTION_UNDERAUDITED",
        details: hasDialogueMechanismMarker
          ? "Dialogue rationale includes attribution/rendering mechanism language"
          : "Dialogue rationale lacks attribution/rendering mechanism language",
      });
    }
  }

  // ── Check 10: Pass independence (rationale phrasing only; calibrated) ────
  if (pass1 && pass2) {
    const ngramSize = QG_INDEPENDENCE_NGRAM_SIZE;
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
    for (const c of pass2.criteria) {
      let overlapCount = 0;
      const overlapSamples: string[] = [];
      for (const gram of collectNgrams(c.rationale, ngramSize)) {
        if (evidenceNgrams.has(gram)) {
          continue;
        }
        if (pass1Ngrams.has(gram)) {
          overlapCount += 1;
          if (overlapSamples.length < 5 && !overlapSamples.includes(gram)) {
            overlapSamples.push(gram);
          }
        }
      }

      if (overlapCount >= QG_INDEPENDENCE_MIN_OVERLAPS_PER_CRITERION) {
        const sampleText = overlapSamples.length > 0
          ? ` [samples: ${overlapSamples.map((s) => `"${s}"`).join(" | ")}]`
          : "";
        const pass1Rationale = pass1ByKey.get(c.key)?.rationale ?? "";
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
export function runQualityGateV2(result: EvaluationResultV2): QualityGateResult {
  const checks: QualityGateCheck[] = [];
  const warnings: string[] = [];

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

  const incompleteKeys = criteria.filter((c) => !isCriterionComplete(c)).map((c) => c.key);
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

  const scoredMissingAnchors = criteria
    .filter((c) => c.status === "SCORABLE" && c.evidence.length < minAnchorsFor(c.key))
    .map((c) => `${c.key}:${c.evidence.length}<${minAnchorsFor(c.key)}`);
  checks.push({
    check_id: "v2_scored_anchor_threshold",
    passed: scoredMissingAnchors.length === 0,
    error_code: scoredMissingAnchors.length > 0 ? "QG_MISSING_REQUIRED_EVIDENCE" : undefined,
    details:
      scoredMissingAnchors.length > 0
        ? `Scored criteria under anchor threshold: ${scoredMissingAnchors.join(",")}`
        : "All scored criteria meet anchor thresholds",
  });

  const scoredCount = criteria.filter((c) => c.status === "SCORABLE").length;

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

  const failedHardChecks = checks.filter((c) => !c.passed);
  return {
    pass: failedHardChecks.length === 0,
    checks,
    warnings,
  };
}
