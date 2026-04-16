/**
 * Criterion Observability & Signal Sufficiency helper.
 *
 * Core law:
 * - Applicability is determined by governance (criteria_plan/MDM/eval mode)
 * - Observability is determined by manuscript evidence
 */

import type {
  CriterionStatus,
  EvaluationCriterionV2,
  InsufficientSignalReason,
  SignalStrength,
} from "@/schemas/evaluation-result-v2";
import type { CriterionKey } from "@/schemas/criteria-keys";

export type CriteriaPlanCode = "R" | "O" | "NA" | "C";
export type CriteriaPlanMap = Partial<Record<CriterionKey, CriteriaPlanCode>>;

export type EvidenceAnchorInput = {
  snippet: string;
  location?: {
    char_start?: number;
    char_end?: number;
    segment_id?: string;
  };
  note?: string;
};

export type RawCriterionInput = {
  key: CriterionKey;
  score_0_10?: number | null;
  rationale?: string;
  evidence?: EvidenceAnchorInput[];
  signal_strength?: SignalStrength;
  recommendations?: Array<{
    priority?: "high" | "medium" | "low";
    action?: string;
    expected_impact?: string;
  }>;
  insufficient_signal_reason?: InsufficientSignalReason;
};

const PATTERN_CRITERIA = new Set<CriterionKey>(["voice", "tone", "pacing", "theme"]);

const MIN_ANCHORS: Record<CriterionKey, number> = {
  concept: 2,
  narrativeDrive: 2,
  character: 2,
  voice: 2,
  sceneConstruction: 2,
  dialogue: 2,
  theme: 2,
  worldbuilding: 1,
  pacing: 2,
  proseControl: 2,
  tone: 2,
  narrativeClosure: 1,
  marketability: 2,
};

export function isPatternCriterion(key: CriterionKey): boolean {
  return PATTERN_CRITERIA.has(key);
}

export function minAnchorsFor(key: CriterionKey): number {
  return MIN_ANCHORS[key];
}

function lexicalTokens(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

function lexicalSimilarity(a: string, b: string): number {
  const ta = new Set(lexicalTokens(a));
  const tb = new Set(lexicalTokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  const intersection = [...ta].filter((t) => tb.has(t)).length;
  const denom = Math.max(ta.size, tb.size);
  return intersection / denom;
}

function overlapRatio(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): number {
  const start = Math.max(aStart, bStart);
  const end = Math.min(aEnd, bEnd);
  const overlap = Math.max(0, end - start);
  const minLen = Math.max(1, Math.min(aEnd - aStart, bEnd - bStart));
  return overlap / minLen;
}

/**
 * Deterministic distinctness rules:
 * - same sentence/snippet text => duplicate
 * - char-span overlap > 50% => duplicate
 * - same 200-char window and lexical overlap > 60% => duplicate
 */
export function dedupeAnchors(anchors: EvidenceAnchorInput[]): EvidenceAnchorInput[] {
  const out: EvidenceAnchorInput[] = [];

  for (const candidate of anchors) {
    const isDup = out.some((existing) => {
      const sameSnippet = candidate.snippet.trim().toLowerCase() === existing.snippet.trim().toLowerCase();
      if (sameSnippet) return true;

      const cStart = candidate.location?.char_start;
      const cEnd = candidate.location?.char_end;
      const eStart = existing.location?.char_start;
      const eEnd = existing.location?.char_end;

      if (
        typeof cStart === "number" &&
        typeof cEnd === "number" &&
        typeof eStart === "number" &&
        typeof eEnd === "number"
      ) {
        const overlap = overlapRatio(cStart, cEnd, eStart, eEnd);
        if (overlap > 0.5) return true;

        const nearWindow = Math.abs(cStart - eStart) <= 200;
        if (nearWindow && lexicalSimilarity(candidate.snippet, existing.snippet) > 0.6) {
          return true;
        }
      }

      return false;
    });

    if (!isDup) out.push(candidate);
  }

  return out;
}

export function classifySignalStrength(
  raw: RawCriterionInput,
  opts?: { passageCoverageRatio?: number; sentenceCount?: number },
): SignalStrength {
  const deduped = dedupeAnchors(raw.evidence ?? []);
  const threshold = minAnchorsFor(raw.key);

  // Prose control sustainment rule (locked):
  // scorable only if 5+ sentences OR >=30% coverage.
  if (raw.key === "proseControl") {
    const sentenceCount = opts?.sentenceCount ?? 0;
    const coverage = opts?.passageCoverageRatio ?? 0;
    const sustained = sentenceCount >= 5 || coverage >= 0.3;
    if (!sustained) {
      return deduped.length > 0 ? "WEAK" : "NONE";
    }
  }

  if (raw.signal_strength) {
    // Fail-closed override: cannot claim sufficient/strong with no anchors.
    if ((raw.signal_strength === "SUFFICIENT" || raw.signal_strength === "STRONG") && deduped.length === 0) {
      return "NONE";
    }
    return raw.signal_strength;
  }

  if (deduped.length === 0) return "NONE";
  if (deduped.length < threshold) return "WEAK";

  if (isPatternCriterion(raw.key)) {
    // Minimal deterministic distribution proxy: require at least one anchor pair
    // separated by >=200 chars to claim STRONG.
    let distributed = false;
    for (let i = 0; i < deduped.length; i++) {
      for (let j = i + 1; j < deduped.length; j++) {
        const a = deduped[i].location?.char_start;
        const b = deduped[j].location?.char_start;
        if (typeof a === "number" && typeof b === "number" && Math.abs(a - b) >= 200) {
          distributed = true;
          break;
        }
      }
      if (distributed) break;
    }

    return distributed && deduped.length >= threshold + 1 ? "STRONG" : "SUFFICIENT";
  }

  return deduped.length >= threshold + 1 ? "STRONG" : "SUFFICIENT";
}

export function deriveCriterionStatus(signalStrength: SignalStrength): Exclude<CriterionStatus, "NOT_APPLICABLE"> {
  if (signalStrength === "NONE") return "NO_SIGNAL";
  if (signalStrength === "WEAK") return "INSUFFICIENT_SIGNAL";
  return "SCORABLE";
}

function toConfidenceBand(signalStrength: SignalStrength): "LOW" | "MEDIUM" | "HIGH" {
  if (signalStrength === "STRONG") return "HIGH";
  if (signalStrength === "SUFFICIENT") return "MEDIUM";
  return "LOW";
}

function buildStructuredReason(
  status: "NO_SIGNAL" | "INSUFFICIENT_SIGNAL",
  raw?: InsufficientSignalReason,
): InsufficientSignalReason {
  if (raw && Array.isArray(raw.looked_for) && raw.looked_for.length > 0 && Array.isArray(raw.not_found)) {
    return raw;
  }

  return {
    looked_for: ["criterion-specific manuscript evidence"],
    not_found:
      status === "NO_SIGNAL"
        ? ["no relevant evidence detected in evaluated text"]
        : ["evidence detected but below sufficiency threshold"],
  };
}

/**
 * Normalization boundary:
 * 1) Governed applicability first
 * 2) Observability second
 */
export function normalizeCriterion(
  raw: RawCriterionInput,
  opts?: {
    criteriaPlan?: CriteriaPlanMap;
    passageCoverageRatio?: number;
    sentenceCount?: number;
  },
): EvaluationCriterionV2 {
  const evidence = dedupeAnchors(raw.evidence ?? []).map((e) => ({
    snippet: e.snippet,
    location: e.location,
    note: e.note,
  }));

  const recommendations = (raw.recommendations ?? [])
    .filter((r) => (r.action ?? "").trim().length > 0)
    .map((r) => ({
      priority: (r.priority ?? "medium") as "high" | "medium" | "low",
      action: r.action!,
      expected_impact: r.expected_impact ?? "",
    }));

  const rationale = (raw.rationale ?? "").trim() || `Criterion ${raw.key} evaluation status was derived by governed observability checks.`;

  // GOVERNED NOT_APPLICABLE path (model must not invent this)
  if (opts?.criteriaPlan?.[raw.key] === "NA") {
    return {
      key: raw.key,
      scorable: false,
      status: "NOT_APPLICABLE",
      signal_present: false,
      signal_strength: "NONE",
      score_0_10: null,
      confidence_band: "LOW",
      rationale,
      evidence,
      recommendations,
    };
  }

  const signalStrength = classifySignalStrength(raw, {
    passageCoverageRatio: opts?.passageCoverageRatio,
    sentenceCount: opts?.sentenceCount,
  });
  const status = deriveCriterionStatus(signalStrength);

  if (status === "SCORABLE") {
    if (typeof raw.score_0_10 !== "number" || !Number.isFinite(raw.score_0_10)) {
      // Fail-closed downgrade: not enough trustworthy score payload
      const downgradedStatus: "INSUFFICIENT_SIGNAL" = "INSUFFICIENT_SIGNAL";
      return {
        key: raw.key,
        scorable: false,
        status: downgradedStatus,
        signal_present: true,
        signal_strength: "WEAK",
        score_0_10: null,
        confidence_band: "LOW",
        rationale,
        evidence,
        recommendations,
        insufficient_signal_reason: buildStructuredReason(downgradedStatus, raw.insufficient_signal_reason),
      };
    }

    const rounded = Math.max(0, Math.min(10, Math.round(raw.score_0_10)));
    return {
      key: raw.key,
      scorable: true,
      status: "SCORABLE",
      signal_present: true,
      signal_strength: signalStrength as "SUFFICIENT" | "STRONG",
      score_0_10: rounded,
      confidence_band: toConfidenceBand(signalStrength),
      rationale,
      evidence,
      recommendations,
    };
  }

  return {
    key: raw.key,
    scorable: false,
    status,
    signal_present: signalStrength === "WEAK",
    signal_strength: signalStrength as "NONE" | "WEAK",
    score_0_10: null,
    confidence_band: "LOW",
    rationale,
    evidence,
    recommendations,
    insufficient_signal_reason: buildStructuredReason(status, raw.insufficient_signal_reason),
  };
}

export function isCriterionComplete(c: EvaluationCriterionV2): boolean {
  if (!c.rationale || c.rationale.trim().length === 0) return false;

  if (c.status === "NOT_APPLICABLE") {
    return c.scorable === false && c.score_0_10 === null && !('insufficient_signal_reason' in c);
  }

  if (c.status === "SCORABLE") {
    return (
      c.scorable === true &&
      typeof c.score_0_10 === "number" &&
      c.score_0_10 >= 0 &&
      c.score_0_10 <= 10 &&
      c.evidence.length >= minAnchorsFor(c.key)
    );
  }

  return (
    c.scorable === false &&
    c.score_0_10 === null &&
    !!(c as { insufficient_signal_reason?: InsufficientSignalReason }).insufficient_signal_reason
  );
}

export function computeWeightedScore(criteria: EvaluationCriterionV2[]): {
  overall_score_0_100: number | null;
  scored_count: number;
  total_count: number;
} {
  const scored = criteria.filter((c): c is Extract<EvaluationCriterionV2, { status: "SCORABLE" }> => c.status === "SCORABLE");

  if (scored.length === 0) {
    return {
      overall_score_0_100: null,
      scored_count: 0,
      total_count: criteria.length,
    };
  }

  const avg = scored.reduce((acc, c) => acc + c.score_0_10, 0) / scored.length;
  return {
    overall_score_0_100: Math.round((avg / 10) * 100),
    scored_count: scored.length,
    total_count: criteria.length,
  };
}
