import type { CriterionKey } from "@/schemas/criteria-keys";
import type { CriteriaPlanCode, CriteriaPlanMap } from "./criterionObservability";

export type InputScale =
  | "micro_excerpt"
  | "light_chapter"
  | "standard_chapter"
  | "multi_chapter"
  | "full_manuscript";

export type ConfidenceCap = "LOW" | "MODERATE" | "HIGH";

export interface ScopePolicyResult {
  plan: CriteriaPlanCode;
  confidenceCap: ConfidenceCap;
}

export const SCOPE_POLICY_VERSION = "v1";

const SCOPE_POLICY: Record<InputScale, Record<CriterionKey, ScopePolicyResult>> = {
  micro_excerpt: {
    concept: { plan: "R", confidenceCap: "MODERATE" },
    narrativeDrive: { plan: "O", confidenceCap: "LOW" },
    character: { plan: "O", confidenceCap: "LOW" },
    voice: { plan: "R", confidenceCap: "MODERATE" },
    sceneConstruction: { plan: "O", confidenceCap: "LOW" },
    dialogue: { plan: "O", confidenceCap: "LOW" },
    theme: { plan: "O", confidenceCap: "LOW" },
    worldbuilding: { plan: "O", confidenceCap: "LOW" },
    pacing: { plan: "C", confidenceCap: "LOW" },
    proseControl: { plan: "R", confidenceCap: "MODERATE" },
    tone: { plan: "R", confidenceCap: "MODERATE" },
    narrativeClosure: { plan: "NA", confidenceCap: "LOW" },
    marketability: { plan: "NA", confidenceCap: "LOW" },
  },
  light_chapter: {
    concept: { plan: "R", confidenceCap: "MODERATE" },
    narrativeDrive: { plan: "R", confidenceCap: "MODERATE" },
    character: { plan: "R", confidenceCap: "MODERATE" },
    voice: { plan: "R", confidenceCap: "MODERATE" },
    sceneConstruction: { plan: "R", confidenceCap: "MODERATE" },
    dialogue: { plan: "R", confidenceCap: "MODERATE" },
    theme: { plan: "R", confidenceCap: "MODERATE" },
    worldbuilding: { plan: "R", confidenceCap: "MODERATE" },
    pacing: { plan: "R", confidenceCap: "MODERATE" },
    proseControl: { plan: "R", confidenceCap: "MODERATE" },
    tone: { plan: "R", confidenceCap: "MODERATE" },
    narrativeClosure: { plan: "O", confidenceCap: "LOW" },
    marketability: { plan: "O", confidenceCap: "LOW" },
  },
  standard_chapter: {
    concept: { plan: "R", confidenceCap: "MODERATE" },
    narrativeDrive: { plan: "R", confidenceCap: "MODERATE" },
    character: { plan: "R", confidenceCap: "MODERATE" },
    voice: { plan: "R", confidenceCap: "MODERATE" },
    sceneConstruction: { plan: "R", confidenceCap: "MODERATE" },
    dialogue: { plan: "R", confidenceCap: "MODERATE" },
    theme: { plan: "R", confidenceCap: "MODERATE" },
    worldbuilding: { plan: "R", confidenceCap: "MODERATE" },
    pacing: { plan: "R", confidenceCap: "MODERATE" },
    proseControl: { plan: "R", confidenceCap: "MODERATE" },
    tone: { plan: "R", confidenceCap: "MODERATE" },
    narrativeClosure: { plan: "O", confidenceCap: "MODERATE" },
    marketability: { plan: "O", confidenceCap: "MODERATE" },
  },
  multi_chapter: {
    concept: { plan: "R", confidenceCap: "HIGH" },
    narrativeDrive: { plan: "R", confidenceCap: "HIGH" },
    character: { plan: "R", confidenceCap: "HIGH" },
    voice: { plan: "R", confidenceCap: "HIGH" },
    sceneConstruction: { plan: "R", confidenceCap: "HIGH" },
    dialogue: { plan: "R", confidenceCap: "HIGH" },
    theme: { plan: "R", confidenceCap: "HIGH" },
    worldbuilding: { plan: "R", confidenceCap: "HIGH" },
    pacing: { plan: "R", confidenceCap: "HIGH" },
    proseControl: { plan: "R", confidenceCap: "HIGH" },
    tone: { plan: "R", confidenceCap: "HIGH" },
    narrativeClosure: { plan: "R", confidenceCap: "MODERATE" },
    marketability: { plan: "R", confidenceCap: "MODERATE" },
  },
  full_manuscript: {
    concept: { plan: "R", confidenceCap: "HIGH" },
    narrativeDrive: { plan: "R", confidenceCap: "HIGH" },
    character: { plan: "R", confidenceCap: "HIGH" },
    voice: { plan: "R", confidenceCap: "HIGH" },
    sceneConstruction: { plan: "R", confidenceCap: "HIGH" },
    dialogue: { plan: "R", confidenceCap: "HIGH" },
    theme: { plan: "R", confidenceCap: "HIGH" },
    worldbuilding: { plan: "R", confidenceCap: "HIGH" },
    pacing: { plan: "R", confidenceCap: "HIGH" },
    proseControl: { plan: "R", confidenceCap: "HIGH" },
    tone: { plan: "R", confidenceCap: "HIGH" },
    narrativeClosure: { plan: "R", confidenceCap: "HIGH" },
    marketability: { plan: "R", confidenceCap: "HIGH" },
  },
};

export function scopePolicy(
  inputScale: InputScale,
  criterionKey: CriterionKey,
): ScopePolicyResult {
  const scalePolicy = SCOPE_POLICY[inputScale];
  if (!scalePolicy) {
    throw new Error(`SCOPE_POLICY_MISSING_SCALE:${inputScale}`);
  }

  const result = scalePolicy[criterionKey];
  if (!result) {
    throw new Error(`SCOPE_POLICY_MISSING_CRITERION:${criterionKey}`);
  }

  return result;
}

export function buildCriteriaPlanForScale(inputScale: InputScale): CriteriaPlanMap {
  const scalePolicy = SCOPE_POLICY[inputScale];
  if (!scalePolicy) {
    throw new Error(`SCOPE_POLICY_MISSING_SCALE:${inputScale}`);
  }

  return Object.fromEntries(
    Object.entries(scalePolicy).map(([criterionKey, result]) => [criterionKey, result.plan]),
  ) as CriteriaPlanMap;
}

// SOURCE OF TRUTH: Do not recompute scorable count outside this function.
export function computeScorableCount(inputScale: InputScale): number {
  const scalePolicy = SCOPE_POLICY[inputScale];
  if (!scalePolicy) {
    throw new Error(`SCOPE_POLICY_MISSING_SCALE:${inputScale}`);
  }

  return Object.values(scalePolicy).filter((result) => result.plan !== "NA").length;
}

export function summarizeCriteriaPlan(criteriaPlan: CriteriaPlanMap): {
  R: string[];
  O: string[];
  NA: string[];
  C: string[];
} {
  const summary = {
    R: [] as string[],
    O: [] as string[],
    NA: [] as string[],
    C: [] as string[],
  };

  for (const [criterionKey, plan] of Object.entries(criteriaPlan)) {
    if (!plan) continue;
    summary[plan].push(criterionKey);
  }

  return summary;
}

export function confidenceCapToMaxScore(cap: ConfidenceCap): number {
  switch (cap) {
    case "LOW":
      return 45;
    case "MODERATE":
      return 75;
    case "HIGH":
    default:
      return 95;
  }
}
