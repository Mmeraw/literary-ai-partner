**Wiring path to turn WAVE modules from notes-only into real revision producers.**

**1. Change the module contract**

Right now, each wave returns:

* success
* notes
* modifications

You want it to return:

* the **original text**
* the **proposed revised text**
* a **diff payload**
* optional **line-level revision notes**

Use this shape:

export interface WaveTextChange {
 type: "replace" | "insert" | "delete";
 targetText: string;
 replacementText?: string;
 rationale?: string;
}

export interface WaveExecutionModuleResult {
 waveNumber: number;
 success: boolean;
 notes?: string;
 proposedText?: string;
 changes?: WaveTextChange[];
 modifications?: string[];
}

That gives each wave two possible modes:

* **light mode** → returns changes
* **full mode** → returns proposedText

**2. Pass the current text into every module**

You already do this in WaveExecutionContext:

export interface WaveExecutionContext {
 pipelineRunId: string;
 manuscriptId: string;
 chapterId: string;
 text: string;
}

That is correct.

The key is this:

👉 each module should read context.text
👉 produce either changes or proposedText

Example:

export async function executeWave10(
 context: WaveExecutionContext,
 targets: RevisionTarget[]
): Promise<WaveExecutionModuleResult> {
 const original = context.text;

 const changes = [
 {
 type: "replace" as const,
 targetText: "He was angry. Furious. Enraged beyond control.",
 replacementText: "He was furious.",
 rationale: "Reduces redundant escalation and improves compression.",
 },
 ];

 let proposedText = original;
 for (const change of changes) {
 if (change.type === "replace" && change.replacementText) {
 proposedText = proposedText.replace(change.targetText, change.replacementText);
 }
 }

 return {
 waveNumber: 10,
 success: true,
 notes: "Structural redundancy reduced.",
 proposedText,
 changes,
 };
}

**3. Make the executor apply waves sequentially to evolving text**

This is the most important wiring step.

Right now, your executor sends the same context.text to every wave.
That means Wave 2 does not see what Wave 1 changed.

You want this instead:

export async function executeWaveModules(
 supabase: SupabaseClient<Database>,
 args: {
 pipelineRunId: string;
 waveExecutionId?: string;
 waves: number[];
 targets: RevisionTarget[];
 context: WaveExecutionContext;
 }
) {
 const { pipelineRunId, waveExecutionId, waves, targets } = args;

 let workingText = args.context.text;
 const results: WaveExecutionModuleResult[] = [];

 for (const wave of waves) {
 const module = WAVE\_MODULES[wave];

 if (!module) {
 results.push({
 waveNumber: wave,
 success: false,
 notes: "No module implemented for this wave yet",
 });
 continue;
 }

 const waveTargets = targets.filter(
 (target) => target.recommendedWave === wave
 );

 const result = await module.execute(
 {
 ...args.context,
 text: workingText,
 },
 waveTargets
 );

 if (result.proposedText) {
 workingText = result.proposedText;
 }

 results.push(result);

 if (waveExecutionId) {
 await supabase
 .from("wave\_runs")
 .update({
 completed: result.success,
 notes: result.notes ?? null,
 })
 .eq("wave\_execution\_id", waveExecutionId)
 .eq("wave\_number", wave);
 }
 }

 return {
 pipelineRunId,
 results,
 success: results.every((result) => result.success),
 finalText: workingText,
 };
}

That is the real execution chain.

**4. Save the revised text back to the chapter**

Once the executor returns finalText, update the chapter record.

In the orchestrator, after:

const executionResult = await executeWaveModules(...)

add:

const { error: chapterUpdateError } = await supabase
 .from("chapters")
 .update({
 normalized\_text: executionResult.finalText,
 })
 .eq("id", pass3.chapterId);

if (chapterUpdateError) {
 throw new Error(
 `Failed to save revised chapter text: ${chapterUpdateError.message}`
 );
}

If you want to preserve both original and revised, better is:

* raw\_text = uploaded/original
* normalized\_text = processing-safe version
* add revised\_text column for post-WAVE output

That is cleaner.

**5. Persist the diff payloads**

You have two good options.

**Option A — add JSON to wave\_runs**

Add columns:

alter table public.wave\_runs
add column proposed\_text text,
add column changes jsonb;

Then in executor:

await supabase
 .from("wave\_runs")
 .update({
 completed: result.success,
 notes: result.notes ?? null,
 proposed\_text: result.proposedText ?? null,
 changes: result.changes ?? null,
 })
 .eq("wave\_execution\_id", waveExecutionId)
 .eq("wave\_number", wave);

**Option B — create a separate wave\_change\_sets table**

This is better long-term if you want auditability.

Example:

create table if not exists public.wave\_change\_sets (
 id uuid primary key default gen\_random\_uuid(),
 wave\_run\_id uuid not null references public.wave\_runs(id) on delete cascade,
 original\_text text,
 proposed\_text text,
 changes jsonb not null default '[]'::jsonb,
 created\_at timestamptz not null default now()
);

This is the cleaner enterprise version.

**6. Decide who generates the revisions**

There are two wiring models.

**Model 1 — deterministic local transforms**

Good for:

* filter words
* punctuation normalization
* repetition cleanup
* spacing/formatting

Module directly edits text with code.

**Model 2 — AI-assisted wave execution**

Good for:

* premise strengthening
* pacing repair
* dialogue subtext
* tonal control

Module calls an AI prompt and returns revised text.

Example skeleton:

export async function executeWave41(
 context: WaveExecutionContext,
 targets: RevisionTarget[]
): Promise<WaveExecutionModuleResult> {
 const prompt = `
Apply Wave 41 only.
Focus on sentence rhythm and prose authority.
Do not alter meaning.
Return revised text only.

TEXT:
${context.text}
`;

 const proposedText = await callOpenAI(prompt);

 return {
 waveNumber: 41,
 success: true,
 notes: "Wave 41 applied.",
 proposedText,
 changes: [],
 };
}

Best practice is hybrid:

* rule-based where possible
* AI where necessary

**7. Add a “revision mode” flag**

Some waves should not rewrite the whole chapter unless explicitly allowed.

Add to context:

export interface WaveExecutionContext {
 pipelineRunId: string;
 manuscriptId: string;
 chapterId: string;
 text: string;
 revisionMode?: "surgical" | "chapter";
}

Then:

* surgical = targeted edits only
* chapter = full rewritten version permitted

That protects voice and prevents runaway rewriting.

**8. Wire validation to actual text change results**

Right now, validation checks are abstract.

Once waves produce real text, validation can inspect:

* Was text changed?
* Did targeted issues get touched?
* Did forbidden patterns decrease?
* Did a wave run but return no meaningful output?

Example additional checks:

{
 code: "WAVE\_OUTPUT\_PRESENT",
 passed: Boolean(executionResult.finalText && executionResult.finalText !== baseContext.rawText),
 notes: "Revised text produced by WAVE execution."
}

and

{
 code: "TARGETED\_REVISION\_PRESENT",
 passed: executionResult.results.some(r => (r.changes?.length ?? 0) > 0),
 notes: "At least one wave returned explicit change data."
}

**9. Minimal end-to-end wiring summary**

This is the shortest real path:

**In each wave module**

Return:

* proposedText
* changes

**In wave-executor.ts**

* maintain workingText
* feed updated text into next wave
* collect results
* return finalText

**In orchestrator**

* call executor
* save finalText to chapter or revised\_text
* persist per-wave diffs
* run validation against actual outputs

**10. The exact patch points**

**A. Update result type**

In wave-executor.ts:

export interface WaveTextChange {
 type: "replace" | "insert" | "delete";
 targetText: string;
 replacementText?: string;
 rationale?: string;
}

export interface WaveExecutionModuleResult {
 waveNumber: number;
 success: boolean;
 notes?: string;
 proposedText?: string;
 changes?: WaveTextChange[];
 modifications?: string[];
}

**B. Update executor**

Track workingText and return finalText.

**C. Update orchestrator**

After execution:

const executionResult = await executeWaveModules(...);

await supabase
 .from("chapters")
 .update({
 normalized\_text: executionResult.finalText,
 })
 .eq("id", pass3.chapterId);

**D. Update schema**

Either add fields to wave\_runs or create wave\_change\_sets.

**My recommendation**

Best architecture:

* add revised\_text to chapters
* add changes jsonb and proposed\_text text to wave\_runs
* keep wave modules **surgical by default**
* let only specific late waves run in **chapter rewrite mode**

That gives you control, auditability, and safety.

Top of Form

Bottom of Form
