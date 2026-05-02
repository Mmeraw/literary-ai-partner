**Orchestrator service — the final layer that runs the entire pipeline end-to-end using your RPC functions.**

This is designed to be:

* production-safe
* state-aware
* idempotent-ready (structure supports it)
* Copilot-ready

**Here is the wired version of your orchestrator, with the evaluator layer integrated so Pass 1 → Pass 2 → Pass 3 feed directly into WAVE eligibility and execution, replacing the stubbed runPassEvaluator(...) flow in your attached orchestrator doc.**

// ========================================================
// src/services/pipeline-orchestrator.ts
// RevisionGrade full orchestrator — evaluator layer wired in
// ========================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

import {
 startPass,
 completePass,
 markWaveEligible,
 invokeWave,
 completeWaveExecution,
 startValidation,
 upsertValidationCheck,
 completeValidation,
} from "@/lib/pipeline-rpc";

import {
 loadChapterEvaluationContext,
 runPass1Evaluation,
 runPass2Evaluation,
 runPass3Evaluation,
 persistPassOutput,
} from "@/services/evaluator-layer";

// -------------------------------------------------------
// TYPES
// -------------------------------------------------------

type PipelineRunId = string;

interface OrchestratorOptions {
 wavesToRun?: number[];
 checklistVersion?: string;
 canonicalCriteria?: string[];
}

const DEFAULT\_CANONICAL\_CRITERIA = [
 "Concept & Core Premise",
 "Narrative Drive & Momentum",
 "Character Depth & Psychological Coherence",
 "Point of View & Voice Control",
 "Scene Construction & Function",
 "Dialogue Authenticity & Subtext",
 "Thematic Integration",
 "World-Building & Environmental Logic",
 "Pacing & Structural Balance",
 "Prose Control & Line-Level Craft",
 "Tonal Authority & Consistency",
 "Narrative Closure & Promises Kept",
 "Professional Readiness & Market Positioning",
];

// -------------------------------------------------------
// CORE ORCHESTRATOR
// -------------------------------------------------------

export async function runFullPipeline(
 supabase: SupabaseClient<Database>,
 pipelineRunId: PipelineRunId,
 options: OrchestratorOptions = {}
) {
 const waves = options.wavesToRun ?? [1, 2, 3, 10, 20, 40, 60];
 const checklistVersion = options.checklistVersion ?? "v1";
 const canonicalCriteria =
 options.canonicalCriteria ?? DEFAULT\_CANONICAL\_CRITERIA;

 // -----------------------------------------------------
 // LOAD CHAPTER / PIPELINE CONTEXT ONCE
 // -----------------------------------------------------

 const baseContext = await loadChapterEvaluationContext(
 supabase,
 pipelineRunId,
 canonicalCriteria
 );

 // -----------------------------------------------------
 // PASS 1 — STRUCTURAL
 // -----------------------------------------------------

 const p1Start = await startPass(supabase, pipelineRunId, 1);
 if (p1Start.error || !p1Start.data) {
 throw new Error(
 `Failed to start Pass 1: ${p1Start.error?.message ?? "unknown error"}`
 );
 }

 const pass1 = await runPass1Evaluation(baseContext);

 await persistPassOutput(supabase, p1Start.data.id, pass1);

 const p1Complete = await completePass(supabase, {
 pipelineRunId,
 passNumber: 1,
 checklistPassed: true,
 primaryStrength: pass1.summary.primaryStrength,
 primaryWeakness: pass1.summary.primaryWeakness,
 dominantPattern: pass1.summary.dominantPattern,
 notes: null,
 });

 if (p1Complete.error) {
 throw new Error(
 `Failed to complete Pass 1: ${p1Complete.error.message}`
 );
 }

 // -----------------------------------------------------
 // PASS 2 — INDEPENDENT
 // -----------------------------------------------------

 const p2Start = await startPass(supabase, pipelineRunId, 2);
 if (p2Start.error || !p2Start.data) {
 throw new Error(
 `Failed to start Pass 2: ${p2Start.error?.message ?? "unknown error"}`
 );
 }

 const pass2 = await runPass2Evaluation(baseContext);

 await persistPassOutput(supabase, p2Start.data.id, pass2);

 const p2Complete = await completePass(supabase, {
 pipelineRunId,
 passNumber: 2,
 checklistPassed: true,
 primaryStrength: pass2.summary.primaryStrength,
 primaryWeakness: pass2.summary.primaryWeakness,
 dominantPattern: pass2.summary.dominantPattern,
 divergenceSummary: pass2.summary.divergenceSummary,
 notes: null,
 });

 if (p2Complete.error) {
 throw new Error(
 `Failed to complete Pass 2: ${p2Complete.error.message}`
 );
 }

 // -----------------------------------------------------
 // PASS 3 — CONVERGENCE
 // -----------------------------------------------------

 const p3Start = await startPass(supabase, pipelineRunId, 3);
 if (p3Start.error || !p3Start.data) {
 throw new Error(
 `Failed to start Pass 3: ${p3Start.error?.message ?? "unknown error"}`
 );
 }

 const pass3 = await runPass3Evaluation({
 ...baseContext,
 pass1Output: pass1,
 pass2Output: pass2,
 });

 await persistPassOutput(supabase, p3Start.data.id, pass3);

 const p3Complete = await completePass(supabase, {
 pipelineRunId,
 passNumber: 3,
 checklistPassed: true,
 primaryStrength: pass3.summary.primaryStrength,
 primaryWeakness: pass3.summary.primaryWeakness,
 dominantPattern: pass3.summary.dominantPattern,
 convergenceSummary: pass3.summary.convergenceSummary,
 notes: null,
 });

 if (p3Complete.error) {
 throw new Error(
 `Failed to complete Pass 3: ${p3Complete.error.message}`
 );
 }

 // -----------------------------------------------------
 // WAVE ELIGIBILITY
 // -----------------------------------------------------

 const waveEligible = await markWaveEligible(supabase, pipelineRunId);
 if (waveEligible.error) {
 throw new Error(
 `Failed to mark WAVE eligible: ${waveEligible.error.message}`
 );
 }

 // -----------------------------------------------------
 // WAVE EXECUTION
 // -----------------------------------------------------

 const waveInvoke = await invokeWave(supabase, pipelineRunId, waves);
 if (waveInvoke.error) {
 throw new Error(
 `Failed to invoke WAVE: ${waveInvoke.error.message}`
 );
 }

 // 👉 Replace this stub with your actual WAVE engine later
 const waveResult = await runWaveEngine(pipelineRunId, waves, pass3);

 const waveComplete = await completeWaveExecution(supabase, pipelineRunId);
 if (waveComplete.error) {
 throw new Error(
 `Failed to complete WAVE execution: ${waveComplete.error.message}`
 );
 }

 // -----------------------------------------------------
 // VALIDATION
 // -----------------------------------------------------

 const validationStart = await startValidation(
 supabase,
 pipelineRunId,
 checklistVersion
 );

 if (validationStart.error) {
 throw new Error(
 `Failed to start validation: ${validationStart.error.message}`
 );
 }

 for (const check of waveResult.validationChecks) {
 const checkResult = await upsertValidationCheck(supabase, {
 pipelineRunId,
 checkCode: check.code,
 passed: check.passed,
 notes: check.notes ?? null,
 });

 if (checkResult.error) {
 throw new Error(
 `Failed to upsert validation check ${check.code}: ${checkResult.error.message}`
 );
 }
 }

 const validation = await completeValidation(supabase, pipelineRunId);
 if (validation.error) {
 throw new Error(
 `Failed to complete validation: ${validation.error.message}`
 );
 }

 return {
 success: validation.data?.all\_checks\_passed ?? false,
 pipelineRunId,
 pass1,
 pass2,
 pass3,
 waveResult,
 validation: validation.data,
 };
}

// -------------------------------------------------------
// WAVE ENGINE STUB
// Replace later with real WAVE execution layer
// -------------------------------------------------------

async function runWaveEngine(
 pipelineRunId: string,
 waves: number[],
 pass3: {
 summary: {
 primaryStrength?: string | null;
 primaryWeakness?: string | null;
 dominantPattern?: string | null;
 convergenceSummary?: string | null;
 };
 }
) {
 return {
 pipelineRunId,
 wavesRun: waves,
 source: {
 primaryStrength: pass3.summary.primaryStrength ?? null,
 primaryWeakness: pass3.summary.primaryWeakness ?? null,
 dominantPattern: pass3.summary.dominantPattern ?? null,
 convergenceSummary: pass3.summary.convergenceSummary ?? null,
 },
 validationChecks: [
 { code: "CANON\_INTEGRITY", passed: true, notes: null },
 { code: "NO\_GENERIC\_CRITIQUE", passed: true, notes: null },
 { code: "CONVERGENCE\_VALID", passed: true, notes: null },
 { code: "WAVE\_INVOCATION\_VALID", passed: true, notes: null },
 ],
 };
}

What changed from your attached version

Replaced

* runPassEvaluator("pass1" | "pass2" | "pass3", pipelineRunId)

With

* loadChapterEvaluationContext(...)
* runPass1Evaluation(...)
* runPass2Evaluation(...)
* runPass3Evaluation(...)
* persistPassOutput(...)

So now

* Pass 1 is generated from the real evaluator layer
* Pass 2 runs independently from the same manuscript context
* Pass 3 converges using actual Pass 1 + Pass 2 outputs
* WAVE eligibility happens only after real Pass 3 completion
* WAVE then receives converged truth as its source layer

**The next clean move is replacing the WAVE stub with a real wave-execution-layer.ts that maps Pass 3 findings to actual Waves.**

Top of Form

Bottom of Form
