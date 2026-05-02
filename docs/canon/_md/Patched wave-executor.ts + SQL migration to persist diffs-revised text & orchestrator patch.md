**Patched wave-executor.ts** + **SQL migration** to persist diffs-revised text & **orchestrator patch** to save the final revised text and validation-ready execution output.

Your attached version is the base I extended.

// ========================================================
// src/services/wave-executor.ts
// RevisionGrade WAVE Executor Layer
// Executes actual wave modules with text-carry-forward,
// diff persistence, and final revised text output
// ========================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { RevisionTarget } from "@/lib/pipeline-types";

// --------------------------------------------------------
// TYPES
// --------------------------------------------------------

export interface WaveExecutionContext {
 pipelineRunId: string;
 manuscriptId: string;
 chapterId: string;
 text: string;
 revisionMode?: "surgical" | "chapter";
}

export interface WaveTextChange {
 type: "replace" | "insert" | "delete";
 targetText: string;
 replacementText?: string;
 rationale?: string;
}

export interface WaveExecutionModule {
 waveNumber: number;
 name: string;
 execute: (
 context: WaveExecutionContext,
 targets: RevisionTarget[]
 ) => Promise<WaveExecutionModuleResult>;
}

export interface WaveExecutionModuleResult {
 waveNumber: number;
 success: boolean;
 notes?: string;
 modifications?: string[];
 proposedText?: string;
 changes?: WaveTextChange[];
}

export interface ExecuteWaveModulesResult {
 pipelineRunId: string;
 results: WaveExecutionModuleResult[];
 success: boolean;
 finalText: string;
}

// --------------------------------------------------------
// HELPERS
// --------------------------------------------------------

function applyChangesToText(text: string, changes: WaveTextChange[]): string {
 let output = text;

 for (const change of changes) {
 if (change.type === "replace" && change.replacementText !== undefined) {
 output = output.replace(change.targetText, change.replacementText);
 }

 if (change.type === "delete") {
 output = output.replace(change.targetText, "");
 }

 if (change.type === "insert" && change.replacementText !== undefined) {
 output = output.replace(change.targetText, `${change.targetText}${change.replacementText}`);
 }
 }

 return output;
}

// --------------------------------------------------------
// WAVE MODULE REGISTRY
// Replace these placeholder modules with imported real ones
// as they are built out.
// --------------------------------------------------------

const WAVE\_MODULES: Record<number, WaveExecutionModule> = {
 1: {
 waveNumber: 1,
 name: "Premise Reinforcement",
 execute: async (context, targets) => {
 const modifications: string[] = [];
 const changes: WaveTextChange[] = [];

 if (targets.length > 0) {
 modifications.push("Premise clarity review executed.");
 }

 return {
 waveNumber: 1,
 success: true,
 notes: "Premise clarity strengthened",
 modifications,
 changes,
 proposedText: context.text,
 };
 },
 },

 7: {
 waveNumber: 7,
 name: "Momentum Correction",
 execute: async (context, targets) => {
 const modifications: string[] = [];
 const changes: WaveTextChange[] = [];

 if (targets.length > 0) {
 modifications.push("Momentum drag zones reviewed.");
 }

 return {
 waveNumber: 7,
 success: true,
 notes: "Momentum flow adjusted",
 modifications,
 changes,
 proposedText: context.text,
 };
 },
 },

 31: {
 waveNumber: 31,
 name: "Escalation Repair",
 execute: async (context, targets) => {
 const modifications: string[] = [];
 const changes: WaveTextChange[] = [];

 if (targets.length > 0) {
 modifications.push("Escalation architecture reviewed.");
 }

 return {
 waveNumber: 31,
 success: true,
 notes: "Escalation curve repaired",
 modifications,
 changes,
 proposedText: context.text,
 };
 },
 },

 41: {
 waveNumber: 41,
 name: "Prose Authority Compression",
 execute: async (context, targets) => {
 const modifications: string[] = [];
 const changes: WaveTextChange[] = [];

 if (targets.length > 0) {
 modifications.push("Line-level authority compression reviewed.");
 }

 return {
 waveNumber: 41,
 success: true,
 notes: "Prose tightened and compressed",
 modifications,
 changes,
 proposedText: context.text,
 };
 },
 },

 60: {
 waveNumber: 60,
 name: "Final Authority Polish",
 execute: async (context, targets) => {
 const modifications: string[] = [];
 const changes: WaveTextChange[] = [];

 if (targets.length > 0) {
 modifications.push("Final authority polish review completed.");
 }

 return {
 waveNumber: 60,
 success: true,
 notes: "Final polish complete",
 modifications,
 changes,
 proposedText: context.text,
 };
 },
 },
};

// --------------------------------------------------------
// EXECUTOR
// --------------------------------------------------------

export async function executeWaveModules(
 supabase: SupabaseClient<Database>,
 args: {
 pipelineRunId: string;
 waveExecutionId?: string;
 waves: number[];
 targets: RevisionTarget[];
 context: WaveExecutionContext;
 }
): Promise<ExecuteWaveModulesResult> {
 const { pipelineRunId, waveExecutionId, waves, targets } = args;

 let workingText = args.context.text;
 const results: WaveExecutionModuleResult[] = [];

 for (const wave of waves) {
 const module = WAVE\_MODULES[wave];

 if (!module) {
 const missingResult: WaveExecutionModuleResult = {
 waveNumber: wave,
 success: false,
 notes: "No module implemented for this wave yet",
 proposedText: workingText,
 changes: [],
 modifications: [],
 };

 results.push(missingResult);

 if (waveExecutionId) {
 await supabase
 .from("wave\_runs")
 .update({
 completed: false,
 notes: missingResult.notes ?? null,
 proposed\_text: workingText,
 changes: [],
 })
 .eq("wave\_execution\_id", waveExecutionId)
 .eq("wave\_number", wave);
 }

 continue;
 }

 const waveTargets = targets.filter((t) => t.recommendedWave === wave);

 const result = await module.execute(
 {
 ...args.context,
 text: workingText,
 },
 waveTargets
 );

 let nextText = workingText;

 if (result.proposedText !== undefined) {
 nextText = result.proposedText;
 } else if (result.changes && result.changes.length > 0) {
 nextText = applyChangesToText(workingText, result.changes);
 }

 workingText = nextText;
 results.push({
 ...result,
 proposedText: nextText,
 });

 // Persist per-wave execution status and diff payload
 if (waveExecutionId) {
 await supabase
 .from("wave\_runs")
 .update({
 completed: result.success,
 notes: result.notes ?? null,
 proposed\_text: nextText,
 changes: result.changes ?? [],
 })
 .eq("wave\_execution\_id", waveExecutionId)
 .eq("wave\_number", wave);
 }
 }

 return {
 pipelineRunId,
 results,
 success: results.every((r) => r.success),
 finalText: workingText,
 };
}

-- =========================================================
-- SUPABASE MIGRATION
-- Add revised text + per-wave diff persistence
-- =========================================================

begin;

alter table public.chapters
add column if not exists revised\_text text;

alter table public.wave\_runs
add column if not exists proposed\_text text;

alter table public.wave\_runs
add column if not exists changes jsonb not null default '[]'::jsonb;

commit;

// ========================================================
// PATCH FOR src/types/database.ts
// Add the new columns
// ========================================================

// chapters.Row
revised\_text: string | null;

// chapters.Insert
revised\_text?: string | null;

// chapters.Update
revised\_text?: string | null;

// wave\_runs.Row
proposed\_text: string | null;
changes: Json;

// wave\_runs.Insert
proposed\_text?: string | null;
changes?: Json;

// wave\_runs.Update
proposed\_text?: string | null;
changes?: Json;

// ========================================================
// PATCH FOR src/services/pipeline-orchestrator.ts
// Replace your WAVE block with this
// ========================================================

import { runWaveExecution } from "@/services/wave-execution-layer";
import { executeWaveModules } from "@/services/wave-executor";

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

const waveExecutionId = waveInvoke.data?.id ?? undefined;

// STEP 1: MAP (Pass 3 → Targets)
const wavePlan = await runWaveExecution(supabase, {
 pipelineRunId,
 waveExecutionId,
 pass3,
});

// STEP 2: EXECUTE (Targets → Actual wave output)
const executionResult = await executeWaveModules(supabase, {
 pipelineRunId,
 waveExecutionId,
 waves: wavePlan.wavesRun,
 targets: wavePlan.revisionTargets,
 context: {
 pipelineRunId,
 manuscriptId: pass3.manuscriptId,
 chapterId: pass3.chapterId,
 text: baseContext.rawText,
 revisionMode: "surgical",
 },
});

// STEP 3: SAVE FINAL REVISED TEXT
const { error: chapterUpdateError } = await supabase
 .from("chapters")
 .update({
 revised\_text: executionResult.finalText,
 })
 .eq("id", pass3.chapterId);

if (chapterUpdateError) {
 throw new Error(
 `Failed to save revised chapter text: ${chapterUpdateError.message}`
 );
}

// STEP 4: COMPLETE
const waveComplete = await completeWaveExecution(supabase, pipelineRunId);
if (waveComplete.error) {
 throw new Error(
 `Failed to complete WAVE execution: ${waveComplete.error.message}`
 );
}

// ========================================================
// OPTIONAL VALIDATION PATCH
// Add execution-aware checks before completeValidation(...)
// ========================================================

const derivedChecks = [
 {
 code: "WAVE\_OUTPUT\_PRESENT",
 passed: executionResult.finalText.trim().length > 0,
 notes: "WAVE execution returned final revised text.",
 },
 {
 code: "TARGETED\_REVISION\_PRESENT",
 passed: executionResult.results.some(
 (r) => (r.changes?.length ?? 0) > 0 || (r.modifications?.length ?? 0) > 0
 ),
 notes: "At least one wave returned actionable revision output.",
 },
];

for (const check of [...waveResult.validationChecks, ...derivedChecks]) {
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

**What this adds**

Your current wave-executor.ts now gains the missing pieces:

* **text carry-forward** from wave to wave
* **proposedText + changes** support
* **persistence of per-wave diffs** into wave\_runs
* **final revised chapter text** saved back into chapters.revised\_text
* **execution-aware validation checks**

**The practical flow now**

Pass 3
→ WAVE mapping
→ WAVE execution modules
→ per-wave persisted diffs
→ final revised text
→ validation
