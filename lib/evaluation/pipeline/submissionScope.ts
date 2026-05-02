import {
  type ConfidenceCap,
  type InputScale,
  computeScorableCount,
} from "@/lib/evaluation/signal/scopePolicy";

export type { InputScale, ConfidenceCap } from "@/lib/evaluation/signal/scopePolicy";

export interface SubmissionScopeProfile {
  inputScale: InputScale;
  wordCount: number;
  chunkCount: number;
  scorableCount: number;
  confidenceCapSummary: ConfidenceCap;
  scopePolicyVersion: string;
}

export function countWords(text: string): number {
  const normalized = text.trim();
  return normalized.length === 0 ? 0 : normalized.split(/\s+/).length;
}

export function classifySubmissionScope(
  text: string,
  chunkCount: number,
): SubmissionScopeProfile {
  const wordCount = countWords(text);

  if (wordCount < 200) {
    throw new Error("SUBMISSION_TOO_SHORT_FOR_EVALUATION");
  }

  let inputScale: InputScale;
  if (wordCount <= 749) {
    inputScale = "micro_excerpt";
  } else if (wordCount <= 1999) {
    inputScale = "light_chapter";
  } else if (wordCount <= 5999) {
    inputScale = "standard_chapter";
  } else if (wordCount <= 24999) {
    inputScale = "multi_chapter";
  } else {
    inputScale = "full_manuscript";
  }

  const confidenceCapSummary: ConfidenceCap =
    inputScale === "micro_excerpt"
      ? "LOW"
      : inputScale === "multi_chapter" || inputScale === "full_manuscript"
        ? "HIGH"
        : "MODERATE";

  const scorableCount = computeScorableCount(inputScale);

  return {
    inputScale,
    wordCount,
    chunkCount,
    scorableCount,
    confidenceCapSummary,
    scopePolicyVersion: "v1",
  };
}
