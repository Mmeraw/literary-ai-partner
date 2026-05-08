This is the **pacing spine cluster** — the block that turns a chapter from “technically working” into something that **pulls, tightens, surges, withholds, and lands**.

**WAVE 33–40 BLOCK**

**Escalation + Pacing Spine**

These waves should not be treated as eight unrelated features.
They are a **coordinated control system**.

Together, they answer:

* Is the chapter moving?
* Is it tightening at the right rate?
* Is pressure increasing, not merely continuing?
* Are quieter beats serving propulsion instead of stalling it?
* Is the ending earned?

**CORE DOCTRINE**

A chapter should feel like:

1. **Entry pressure**
2. **Progressive tightening**
3. **Complication**
4. **Acceleration**
5. **Compression near the end**
6. **Landing with consequence**

So this block governs the **shape of motion** across the chapter.

**RECOMMENDED WAVE MAP**

**Wave 33 — Escalation Curve Integrity**

Checks whether stakes, urgency, danger, or emotional consequence are actually rising.

**Wave 34 — Scene Length Rhythm**

Prevents too many scenes from feeling equally long, equally weighted, or equally paced.

**Wave 35 — POV Drift Across Scenes**

Large-scale POV stability and perceptual consistency across the chapter.

**Wave 36 — Quiet Scene Functionality**

Ensures slower scenes still carry pressure, decision-making, dread, or revelation.

**Wave 37 — Transition Velocity**

Checks whether scene-to-scene transitions preserve momentum instead of draining it.

**Wave 38 — Mid-Chapter Sag Detection**

Finds the flattening zone where chapters often lose force.

**Wave 39 — End-Loading Compression**

Ensures the back third tightens rather than relaxes.

**Wave 40 — Landing Force**

Checks whether the ending creates consequence, propulsion, dread, revelation, or emotional residue.

**SYSTEM TYPES**

type PacingSeverity = "low" | "medium" | "high";

type PacingIssueType =
 | "flat\_escalation"
 | "rhythm\_monotony"
 | "pov\_drift"
 | "quiet\_scene\_stall"
 | "slow\_transition"
 | "mid\_chapter\_sag"
 | "weak\_end\_loading"
 | "soft\_landing";

type PacingIssue = {
 wave: 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40;
 type: PacingIssueType;
 sceneIndex?: number;
 message: string;
 severity: PacingSeverity;
};

type PacingSuggestion = {
 wave: 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40;
 sceneIndex?: number;
 action:
 | "escalate"
 | "compress"
 | "trim"
 | "carry\_pressure"
 | "tighten\_transition"
 | "restore\_pov"
 | "add\_consequence"
 | "strengthen\_landing";
 note: string;
};

type Wave33to40Result = {
 issues: PacingIssue[];
 suggestions: PacingSuggestion[];
 metrics: {
 escalationScore: number;
 rhythmVariance: number;
 transitionVelocity: number;
 endCompressionScore: number;
 landingForceScore: number;
 };
};

**CHAPTER MODEL INPUT**

This cluster works best if each scene carries a normalized structural profile.

type ScenePacingProfile = {
 index: number;
 wordCount: number;
 pressureIn: number; // 0–100
 pressureOut: number; // 0–100
 escalationDelta: number; // -100 to +100
 hasDecision: boolean;
 hasRevelation: boolean;
 hasConflict: boolean;
 hasConsequence: boolean;
 transitionSoftness: number; // 0–100, higher = softer/slower
 quietScene: boolean;
 endingStrength: number; // 0–100
 povAnchor: string;
};

**MASTER EXECUTOR**

export function runWave33to40(
 scenes: ScenePacingProfile[],
 context: WaveContext
): Wave33to40Result {
 const issues: PacingIssue[] = [];
 const suggestions: PacingSuggestion[] = [];

 const escalation = runWave33(scenes, issues, suggestions);
 const rhythm = runWave34(scenes, issues, suggestions);
 runWave35(scenes, issues, suggestions);
 runWave36(scenes, issues, suggestions);
 const velocity = runWave37(scenes, issues, suggestions);
 runWave38(scenes, issues, suggestions);
 const endCompression = runWave39(scenes, issues, suggestions);
 const landing = runWave40(scenes, issues, suggestions);

 return {
 issues,
 suggestions,
 metrics: {
 escalationScore: escalation,
 rhythmVariance: rhythm,
 transitionVelocity: velocity,
 endCompressionScore: endCompression,
 landingForceScore: landing
 }
 };
}

**WAVE 33 — ESCALATION CURVE INTEGRITY**

This detects whether the chapter is genuinely climbing.

**Detect:**

* same pressure level repeated too long
* no meaningful rise in cost, danger, or instability
* scenes that feel busy but not escalatory

function runWave33(
 scenes: ScenePacingProfile[],
 issues: PacingIssue[],
 suggestions: PacingSuggestion[]
): number {
 let escalationHits = 0;

 for (let i = 1; i < scenes.length; i++) {
 const prev = scenes[i - 1];
 const curr = scenes[i];

 if (curr.pressureOut > prev.pressureOut || curr.escalationDelta > 0) {
 escalationHits++;
 }

 if (
 curr.pressureOut <= prev.pressureOut &&
 !curr.hasRevelation &&
 !curr.hasConsequence &&
 !curr.hasDecision
 ) {
 issues.push({
 wave: 33,
 type: "flat\_escalation",
 sceneIndex: i,
 message: "Scene does not increase pressure, consequence, or narrative cost.",
 severity: "high"
 });

 suggestions.push({
 wave: 33,
 sceneIndex: i,
 action: "escalate",
 note: "Increase stakes, complication, or irreversible consequence."
 });
 }
 }

 return Math.round((escalationHits / Math.max(1, scenes.length - 1)) \* 100);
}

**WAVE 34 — SCENE LENGTH RHYTHM**

This prevents the chapter from sounding mechanically even.

**Detect:**

* too many scenes of similar size
* no compression near climax
* repeated scene weight

function runWave34(
 scenes: ScenePacingProfile[],
 issues: PacingIssue[],
 suggestions: PacingSuggestion[]
): number {
 const lengths = scenes.map(s => s.wordCount);
 const avg = lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length);
 const variance =
 lengths.reduce((sum, n) => sum + Math.pow(n - avg, 2), 0) / Math.max(1, lengths.length);

 if (variance < 15000 && scenes.length >= 4) {
 issues.push({
 wave: 34,
 type: "rhythm\_monotony",
 message: "Scene lengths are too uniform, flattening pacing rhythm.",
 severity: "medium"
 });

 suggestions.push({
 wave: 34,
 action: "compress",
 note: "Shorten selected high-pressure scenes or expand one strategic slower beat for contrast."
 });
 }

 return Math.round(variance);
}

**WAVE 35 — POV DRIFT ACROSS SCENES**

This is the larger, chapter-scale version.

**Detect:**

* inconsistent interiority rules
* camera distance changing without purpose
* one scene deeply embedded, next scene oddly external
* vocabulary/perception not matching established POV anchor

function runWave35(
 scenes: ScenePacingProfile[],
 issues: PacingIssue[],
 suggestions: PacingSuggestion[]
): void {
 for (let i = 1; i < scenes.length; i++) {
 const prev = scenes[i - 1];
 const curr = scenes[i];

 if (prev.povAnchor === curr.povAnchor) {
 const abruptAnchorShift = detectPOVModeDrift(prev, curr);

 if (abruptAnchorShift) {
 issues.push({
 wave: 35,
 type: "pov\_drift",
 sceneIndex: i,
 message: "POV handling shifts across scenes without clear narrative intent.",
 severity: "high"
 });

 suggestions.push({
 wave: 35,
 sceneIndex: i,
 action: "restore\_pov",
 note: "Re-anchor perception, diction, and interior distance to the chapter’s POV contract."
 });
 }
 }
 }
}

function detectPOVModeDrift(
 prev: ScenePacingProfile,
 curr: ScenePacingProfile
): boolean {
 return Math.abs(prev.transitionSoftness - curr.transitionSoftness) > 50 &&
 prev.povAnchor === curr.povAnchor;
}

That helper is only a placeholder. In the real build, Wave 35 should read:

* pronoun behavior
* thought access depth
* lexical register
* sensory ownership
* forbidden knowledge leakage

**WAVE 36 — QUIET SCENE FUNCTIONALITY**

Quiet scenes are allowed.
Dead scenes are not.

**Detect:**

* low pressure + no decision
* low pressure + no revelation
* low pressure + no emotional consequence
* scene functioning only as filler or atmosphere

function runWave36(
 scenes: ScenePacingProfile[],
 issues: PacingIssue[],
 suggestions: PacingSuggestion[]
): void {
 scenes.forEach((scene, i) => {
 if (
 scene.quietScene &&
 scene.pressureOut < 40 &&
 !scene.hasDecision &&
 !scene.hasRevelation &&
 !scene.hasConsequence
 ) {
 issues.push({
 wave: 36,
 type: "quiet\_scene\_stall",
 sceneIndex: i,
 message: "Quiet scene slows the chapter without adding pressure, consequence, or insight.",
 severity: "high"
 });

 suggestions.push({
 wave: 36,
 sceneIndex: i,
 action: "carry\_pressure",
 note: "Inject dread, implication, decision, or discovery so the quieter beat still moves the chapter."
 });
 }
 });
}

**WAVE 37 — TRANSITION VELOCITY**

A chapter can lose force at the seam.

**Detect:**

* hard emotional drop between scenes
* transition language that over-explains
* too much reset framing
* “Later,” “The next day,” “By morning,” with no residue

function runWave37(
 scenes: ScenePacingProfile[],
 issues: PacingIssue[],
 suggestions: PacingSuggestion[]
): number {
 let velocityTotal = 0;

 for (let i = 1; i < scenes.length; i++) {
 const prev = scenes[i - 1];
 const curr = scenes[i];
 const velocity = 100 - curr.transitionSoftness;
 velocityTotal += velocity;

 if (curr.transitionSoftness > 70 && curr.pressureIn < prev.pressureOut - 20) {
 issues.push({
 wave: 37,
 type: "slow\_transition",
 sceneIndex: i,
 message: "Transition drains momentum instead of carrying force across the seam.",
 severity: "high"
 });

 suggestions.push({
 wave: 37,
 sceneIndex: i,
 action: "tighten\_transition",
 note: "Cut reset language and preserve emotional or situational residue from the prior scene."
 });
 }
 }

 return Math.round(velocityTotal / Math.max(1, scenes.length - 1));
}

**WAVE 38 — MID-CHAPTER SAG DETECTION**

This is where many chapters die.

**Detect:**

* center scenes with no rise
* repeated intensity band
* temporary activity without narrative advancement

function runWave38(
 scenes: ScenePacingProfile[],
 issues: PacingIssue[],
 suggestions: PacingSuggestion[]
): void {
 const start = Math.floor(scenes.length \* 0.33);
 const end = Math.ceil(scenes.length \* 0.66);

 for (let i = start; i < end; i++) {
 const scene = scenes[i];
 const prev = scenes[i - 1];

 if (
 prev &&
 scene.pressureOut <= prev.pressureOut &&
 !scene.hasRevelation &&
 !scene.hasConsequence
 ) {
 issues.push({
 wave: 38,
 type: "mid\_chapter\_sag",
 sceneIndex: i,
 message: "Middle section loses lift and risks flattening the chapter.",
 severity: "high"
 });

 suggestions.push({
 wave: 38,
 sceneIndex: i,
 action: "escalate",
 note: "Insert a turn, complication, discovery, or irreversible shift in the chapter’s middle band."
 });
 }
 }
}

**WAVE 39 — END-LOADING COMPRESSION**

The back third should tighten.

**Detect:**

* later scenes expanding instead of compressing
* end section relaxing
* climax zone containing explanation instead of pressure

function runWave39(
 scenes: ScenePacingProfile[],
 issues: PacingIssue[],
 suggestions: PacingSuggestion[]
): number {
 const backThird = scenes.slice(Math.floor(scenes.length \* 0.66));
 if (backThird.length < 2) return 0;

 let compressionHits = 0;

 for (let i = 1; i < backThird.length; i++) {
 if (backThird[i].wordCount <= backThird[i - 1].wordCount ||
 backThird[i].pressureOut >= backThird[i - 1].pressureOut) {
 compressionHits++;
 }
 }

 if (compressionHits < Math.floor(backThird.length / 2)) {
 issues.push({
 wave: 39,
 type: "weak\_end\_loading",
 message: "Back third does not sufficiently tighten or compress toward the ending.",
 severity: "high"
 });

 suggestions.push({
 wave: 39,
 action: "compress",
 note: "Shorten explanatory passages and intensify pressure density in the chapter’s final movement."
 });
 }

 return Math.round((compressionHits / Math.max(1, backThird.length - 1)) \* 100);
}

**WAVE 40 — LANDING FORCE**

Endings must do more than stop.

**Detect:**

* emotionally neutral ending
* no consequence
* no open pressure
* no residue
* no propulsion into next chapter

function runWave40(
 scenes: ScenePacingProfile[],
 issues: PacingIssue[],
 suggestions: PacingSuggestion[]
): number {
 const last = scenes[scenes.length - 1];
 if (!last) return 0;

 if (
 last.endingStrength < 50 &&
 !last.hasConsequence &&
 !last.hasRevelation
 ) {
 issues.push({
 wave: 40,
 type: "soft\_landing",
 message: "Ending does not land with enough consequence, dread, revelation, or propulsion.",
 severity: "high"
 });

 suggestions.push({
 wave: 40,
 sceneIndex: last.index,
 action: "strengthen\_landing",
 note: "End on consequence, pressure, revelation, dread, or irreversible motion."
 });
 }

 return last.endingStrength;
}

**PRIORITY + ORDERING**

This block needs explicit sequencing.

export const WAVE\_33\_40\_ORDER = [
 33, // escalation curve first
 36, // verify quiet scenes still function
 37, // preserve momentum at transitions
 38, // catch the sag
 39, // compress ending movement
 40, // verify landing
 34, // then tune rhythm
 35 // then repair POV continuity
] as const;

Why this order?

Because:

* structural pacing problems should be found before rhythm polishing
* end-loading should be checked before landing
* POV stabilization should happen after motion problems are identified

**REVISION MODE ENFORCEMENT**

This cluster must obey surgical limits.

function canRewriteBroadly(context: WaveContext): boolean {
 return context.revisionMode === "chapter";
}

function limitPacingAction(action: PacingSuggestion["action"], context: WaveContext) {
 if (context.revisionMode === "surgical") {
 if (action === "compress" || action === "escalate") {
 return "carry\_pressure";
 }
 }
 return action;
}

In **surgical** mode:

* allow trims
* allow scene-opening carryover lines
* allow transition tightening
* block whole-scene redesign

In **chapter** mode:

* allow true restructuring recommendations

**CONFLICT RULES**

This block needs wave conflict handling.

type WaveConflictRule = {
 first: number;
 second: number;
 reason: string;
};

export const WAVE\_CONFLICT\_RULES: WaveConflictRule[] = [
 {
 first: 31,
 second: 33,
 reason: "Pressure continuity must exist before escalation can be judged cleanly."
 },
 {
 first: 33,
 second: 39,
 reason: "Back-third compression depends on prior escalation logic."
 },
 {
 first: 39,
 second: 40,
 reason: "Landing quality depends on end-loading structure."
 },
 {
 first: 37,
 second: 35,
 reason: "Transition weakness can mimic POV drift and should be corrected first."
 }
];

**WHAT THIS BLOCK PRODUCES**

After Wave 33–40 runs, you should be able to generate:

* chapter pacing score
* escalation curve score
* sag risk
* landing strength score
* scenes needing compression
* scenes needing consequence
* transitions draining force
* quiet scenes that are secretly dead

That means this block is not just diagnostic.
It becomes **chapter pacing intelligence**.

**RECOMMENDED OUTPUT SHAPE**

type ChapterPacingReport = {
 chapterId: string;
 overallPacingScore: number;
 biggestRisk:
 | "flat\_middle"
 | "weak\_escalation"
 | "slow\_transitions"
 | "soft\_landing"
 | "pov\_drift";
 mustFixScenes: number[];
 topRecommendations: string[];
};

**BOTTOM LINE**

Wave 33–40 is the cluster that gives your engine:

* **shape**
* **velocity**
* **escalation**
* **compression**
* **ending force**

Without it, a chapter can be clean but still not feel inevitable.

With it, the chapter starts to feel **authored**, not merely corrected.
