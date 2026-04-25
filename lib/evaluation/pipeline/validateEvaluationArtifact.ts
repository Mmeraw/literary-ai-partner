import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import { buildExcellenceFilter } from "./buildExcellenceFilter";
import { buildScoreLedger } from "./buildScoreLedger";
import type {
  ArtifactReasonCode,
  ArtifactValidationSummary,
  EvaluationArtifact,
} from "./types";

export type ArtifactValidationMode = "log" | "enforce";

export type ArtifactValidationOutput = ArtifactValidationSummary & {
  validatedAt: string;
  enforcementMode: ArtifactValidationMode;
};

const STRUCTURAL_BLOCKING_REASON_CODES = new Set<ArtifactReasonCode>([
  "CRIT-MISSING-ALL",
  "CRIT-MISSING-1",
  "SCORE-NORM-1",
  "EFG-MISMATCH-1",
]);

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function hasDirectQuoteAnchor(evidence: string): boolean {
  return /["“”]/.test(evidence);
}

function hasAnchoredParaphrase(evidence: string): boolean {
  // Heuristic for anchored paraphrase labels such as:
  // "river-bank conversation after camp setup" or
  // "At the runway scene: ..."
  return (
    evidence.length >= 24 &&
    /\b(after|before|during|at|in|on|near|within|opening|closing|scene|chapter|paragraph|passage)\b/i.test(
      evidence,
    )
  );
}

function evidenceIsAnchored(evidence: string): boolean {
  return hasDirectQuoteAnchor(evidence) || hasAnchoredParaphrase(evidence);
}

function sortedUnique(codes: ArtifactReasonCode[]): ArtifactReasonCode[] {
  const seen = new Set<ArtifactReasonCode>();
  const deduped: ArtifactReasonCode[] = [];
  for (const code of codes) {
    if (!seen.has(code)) {
      seen.add(code);
      deduped.push(code);
    }
  }
  return deduped;
}

export function hasBlockingArtifactReasonCodes(reasonCodes: ArtifactReasonCode[]): boolean {
  return reasonCodes.some((code) => STRUCTURAL_BLOCKING_REASON_CODES.has(code));
}

export function validateEvaluationArtifact(
  artifact: EvaluationArtifact,
  options?: { mode?: ArtifactValidationMode },
): ArtifactValidationOutput {
  const reasonCodes: ArtifactReasonCode[] = [];
  const criteria = artifact.criteria ?? [];

  if (criteria.length === 0) {
    reasonCodes.push("CRIT-MISSING-ALL");
  }

  const presentKeys = new Set(criteria.map((c) => c.key));
  const missingKeys = CRITERIA_KEYS.filter((key) => !presentKeys.has(key));
  const hasWrongCount = criteria.length !== CRITERIA_KEYS.length;
  const hasUnknownKey = criteria.some((c) => !CRITERIA_KEYS.includes(c.key));

  if (hasWrongCount || hasUnknownKey || missingKeys.length > 0) {
    reasonCodes.push("CRIT-MISSING-1");
  }

  let hasNonIntegerScore = false;
  let hasOutOfRangeScore = false;
  let hasMissingReasoning = false;
  let hasMissingEvidence = false;
  let hasMissingInterpretation = false;

  for (const criterion of criteria) {
    const score = criterion.final_score_0_10;
    if (!Number.isInteger(score)) {
      hasNonIntegerScore = true;
    }
    if (typeof score !== "number" || score < 0 || score > 10) {
      hasOutOfRangeScore = true;
    }

    const reasoning = normalizeText(criterion.reasoning);
    if (!reasoning || /^n\/?a$/i.test(reasoning)) {
      hasMissingReasoning = true;
    }

    const evidence = normalizeText(criterion.evidence);
    if (!evidence || /^n\/?a$/i.test(evidence) || !evidenceIsAnchored(evidence)) {
      hasMissingEvidence = true;
    }

    const interpretation = normalizeText(criterion.interpretation);
    if (!interpretation || /^n\/?a$/i.test(interpretation)) {
      hasMissingInterpretation = true;
    }
  }

  if (hasNonIntegerScore) {
    reasonCodes.push("SCORE-NON-INTEGER-1");
  }
  if (hasOutOfRangeScore) {
    reasonCodes.push("SCORE-OUT-OF-RANGE-1");
  }
  if (hasMissingEvidence) {
    reasonCodes.push("EVIDENCE-MISSING-1");
  }
  if (hasMissingReasoning) {
    reasonCodes.push("REASONING-MISSING-1");
  }
  if (hasMissingInterpretation) {
    reasonCodes.push("INTERP-MISSING-1");
  }

  const expectedLedger = buildScoreLedger({
    criteria: criteria.map((criterion) => ({
      final_score_0_10: criterion.final_score_0_10,
    })),
  });

  if (
    artifact.ledger.rawTotal !== expectedLedger.rawTotal ||
    artifact.ledger.maxTotal !== expectedLedger.maxTotal ||
    artifact.ledger.normalized !== expectedLedger.normalized ||
    artifact.ledger.weighting !== "equal"
  ) {
    reasonCodes.push("SCORE-NORM-1");
  }

  const expectedEfg = buildExcellenceFilter({
    criteria: criteria.map((criterion) => ({
      key: criterion.key,
      final_score_0_10: criterion.final_score_0_10,
    })),
  });

  const expectedBlocking = [...expectedEfg.blockingCriteria].sort();
  const actualBlocking = [...(artifact.efg.blockingCriteria ?? [])].sort();
  const blockingMatches =
    expectedBlocking.length === actualBlocking.length &&
    expectedBlocking.every((key, idx) => key === actualBlocking[idx]);

  if (artifact.efg.verdict !== expectedEfg.verdict || !blockingMatches) {
    reasonCodes.push("EFG-MISMATCH-1");
  }

  const normalizedCodes = sortedUnique(reasonCodes);
  const result: ArtifactValidationSummary["result"] =
    normalizedCodes.length === 0
      ? "PASS"
      : normalizedCodes.includes("CRIT-MISSING-ALL")
        ? "FAIL"
        : "HOLD";

  return {
    result,
    reasonCodes: normalizedCodes,
    validatedAt: new Date().toISOString(),
    enforcementMode: options?.mode ?? "log",
  };
}
