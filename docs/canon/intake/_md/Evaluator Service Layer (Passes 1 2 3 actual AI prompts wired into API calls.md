**Evaluator Service Layer (Passes 1 2 3 actual AI prompts wired into API calls**

// ========================================================
// src/services/evaluator-layer.ts
// RevisionGrade Evaluator Service Layer
// Pass 1 / Pass 2 / Pass 3 prompt wiring
// ========================================================

import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type {
 CriterionResult,
 PassOutput,
} from "@/lib/pipeline-types";

// --------------------------------------------------------
// CONFIG
// --------------------------------------------------------

const openai = new OpenAI({
 apiKey: process.env.OPENAI\_API\_KEY,
});

const MODEL = process.env.REVISIONGRADE\_MODEL ?? "gpt-5";

// --------------------------------------------------------
// TYPES
// --------------------------------------------------------

export type EvaluatorPassType = "pass1" | "pass2" | "pass3";

export interface ChapterEvaluationContext {
 pipelineRunId: string;
 manuscriptId: string;
 chapterId: string;
 chapterTitle?: string | null;
 rawText: string;
 canonicalCriteria: string[];
 pass1Output?: PassOutput | null;
 pass2Output?: PassOutput | null;
}

interface EvaluatorResponseShape {
 summary: {
 primaryStrength?: string;
 primaryWeakness?: string;
 dominantPattern?: string;
 divergenceSummary?: string;
 convergenceSummary?: string;
 };
 criteria: Array<{
 criterionName: string;
 finding: string;
 evidence: string[];
 impact: string;
 judgment: "effective" | "ineffective" | "mixed";
 divergenceStatus?: "confirms" | "challenges" | "expands";
 agreementStatus?: "agreement" | "partial\_agreement" | "disagreement";
 resolutionLogic?: string;
 pass1Summary?: string;
 pass2Summary?: string;
 conflictDescription?: string;
 }>;
}

// --------------------------------------------------------
// PUBLIC ENTRYPOINTS
// --------------------------------------------------------

export async function runPass1Evaluation(
 context: ChapterEvaluationContext
): Promise<PassOutput> {
 const prompt = buildPass1Prompt(context);
 const parsed = await runStructuredEvaluator(prompt);
 return mapToPassOutput("pass1", context, parsed);
}

export async function runPass2Evaluation(
 context: ChapterEvaluationContext
): Promise<PassOutput> {
 const prompt = buildPass2Prompt(context);
 const parsed = await runStructuredEvaluator(prompt);
 return mapToPassOutput("pass2", context, parsed);
}

export async function runPass3Evaluation(
 context: ChapterEvaluationContext
): Promise<PassOutput> {
 if (!context.pass1Output || !context.pass2Output) {
 throw new Error("Pass 3 requires both Pass 1 and Pass 2 outputs.");
 }

 const prompt = buildPass3Prompt(context);
 const parsed = await runStructuredEvaluator(prompt);
 return mapToPassOutput("pass3", context, parsed);
}

// --------------------------------------------------------
// OPTIONAL: LOAD CONTEXT DIRECTLY FROM SUPABASE
// --------------------------------------------------------

export async function loadChapterEvaluationContext(
 supabase: SupabaseClient<Database>,
 pipelineRunId: string,
 canonicalCriteria: string[]
): Promise<ChapterEvaluationContext> {
 const { data: run, error: runError } = await supabase
 .from("pipeline\_runs")
 .select("id, manuscript\_id, chapter\_id")
 .eq("id", pipelineRunId)
 .single();

 if (runError || !run) {
 throw new Error(`Failed to load pipeline run: ${runError?.message ?? "not found"}`);
 }

 const { data: chapter, error: chapterError } = await supabase
 .from("chapters")
 .select("id, title, raw\_text")
 .eq("id", run.chapter\_id)
 .single();

 if (chapterError || !chapter) {
 throw new Error(`Failed to load chapter: ${chapterError?.message ?? "not found"}`);
 }

 return {
 pipelineRunId,
 manuscriptId: run.manuscript\_id,
 chapterId: run.chapter\_id,
 chapterTitle: chapter.title,
 rawText: chapter.raw\_text ?? "",
 canonicalCriteria,
 };
}

// --------------------------------------------------------
// OPTIONAL: SAVE PASS OUTPUT INTO DB
// Assumes pass\_run already exists.
// --------------------------------------------------------

export async function persistPassOutput(
 supabase: SupabaseClient<Database>,
 passRunId: string,
 output: PassOutput
): Promise<void> {
 for (const criterion of output.criteria) {
 const { data: inserted, error } = await supabase
 .from("pass\_criterion\_results")
 .insert({
 pass\_run\_id: passRunId,
 criterion\_name: criterion.criterionName,
 finding: criterion.finding,
 impact: criterion.impact,
 judgment: criterion.judgment,
 divergence\_status: criterion.divergenceStatus ?? null,
 agreement\_status: criterion.agreementStatus ?? null,
 resolution\_logic: criterion.resolutionLogic ?? null,
 pass1\_summary: criterion.pass1Summary ?? null,
 pass2\_summary: criterion.pass2Summary ?? null,
 conflict\_description: criterion.conflictDescription ?? null,
 })
 .select("id")
 .single();

 if (error || !inserted) {
 throw new Error(`Failed to insert criterion result: ${error?.message ?? "unknown error"}`);
 }

 let evidenceOrder = 1;
 for (const evidenceText of criterion.evidence) {
 const { error: evidenceError } = await supabase
 .from("pass\_criterion\_evidence")
 .insert({
 criterion\_result\_id: inserted.id,
 evidence\_text: evidenceText,
 evidence\_order: evidenceOrder++,
 });

 if (evidenceError) {
 throw new Error(`Failed to insert criterion evidence: ${evidenceError.message}`);
 }
 }
 }
}

// --------------------------------------------------------
// OPENAI CALL
// --------------------------------------------------------

async function runStructuredEvaluator(
 prompt: string
): Promise<EvaluatorResponseShape> {
 const response = await openai.responses.create({
 model: MODEL,
 input: prompt,
 text: {
 format: {
 type: "json\_schema",
 name: "revisiongrade\_pass\_output",
 strict: true,
 schema: {
 type: "object",
 additionalProperties: false,
 required: ["summary", "criteria"],
 properties: {
 summary: {
 type: "object",
 additionalProperties: false,
 properties: {
 primaryStrength: { type: "string" },
 primaryWeakness: { type: "string" },
 dominantPattern: { type: "string" },
 divergenceSummary: { type: "string" },
 convergenceSummary: { type: "string" },
 },
 required: ["primaryStrength", "primaryWeakness", "dominantPattern"],
 },
 criteria: {
 type: "array",
 items: {
 type: "object",
 additionalProperties: false,
 required: [
 "criterionName",
 "finding",
 "evidence",
 "impact",
 "judgment",
 ],
 properties: {
 criterionName: { type: "string" },
 finding: { type: "string" },
 evidence: {
 type: "array",
 items: { type: "string" },
 },
 impact: { type: "string" },
 judgment: {
 type: "string",
 enum: ["effective", "ineffective", "mixed"],
 },
 divergenceStatus: {
 type: "string",
 enum: ["confirms", "challenges", "expands"],
 },
 agreementStatus: {
 type: "string",
 enum: ["agreement", "partial\_agreement", "disagreement"],
 },
 resolutionLogic: { type: "string" },
 pass1Summary: { type: "string" },
 pass2Summary: { type: "string" },
 conflictDescription: { type: "string" },
 },
 },
 },
 },
 },
 },
 },
 });

 const outputText = response.output\_text;
 if (!outputText) {
 throw new Error("Evaluator returned no output.");
 }

 return JSON.parse(outputText) as EvaluatorResponseShape;
}

// --------------------------------------------------------
// PROMPTS
// --------------------------------------------------------

function buildSharedHeader(context: ChapterEvaluationContext): string {
 return [
 "You are operating inside the RevisionGrade governed evaluation system.",
 "Use only the provided canonical criteria names exactly as written.",
 "Do not invent criteria. Do not rename criteria. Do not merge criteria.",
 "All major claims must be evidence-backed.",
 "Generic critique is forbidden.",
 "",
 `MANUSCRIPT ID: ${context.manuscriptId}`,
 `CHAPTER ID: ${context.chapterId}`,
 `CHAPTER TITLE: ${context.chapterTitle ?? "Untitled"}`,
 "",
 "CANONICAL CRITERIA:",
 ...context.canonicalCriteria.map((c, i) => `${i + 1}. ${c}`),
 "",
 "MANUSCRIPT CHAPTER TEXT:",
 context.rawText,
 "",
 ].join("\n");
}

function buildPass1Prompt(context: ChapterEvaluationContext): string {
 return [
 buildSharedHeader(context),
 "PASS TYPE: PASS 1 — STRUCTURAL EVALUATION",
 "",
 "ROLE:",
 "You are a Pass 1 Structural Evaluator.",
 "Analyze structure, not style preference.",
 "Remain within structural authority only.",
 "",
 "REQUIRED BEHAVIOR:",
 "- Evaluate using canonical criteria only.",
 "- Produce evidence-backed findings only.",
 "- Avoid vague statements.",
 "- Reduce scope to only what can be proven.",
 "",
 "LESSONS LEARNED RULES:",
 "- Blur, Not Multiplicity: no 'too many ideas' claim without boundary blur evidence.",
 "- Authority Transfer Clarity: define what changed and why it matters structurally.",
 "- No Contradictory Framing: do not call the same thing a strength and weakness without context.",
 "- Canon Terminology Discipline: canonical terms only.",
 "- No Generic Critique: vague statements forbidden.",
 "",
 "OUTPUT:",
 "Return a JSON object matching the required schema.",
 "For each criterion include finding, evidence, impact, and judgment.",
 "Include a structural summary with primaryStrength, primaryWeakness, dominantPattern.",
 ].join("\n");
}

function buildPass2Prompt(context: ChapterEvaluationContext): string {
 return [
 buildSharedHeader(context),
 "PASS TYPE: PASS 2 — INDEPENDENT EVALUATION",
 "",
 "ROLE:",
 "You are a Pass 2 Independent Evaluator.",
 "You must evaluate independently and test for divergence.",
 "",
 "CRITICAL INDEPENDENCE RULE:",
 "Evaluate this manuscript as if Pass 1 does not exist.",
 "Do not mirror anticipated conclusions.",
 "You are not required to disagree, but you are required to test for disagreement.",
 "",
 "REQUIRED BEHAVIOR:",
 "- Use canonical criteria only.",
 "- Produce independent reasoning.",
 "- Assign divergenceStatus for every criterion: confirms, challenges, or expands.",
 "- Include divergenceSummary in the summary block.",
 "",
 "LESSONS LEARNED RULES:",
 "- Blur, Not Multiplicity.",
 "- Authority Transfer Clarity.",
 "- No Contradictory Framing.",
 "- Canon Terminology Discipline.",
 "- No Generic Critique.",
 "",
 "OUTPUT:",
 "Return a JSON object matching the required schema.",
 "Each criterion must include divergenceStatus.",
 ].join("\n");
}

function buildPass3Prompt(context: ChapterEvaluationContext): string {
 return [
 buildSharedHeader(context),
 "PASS TYPE: PASS 3 — CONVERGENCE",
 "",
 "ROLE:",
 "You are a Pass 3 Convergence Evaluator.",
 "You do not generate fresh evaluation from scratch.",
 "You compare Pass 1 and Pass 2, identify agreement and disagreement, and resolve conflicts.",
 "",
 "PASS 1 OUTPUT:",
 JSON.stringify(context.pass1Output, null, 2),
 "",
 "PASS 2 OUTPUT:",
 JSON.stringify(context.pass2Output, null, 2),
 "",
 "CRITICAL CONVERGENCE RULES:",
 "- Explicitly identify agreement.",
 "- Explicitly identify disagreement.",
 "- No silent overwriting of either pass.",
 "- No unjustified averaging.",
 "- Resolve only through structural logic and evidence.",
 "",
 "REQUIRED BEHAVIOR:",
 "- For each criterion include agreementStatus.",
 "- Where disagreement exists, include conflictDescription and resolutionLogic.",
 "- Include convergenceSummary in the summary block.",
 "",
 "LESSONS LEARNED RULES:",
 "- Blur, Not Multiplicity.",
 "- Authority Transfer Clarity.",
 "- No Contradictory Framing.",
 "- Canon Terminology Discipline.",
 "- No Generic Critique.",
 "",
 "OUTPUT:",
 "Return a JSON object matching the required schema.",
 ].join("\n");
}

// --------------------------------------------------------
// MAPPER
// --------------------------------------------------------

function mapToPassOutput(
 passType: EvaluatorPassType,
 context: ChapterEvaluationContext,
 parsed: EvaluatorResponseShape
): PassOutput {
 const criteria: CriterionResult[] = parsed.criteria.map((item) => ({
 criterionName: item.criterionName,
 finding: item.finding,
 evidence: item.evidence,
 impact: item.impact,
 judgment: item.judgment,
 divergenceStatus: item.divergenceStatus,
 agreementStatus: item.agreementStatus,
 resolutionLogic: item.resolutionLogic,
 pass1Summary: item.pass1Summary,
 pass2Summary: item.pass2Summary,
 conflictDescription: item.conflictDescription,
 }));

 return {
 passType,
 manuscriptId: context.manuscriptId,
 chapterId: context.chapterId,
 criteria,
 summary: {
 primaryStrength: parsed.summary.primaryStrength ?? null,
 primaryWeakness: parsed.summary.primaryWeakness ?? null,
 dominantPattern: parsed.summary.dominantPattern ?? null,
 divergenceSummary: parsed.summary.divergenceSummary ?? null,
 convergenceSummary: parsed.summary.convergenceSummary ?? null,
 },
 completedAt: new Date().toISOString(),
 };
}

// ========================================================
// src/services/pipeline-runner.ts
// Example orchestration using the evaluator layer
// ========================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
 runPass1Evaluation,
 runPass2Evaluation,
 runPass3Evaluation,
 loadChapterEvaluationContext,
 persistPassOutput,
} from "@/services/evaluator-layer";
import {
 startPass,
 completePass,
} from "@/lib/pipeline-rpc";

const CANONICAL\_CRITERIA = [
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

export async function executeEvaluationPasses(
 supabase: SupabaseClient<Database>,
 pipelineRunId: string
) {
 const baseContext = await loadChapterEvaluationContext(
 supabase,
 pipelineRunId,
 CANONICAL\_CRITERIA
 );

 // PASS 1
 const p1Start = await startPass(supabase, pipelineRunId, 1);
 if (p1Start.error) throw p1Start.error;

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
 if (p1Complete.error) throw p1Complete.error;

 // PASS 2
 const p2Start = await startPass(supabase, pipelineRunId, 2);
 if (p2Start.error) throw p2Start.error;

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
 if (p2Complete.error) throw p2Complete.error;

 // PASS 3
 const p3Start = await startPass(supabase, pipelineRunId, 3);
 if (p3Start.error) throw p3Start.error;

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
 if (p3Complete.error) throw p3Complete.error;

 return {
 pass1,
 pass2,
 pass3,
 };
}

// ========================================================
// src/lib/pipeline-rpc.ts
// Lightweight RPC helpers expected by pipeline-runner.ts
// ========================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export async function startPass(
 supabase: SupabaseClient<Database>,
 pipelineRunId: string,
 passNumber: 1 | 2 | 3
) {
 return supabase.rpc("start\_pass", {
 p\_pipeline\_run\_id: pipelineRunId,
 p\_pass\_number: passNumber,
 });
}

export async function completePass(
 supabase: SupabaseClient<Database>,
 args: {
 pipelineRunId: string;
 passNumber: 1 | 2 | 3;
 checklistPassed: boolean;
 primaryStrength?: string | null;
 primaryWeakness?: string | null;
 dominantPattern?: string | null;
 divergenceSummary?: string | null;
 convergenceSummary?: string | null;
 notes?: string | null;
 }
) {
 return supabase.rpc("complete\_pass", {
 p\_pipeline\_run\_id: args.pipelineRunId,
 p\_pass\_number: args.passNumber,
 p\_checklist\_passed: args.checklistPassed,
 p\_primary\_strength: args.primaryStrength ?? null,
 p\_primary\_weakness: args.primaryWeakness ?? null,
 p\_dominant\_pattern: args.dominantPattern ?? null,
 p\_divergence\_summary: args.divergenceSummary ?? null,
 p\_convergence\_summary: args.convergenceSummary ?? null,
 p\_notes: args.notes ?? null,
 });
}

Top of Form

Bottom of Form
