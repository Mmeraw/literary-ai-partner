import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { CriterionKey } from "@/schemas/criteria-keys";
import type { EvidenceAnchor, SinglePassOutput } from "./types";

export type ComparisonState = "agree" | "soft_divergence" | "hard_divergence" | "missing_or_invalid";

export type DisputedExcerptWindow = {
  char_start: number;
  char_end: number;
  snippet: string;
};

export type ComparisonPacketCriterion = {
  key: CriterionKey;
  state: ComparisonState;
  score_delta: number;
  pass1_score: number | null;
  pass1_mechanism_summary: string;
  pass1_evidence: EvidenceAnchor[];
  pass2_score: number | null;
  pass2_rationale_short: string;
  disputed_excerpt_window?: DisputedExcerptWindow;
};

export type ComparisonPacket = {
  criteria: ComparisonPacketCriterion[];
  criteria_count_by_state: Record<ComparisonState, number>;
};

export type BuildComparisonPacketOptions = {
  manuscriptText?: string;
  excerptRadiusChars?: number;
  maxEvidencePerCriterion?: number;
};

const DEFAULT_EXCERPT_RADIUS_CHARS = 220;
const DEFAULT_MAX_EVIDENCE_PER_CRITERION = 3;
const MAX_SNIPPET_CHARS = 200;
const MAX_SUMMARY_CHARS = 220;
const MAX_RATIONALE_SHORT_CHARS = 220;

function toCriterionMap(pass: SinglePassOutput): Map<CriterionKey, SinglePassOutput["criteria"][number]> {
  return new Map(pass.criteria.map((criterion) => [criterion.key, criterion]));
}

function isValidScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 10;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function toFirstSentence(text: string, maxChars: number): string {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return "";

  const parts = normalized.split(/(?<=[.!?])\s+/);
  const first = parts[0] || normalized;
  return first.length <= maxChars ? first : first.slice(0, maxChars).trim();
}

function dedupeEvidence(evidence: EvidenceAnchor[], maxItems: number): EvidenceAnchor[] {
  const out: EvidenceAnchor[] = [];
  const seen = new Set<string>();

  for (const anchor of evidence) {
    const snippet = normalizeWhitespace(String(anchor.snippet ?? "")).slice(0, MAX_SNIPPET_CHARS);
    if (!snippet) continue;

    const signature = snippet.toLowerCase();
    if (seen.has(signature)) continue;
    seen.add(signature);

    out.push({
      snippet,
      char_start: typeof anchor.char_start === "number" ? anchor.char_start : undefined,
      char_end: typeof anchor.char_end === "number" ? anchor.char_end : undefined,
      segment_id: typeof anchor.segment_id === "string" ? anchor.segment_id : undefined,
    });

    if (out.length >= maxItems) break;
  }

  return out;
}

function classifyState(pass1Score: number | null, pass2Score: number | null): ComparisonState {
  if (!isValidScore(pass1Score) || !isValidScore(pass2Score)) {
    return "missing_or_invalid";
  }

  const delta = Math.abs(pass1Score - pass2Score);
  if (delta <= 1) return "agree";
  if (delta <= 3) return "soft_divergence";
  return "hard_divergence";
}

function extractDisputedExcerptWindow(params: {
  state: ComparisonState;
  manuscriptText?: string;
  evidence: EvidenceAnchor[];
  excerptRadiusChars: number;
}): DisputedExcerptWindow | undefined {
  const { state, manuscriptText, evidence, excerptRadiusChars } = params;
  if (state !== "soft_divergence" && state !== "hard_divergence") return undefined;
  if (!manuscriptText) return undefined;

  const rangedAnchor = evidence.find(
    (anchor) => typeof anchor.char_start === "number" && typeof anchor.char_end === "number",
  );

  if (!rangedAnchor || rangedAnchor.char_start === undefined || rangedAnchor.char_end === undefined) {
    return undefined;
  }

  const sourceLength = manuscriptText.length;
  const start = Math.max(0, rangedAnchor.char_start - excerptRadiusChars);
  const end = Math.min(sourceLength, rangedAnchor.char_end + excerptRadiusChars);

  if (end <= start) return undefined;

  return {
    char_start: start,
    char_end: end,
    snippet: manuscriptText.slice(start, end),
  };
}

export function buildComparisonPacket(
  pass1: SinglePassOutput,
  pass2: SinglePassOutput,
  options: BuildComparisonPacketOptions = {},
): ComparisonPacket {
  const pass1ByKey = toCriterionMap(pass1);
  const pass2ByKey = toCriterionMap(pass2);

  const excerptRadiusChars = options.excerptRadiusChars ?? DEFAULT_EXCERPT_RADIUS_CHARS;
  const maxEvidencePerCriterion =
    options.maxEvidencePerCriterion ?? DEFAULT_MAX_EVIDENCE_PER_CRITERION;

  const criteria: ComparisonPacketCriterion[] = CRITERIA_KEYS.map((key) => {
    const pass1Criterion = pass1ByKey.get(key);
    const pass2Criterion = pass2ByKey.get(key);

    const pass1Score = isValidScore(pass1Criterion?.score_0_10 ?? null)
      ? pass1Criterion!.score_0_10
      : null;
    const pass2Score = isValidScore(pass2Criterion?.score_0_10 ?? null)
      ? pass2Criterion!.score_0_10
      : null;

    const state = classifyState(pass1Score, pass2Score);
    const scoreDelta =
      pass1Score !== null && pass2Score !== null ? Math.abs(pass1Score - pass2Score) : 0;

    const pass1Evidence = dedupeEvidence(pass1Criterion?.evidence ?? [], maxEvidencePerCriterion);

    const disputedExcerptWindow = extractDisputedExcerptWindow({
      state,
      manuscriptText: options.manuscriptText,
      evidence: pass1Evidence,
      excerptRadiusChars,
    });

    return {
      key,
      state,
      score_delta: scoreDelta,
      pass1_score: pass1Score,
      pass1_mechanism_summary: toFirstSentence(pass1Criterion?.rationale ?? "", MAX_SUMMARY_CHARS),
      pass1_evidence: pass1Evidence,
      pass2_score: pass2Score,
      pass2_rationale_short: toFirstSentence(pass2Criterion?.rationale ?? "", MAX_RATIONALE_SHORT_CHARS),
      disputed_excerpt_window: disputedExcerptWindow,
    };
  });

  const criteria_count_by_state: Record<ComparisonState, number> = {
    agree: 0,
    soft_divergence: 0,
    hard_divergence: 0,
    missing_or_invalid: 0,
  };

  for (const criterion of criteria) {
    criteria_count_by_state[criterion.state] += 1;
  }

  return {
    criteria,
    criteria_count_by_state,
  };
}
