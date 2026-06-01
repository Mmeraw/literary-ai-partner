import {
  type ConfidenceCap,
  type InputScale,
  computeScorableCount,
} from "@/lib/evaluation/signal/scopePolicy";
import {
  resolveModeRouting,
  type EvaluationMode,
} from "@/lib/evaluation/modeRouting";

export type { InputScale, ConfidenceCap } from "@/lib/evaluation/signal/scopePolicy";

export type ManuscriptStructure = "standalone" | "chapters";

export interface SubmissionScopeProfile {
  inputScale: InputScale;
  wordCount: number;
  chunkCount: number;
  scorableCount: number;
  confidenceCapSummary: ConfidenceCap;
  scopePolicyVersion: string;
  manuscriptStructure?: ManuscriptStructure;
  evaluationMode: EvaluationMode;
  requiresUserFacingReviewGate: boolean;
  requiresAcceptedStoryLedger: boolean;
  storyLedgerAuthority: ReturnType<typeof resolveModeRouting>["storyLedgerAuthority"];
}

export function countWords(text: string): number {
  const normalized = text.trim();
  return normalized.length === 0 ? 0 : normalized.split(/\s+/).length;
}

export function classifySubmissionScope(
  text: string,
  chunkCount: number,
  manuscriptStructure?: ManuscriptStructure,
): SubmissionScopeProfile {
  const wordCount = countWords(text);
  const modeRouting = resolveModeRouting(wordCount);

  const msForm = manuscriptStructure ?? "chapters";

  let inputScale: InputScale;
  if (wordCount <= 999) {
    inputScale = "micro_excerpt";
  } else if (wordCount <= 3_999) {
    inputScale = "light_chapter";
  } else if (wordCount <= 7_000) {
    inputScale = "standard_chapter";
  } else if (wordCount <= 24_999) {
    inputScale = msForm === "standalone" ? "novelette" : "multi_chapter";
  } else if (wordCount <= 49_999) {
    inputScale = msForm === "standalone" ? "novella" : "multi_chapter";
  } else {
    inputScale = "full_manuscript";
  }

  const HIGH_CONFIDENCE_SCALES: ReadonlySet<InputScale> = new Set([
    "multi_chapter", "novelette", "novella", "full_manuscript",
  ]);

  const confidenceCapSummary: ConfidenceCap =
    inputScale === "micro_excerpt"
      ? "LOW"
      : HIGH_CONFIDENCE_SCALES.has(inputScale)
        ? "HIGH"
        : "MODERATE";

  const scorableCount = computeScorableCount(inputScale);

  return {
    inputScale,
    wordCount,
    chunkCount,
    scorableCount,
    confidenceCapSummary,
    scopePolicyVersion: "v3-mode-aware",
    manuscriptStructure: msForm,
    evaluationMode: modeRouting.evaluationMode,
    requiresUserFacingReviewGate: modeRouting.requiresUserFacingReviewGate,
    requiresAcceptedStoryLedger: modeRouting.requiresAcceptedStoryLedger,
    storyLedgerAuthority: modeRouting.storyLedgerAuthority,
  };
}
