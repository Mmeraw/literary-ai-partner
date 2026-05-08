**wave-01-premise.ts real text changing module**

The next clean step is replacing the placeholder wave modules with **real text-changing modules** for Waves 1, 7, 31, 41, and 60 first, since those are already in your registry.

send

// ========================================================
// wave-modules/wave-01-premise.ts
// REAL TEXT-CHANGING MODULE
// ========================================================

import type { RevisionTarget } from "@/lib/pipeline-types";
import type {
 WaveExecutionContext,
 WaveExecutionModuleResult,
 WaveTextChange,
} from "@/services/wave-executor";

export async function executeWave01(
 context: WaveExecutionContext,
 targets: RevisionTarget[]
): Promise<WaveExecutionModuleResult> {
 const changes: WaveTextChange[] = [];
 const modifications: string[] = [];

 const paragraphs = context.text.split(/\n{2,}/);
 if (paragraphs.length === 0) {
 return {
 waveNumber: 1,
 success: true,
 notes: "No text available for premise reinforcement.",
 proposedText: context.text,
 changes,
 modifications,
 };
 }

 const opening = paragraphs[0];

 // Very light heuristic: if opening lacks conflict/pursuit signal, prepend premise anchor.
 const weakOpening =
 !/\b(want|need|must|search|find|escape|stop|save|kill|hide|leave|return|before|if)\b/i.test(
 opening
 );

 let proposedText = context.text;

 if (weakOpening && targets.length > 0) {
 const anchorLine =
 "The central problem was already in motion, whether the narrator admitted it or not.\n\n";

 proposedText = `${anchorLine}${context.text}`;

 changes.push({
 type: "insert",
 targetText: "",
 replacementText: anchorLine,
 rationale:
 "Adds immediate premise pressure at entry point to reinforce narrative problem visibility.",
 });

 modifications.push("Inserted premise anchor at opening.");
 }

 return {
 waveNumber: 1,
 success: true,
 notes: "Premise reinforcement applied.",
 proposedText,
 changes,
 modifications,
 };
}

// ========================================================
// wave-modules/wave-07-act-pacing.ts
// REAL TEXT-CHANGING MODULE
// ========================================================

import type { RevisionTarget } from "@/lib/pipeline-types";
import type {
 WaveExecutionContext,
 WaveExecutionModuleResult,
 WaveTextChange,
} from "@/services/wave-executor";

export async function executeWave07(
 context: WaveExecutionContext,
 targets: RevisionTarget[]
): Promise<WaveExecutionModuleResult> {
 const changes: WaveTextChange[] = [];
 const modifications: string[] = [];

 let proposedText = context.text;

 // Compress repeated hesitation beats
 const pacingPatterns = [
 /He paused,\s\*then paused again\./g,
 /She stopped,\s\*then stopped again\./g,
 /for a long moment/gi,
 ];

 for (const pattern of pacingPatterns) {
 const matches = proposedText.match(pattern);
 if (matches) {
 proposedText = proposedText.replace(pattern, "for a moment");
 changes.push({
 type: "replace",
 targetText: matches[0],
 replacementText: "for a moment",
 rationale: "Compresses draggy pacing language.",
 });
 modifications.push("Compressed pacing drag phrase.");
 }
 }

 return {
 waveNumber: 7,
 success: true,
 notes: "Act-level pacing compression applied.",
 proposedText,
 changes,
 modifications,
 };
}

// ========================================================
// wave-modules/wave-31-escalation.ts
// REAL TEXT-CHANGING MODULE
// ========================================================

import type { RevisionTarget } from "@/lib/pipeline-types";
import type {
 WaveExecutionContext,
 WaveExecutionModuleResult,
 WaveTextChange,
} from "@/services/wave-executor";

export async function executeWave31(
 context: WaveExecutionContext,
 targets: RevisionTarget[]
): Promise<WaveExecutionModuleResult> {
 const changes: WaveTextChange[] = [];
 const modifications: string[] = [];
 let proposedText = context.text;

 // Light escalation tightening
 const replacements: Array<[RegExp, string, string]> = [
 [
 /\bthings could get bad\b/gi,
 "things could turn fatal",
 "Raises vague consequence into stronger escalation language.",
 ],
 [
 /\bit might go wrong\b/gi,
 "it could collapse fast",
 "Strengthens weak threat phrasing.",
 ],
 [
 /\bhe felt nervous\b/gi,
 "pressure tightened through him",
 "Converts generic reaction into stronger escalation pressure.",
 ],
 ];

 for (const [pattern, replacement, rationale] of replacements) {
 const match = proposedText.match(pattern);
 if (match) {
 proposedText = proposedText.replace(pattern, replacement);
 changes.push({
 type: "replace",
 targetText: match[0],
 replacementText: replacement,
 rationale,
 });
 modifications.push(`Escalation phrase strengthened: "${match[0]}"`);
 }
 }

 return {
 waveNumber: 31,
 success: true,
 notes: "Escalation pressure strengthened.",
 proposedText,
 changes,
 modifications,
 };
}

// ========================================================
// wave-modules/wave-41-breath-rhythm.ts
// REAL TEXT-CHANGING MODULE
// ========================================================

import type { RevisionTarget } from "@/lib/pipeline-types";
import type {
 WaveExecutionContext,
 WaveExecutionModuleResult,
 WaveTextChange,
} from "@/services/wave-executor";

function splitOverlongSentence(text: string): { text: string; changes: WaveTextChange[] } {
 const changes: WaveTextChange[] = [];
 const sentences = text.split(/(?<=[.!?])\s+/);

 const revised = sentences.map((sentence) => {
 const wordCount = sentence.trim().split(/\s+/).length;

 if (wordCount > 35 && sentence.includes(",")) {
 const revisedSentence = sentence.replace(",", ".").replace(/\.\s+and\b/i, ". And");
 changes.push({
 type: "replace",
 targetText: sentence,
 replacementText: revisedSentence,
 rationale: "Splits overlong sentence to improve breath rhythm and authority.",
 });
 return revisedSentence;
 }

 return sentence;
 });

 return { text: revised.join(" "), changes };
}

export async function executeWave41(
 context: WaveExecutionContext,
 targets: RevisionTarget[]
): Promise<WaveExecutionModuleResult> {
 const modifications: string[] = [];
 const { text: proposedText, changes } = splitOverlongSentence(context.text);

 if (changes.length > 0) {
 modifications.push("Split overlong sentence(s) for improved breath rhythm.");
 }

 return {
 waveNumber: 41,
 success: true,
 notes: "Breath rhythm pass applied.",
 proposedText,
 changes,
 modifications,
 };
}

// ========================================================
// wave-modules/wave-60-final-authority-polish.ts
// REAL TEXT-CHANGING MODULE
// ========================================================

import type { RevisionTarget } from "@/lib/pipeline-types";
import type {
 WaveExecutionContext,
 WaveExecutionModuleResult,
 WaveTextChange,
} from "@/services/wave-executor";

const AUTHORITY\_REPLACEMENTS: Array<[RegExp, string, string]> = [
 [/\bvery\b/gi, "", "Removes weak intensifier."],
 [/\breally\b/gi, "", "Removes weak intensifier."],
 [/\bjust\b/gi, "", "Removes softening filler."],
 [/\bseemed to\b/gi, "appeared to", "Slightly tightens filter phrasing."],
 [/\bin order to\b/gi, "to", "Compresses wordy construction."],
];

export async function executeWave60(
 context: WaveExecutionContext,
 targets: RevisionTarget[]
): Promise<WaveExecutionModuleResult> {
 const changes: WaveTextChange[] = [];
 const modifications: string[] = [];
 let proposedText = context.text;

 for (const [pattern, replacement, rationale] of AUTHORITY\_REPLACEMENTS) {
 const matches = [...proposedText.matchAll(new RegExp(pattern.source, pattern.flags))];
 for (const match of matches) {
 changes.push({
 type: "replace",
 targetText: match[0],
 replacementText: replacement,
 rationale,
 });
 }
 proposedText = proposedText.replace(pattern, replacement);
 }

 // Clean excess spaces created by removal
 proposedText = proposedText
 .replace(/[ ]{2,}/g, " ")
 .replace(/\s+([,.!?;:])/g, "$1");

 if (changes.length > 0) {
 modifications.push("Applied final authority polish and compression cleanup.");
 }

 return {
 waveNumber: 60,
 success: true,
 notes: "Final authority polish applied.",
 proposedText,
 changes,
 modifications,
 };
}

// ========================================================
// PATCH FOR src/services/wave-executor.ts
// Wire in the real modules
// ========================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { RevisionTarget } from "@/lib/pipeline-types";

import { executeWave01 } from "@/wave-modules/wave-01-premise";
import { executeWave07 } from "@/wave-modules/wave-07-act-pacing";
import { executeWave31 } from "@/wave-modules/wave-31-escalation";
import { executeWave41 } from "@/wave-modules/wave-41-breath-rhythm";
import { executeWave60 } from "@/wave-modules/wave-60-final-authority-polish";

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

const WAVE\_MODULES: Record<number, WaveExecutionModule> = {
 1: {
 waveNumber: 1,
 name: "Narrative Architecture Audit",
 execute: executeWave01,
 },
 7: {
 waveNumber: 7,
 name: "Act-Level Pacing Diagnosis",
 execute: executeWave07,
 },
 31: {
 waveNumber: 31,
 name: "Scene-to-Scene Momentum",
 execute: executeWave31,
 },
 41: {
 waveNumber: 41,
 name: "Breath Mechanics: Sentence-Length Variation",
 execute: executeWave41,
 },
 60: {
 waveNumber: 60,
 name: "Repetition as Motif vs. Error / Final Polish",
 execute: executeWave60,
 },
};

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

 const persistedResult: WaveExecutionModuleResult = {
 ...result,
 proposedText: nextText,
 };

 results.push(persistedResult);

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

// ========================================================
// OPTIONAL: quick import patch for orchestrator if needed
// ========================================================

import { runWaveExecution } from "@/services/wave-execution-layer";
import { executeWaveModules } from "@/services/wave-executor";

// after Pass 3...
const wavePlan = await runWaveExecution(supabase, {
 pipelineRunId,
 waveExecutionId,
 pass3,
});

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

These five are the first real text-changing wave modules:

* **Wave 1**
* **Wave 7**
* **Wave 31**
* **Wave 41**
* **Wave 60**
