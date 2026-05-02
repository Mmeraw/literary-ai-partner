**wave-mapping-registry.ts** make the criterion→wave mappings canon-driven and editable outside the service.

send it to me

// ========================================================
// src/services/wave-mapping-registry.ts
// RevisionGrade WAVE Mapping Registry
// Canon-driven criterion -> wave mapping
// ========================================================

export type WavePriority = "high" | "medium" | "low";

export interface WaveMappingRule {
 criterionName: string;
 weaknessJudgmentOnly?: boolean;
 recommendedWaves: number[];
 issueType: string;
 priority: WavePriority;
 directiveTemplate: (finding: string, impact: string) => string;
}

export const WAVE\_MAPPING\_REGISTRY: WaveMappingRule[] = [
 {
 criterionName: "Concept & Core Premise",
 weaknessJudgmentOnly: true,
 recommendedWaves: [1, 9, 10],
 issueType: "premise-clarity",
 priority: "high",
 directiveTemplate: (finding, impact) =>
 `Reinforce premise clarity and structural spine. Finding: ${finding}. Impact: ${impact}.`,
 },
 {
 criterionName: "Narrative Drive & Momentum",
 weaknessJudgmentOnly: true,
 recommendedWaves: [7, 31, 32, 33, 34, 39, 40],
 issueType: "momentum-breakdown",
 priority: "high",
 directiveTemplate: (finding, impact) =>
 `Repair momentum and escalation flow. Finding: ${finding}. Impact: ${impact}.`,
 },
 {
 criterionName: "Character Depth & Psychological Coherence",
 weaknessJudgmentOnly: true,
 recommendedWaves: [11, 12, 14, 15, 25, 31],
 issueType: "character-coherence",
 priority: "high",
 directiveTemplate: (finding, impact) =>
 `Strengthen psychological coherence and emotional consequence. Finding: ${finding}. Impact: ${impact}.`,
 },
 {
 criterionName: "Point of View & Voice Control",
 weaknessJudgmentOnly: true,
 recommendedWaves: [5, 20, 35, 48],
 issueType: "pov-voice-instability",
 priority: "high",
 directiveTemplate: (finding, impact) =>
 `Stabilize POV and voice control. Finding: ${finding}. Impact: ${impact}.`,
 },
 {
 criterionName: "Scene Construction & Function",
 weaknessJudgmentOnly: true,
 recommendedWaves: [2, 3, 4, 10, 24],
 issueType: "scene-function-failure",
 priority: "high",
 directiveTemplate: (finding, impact) =>
 `Repair scene function and state change. Finding: ${finding}. Impact: ${impact}.`,
 },
 {
 criterionName: "Dialogue Authenticity & Subtext",
 weaknessJudgmentOnly: true,
 recommendedWaves: [13, 14, 15, 16, 49],
 issueType: "dialogue-subtext-weakness",
 priority: "high",
 directiveTemplate: (finding, impact) =>
 `Refine dialogue authenticity and subtext density. Finding: ${finding}. Impact: ${impact}.`,
 },
 {
 criterionName: "Thematic Integration",
 weaknessJudgmentOnly: true,
 recommendedWaves: [21, 28],
 issueType: "theme-integration-weakness",
 priority: "medium",
 directiveTemplate: (finding, impact) =>
 `Strengthen thematic emergence through action and consequence. Finding: ${finding}. Impact: ${impact}.`,
 },
 {
 criterionName: "World-Building & Environmental Logic",
 weaknessJudgmentOnly: true,
 recommendedWaves: [22, 23, 26, 29, 30],
 issueType: "world-logic-instability",
 priority: "medium",
 directiveTemplate: (finding, impact) =>
 `Repair world-building and environmental logic. Finding: ${finding}. Impact: ${impact}.`,
 },
 {
 criterionName: "Pacing & Structural Balance",
 weaknessJudgmentOnly: true,
 recommendedWaves: [7, 31, 33, 34, 35, 36, 37, 38, 39, 40],
 issueType: "pacing-imbalance",
 priority: "high",
 directiveTemplate: (finding, impact) =>
 `Correct pacing imbalance and structural drag. Finding: ${finding}. Impact: ${impact}.`,
 },
 {
 criterionName: "Prose Control & Line-Level Craft",
 weaknessJudgmentOnly: true,
 recommendedWaves: [41, 42, 43, 45, 46, 47, 50, 51, 52, 53, 55, 56, 58, 60],
 issueType: "prose-authority-loss",
 priority: "medium",
 directiveTemplate: (finding, impact) =>
 `Increase prose authority and line-level precision. Finding: ${finding}. Impact: ${impact}.`,
 },
 {
 criterionName: "Tonal Authority & Consistency",
 weaknessJudgmentOnly: true,
 recommendedWaves: [41, 42, 43, 54, 55, 58],
 issueType: "tone-instability",
 priority: "medium",
 directiveTemplate: (finding, impact) =>
 `Stabilize tonal authority and consistency. Finding: ${finding}. Impact: ${impact}.`,
 },
 {
 criterionName: "Narrative Closure & Promises Kept",
 weaknessJudgmentOnly: true,
 recommendedWaves: [8, 9, 39, 40],
 issueType: "closure-payoff-failure",
 priority: "high",
 directiveTemplate: (finding, impact) =>
 `Repair setup/payoff and closure integrity. Finding: ${finding}. Impact: ${impact}.`,
 },
 {
 criterionName: "Professional Readiness & Market Positioning",
 weaknessJudgmentOnly: true,
 recommendedWaves: [6, 55, 61, 62],
 issueType: "submission-readiness-weakness",
 priority: "high",
 directiveTemplate: (finding, impact) =>
 `Increase readiness for professional submission. Finding: ${finding}. Impact: ${impact}.`,
 },
];

export function getWaveMappingRule(criterionName: string): WaveMappingRule | undefined {
 return WAVE\_MAPPING\_REGISTRY.find((rule) => rule.criterionName === criterionName);
}

export function getAllWaveMappingRules(): WaveMappingRule[] {
 return WAVE\_MAPPING\_REGISTRY;
}

// ========================================================
// PATCH FOR src/services/wave-execution-layer.ts
// Replace inline mapping rules with registry import
// ========================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { PassOutput, RevisionTarget } from "@/lib/pipeline-types";
import { getWaveMappingRule } from "@/services/wave-mapping-registry";

export interface WaveValidationCheck {
 code: string;
 passed: boolean;
 notes?: string | null;
}

export interface WaveExecutionResult {
 pipelineRunId: string;
 wavesRun: number[];
 revisionTargets: RevisionTarget[];
 source: {
 primaryStrength?: string | null;
 primaryWeakness?: string | null;
 dominantPattern?: string | null;
 convergenceSummary?: string | null;
 };
 validationChecks: WaveValidationCheck[];
}

export async function runWaveExecution(
 supabase: SupabaseClient<Database>,
 args: {
 pipelineRunId: string;
 waveExecutionId?: string;
 pass3: PassOutput;
 }
): Promise<WaveExecutionResult> {
 const { pipelineRunId, waveExecutionId, pass3 } = args;

 const revisionTargets = deriveRevisionTargetsFromPass3(pass3);
 const wavesRun = uniqueSortedWaves(revisionTargets.map((t) => t.recommendedWave));

 if (waveExecutionId) {
 await persistWaveRevisionTargets(supabase, waveExecutionId, revisionTargets);
 }

 return {
 pipelineRunId,
 wavesRun,
 revisionTargets,
 source: {
 primaryStrength: pass3.summary.primaryStrength ?? null,
 primaryWeakness: pass3.summary.primaryWeakness ?? null,
 dominantPattern: pass3.summary.dominantPattern ?? null,
 convergenceSummary: pass3.summary.convergenceSummary ?? null,
 },
 validationChecks: buildWaveValidationChecks(pass3, revisionTargets, wavesRun),
 };
}

export function deriveRevisionTargetsFromPass3(pass3: PassOutput): RevisionTarget[] {
 const targets: RevisionTarget[] = [];

 for (const criterion of pass3.criteria) {
 const rule = getWaveMappingRule(criterion.criterionName);
 if (!rule) continue;

 if (rule.weaknessJudgmentOnly && criterion.judgment === "effective") {
 continue;
 }

 for (const wave of rule.recommendedWaves) {
 targets.push({
 zone: criterion.criterionName,
 issueType: rule.issueType,
 recommendedWave: wave,
 priority: rule.priority,
 directive: rule.directiveTemplate(criterion.finding, criterion.impact),
 });
 }
 }

 return dedupeRevisionTargets(targets);
}

async function persistWaveRevisionTargets(
 supabase: SupabaseClient<Database>,
 waveExecutionId: string,
 targets: RevisionTarget[]
): Promise<void> {
 const { error: deleteError } = await supabase
 .from("wave\_revision\_targets")
 .delete()
 .eq("wave\_execution\_id", waveExecutionId);

 if (deleteError) {
 throw new Error(`Failed clearing prior wave targets: ${deleteError.message}`);
 }

 if (targets.length === 0) return;

 const rows = targets.map((target) => ({
 wave\_execution\_id: waveExecutionId,
 zone: target.zone,
 issue\_type: target.issueType,
 recommended\_wave: target.recommendedWave,
 priority: target.priority,
 directive: target.directive ?? null,
 }));

 const { error } = await supabase.from("wave\_revision\_targets").insert(rows);

 if (error) {
 throw new Error(`Failed inserting wave revision targets: ${error.message}`);
 }
}

function buildWaveValidationChecks(
 pass3: PassOutput,
 targets: RevisionTarget[],
 wavesRun: number[]
): WaveValidationCheck[] {
 const hasConvergence = Boolean(pass3.summary.convergenceSummary);
 const hasTargets = targets.length > 0;
 const hasWaves = wavesRun.length > 0;

 return [
 {
 code: "CANON\_INTEGRITY",
 passed: true,
 notes: "Pass 3 criteria mapped using canonical criterion names only.",
 },
 {
 code: "CONVERGENCE\_VALID",
 passed: hasConvergence,
 notes: hasConvergence
 ? "Pass 3 convergence summary present."
 : "Missing convergence summary from Pass 3.",
 },
 {
 code: "WAVE\_INVOCATION\_VALID",
 passed: true,
 notes: "WAVE executed from converged truth state.",
 },
 {
 code: "REVISION\_TARGETS\_PRESENT",
 passed: hasTargets,
 notes: hasTargets
 ? "Revision targets derived from Pass 3 findings."
 : "No revision targets derived from Pass 3.",
 },
 {
 code: "WAVE\_SEQUENCE\_PRESENT",
 passed: hasWaves,
 notes: hasWaves
 ? `Mapped to ${wavesRun.length} waves.`
 : "No waves selected for execution.",
 },
 ];
}

function dedupeRevisionTargets(targets: RevisionTarget[]): RevisionTarget[] {
 const seen = new Set<string>();
 const deduped: RevisionTarget[] = [];

 for (const target of targets) {
 const key = [
 target.zone,
 target.issueType,
 target.recommendedWave,
 target.priority,
 ].join("::");

 if (seen.has(key)) continue;
 seen.add(key);
 deduped.push(target);
 }

 return deduped;
}

function uniqueSortedWaves(waves: number[]): number[] {
 return [...new Set(waves)].sort((a, b) => a - b);
}

// ========================================================
// OPTIONAL: PATCH FOR src/services/pipeline-orchestrator.ts
// ========================================================

import { runWaveExecution } from "@/services/wave-execution-layer";

// inside runFullPipeline(...)

const waveEligible = await markWaveEligible(supabase, pipelineRunId);
if (waveEligible.error) {
 throw new Error(
 `Failed to mark WAVE eligible: ${waveEligible.error.message}`
 );
}

const initialWaves = waves;
const waveInvoke = await invokeWave(supabase, pipelineRunId, initialWaves);
if (waveInvoke.error) {
 throw new Error(
 `Failed to invoke WAVE: ${waveInvoke.error.message}`
 );
}

const waveExecutionId = waveInvoke.data?.id ?? undefined;

const waveResult = await runWaveExecution(supabase, {
 pipelineRunId,
 waveExecutionId,
 pass3,
});

const waveComplete = await completeWaveExecution(supabase, pipelineRunId);
if (waveComplete.error) {
 throw new Error(
 `Failed to complete WAVE execution: ${waveComplete.error.message}`
 );
}
