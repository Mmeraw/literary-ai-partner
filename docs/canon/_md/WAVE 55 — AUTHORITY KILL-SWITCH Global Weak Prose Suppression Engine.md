*Good. Wave 55 is one of the most important control layers in the whole system.*

This is not just another wave.
This is a **global prose authority layer**.

It exists to do one thing:

**Kill weak prose patterns before they dilute chapter force.**

**WAVE 55 — AUTHORITY KILL-SWITCH**

**Global Weak Prose Suppression Engine**

Wave 55 should run across the whole chapter after core structure is assessed, but before final rewrite recommendations are ranked.

Its job is to detect and suppress prose that feels:

* vague
* soft
* generic
* over-explained
* mechanically dramatic
* stylistically diluted
* pseudo-literary instead of forceful

This is the wave that says:

“No. That line does not survive.”

**CORE DOCTRINE**

Weak prose usually enters through recurring failure modes:

1. **Authority leakage**
   The sentence sounds uncertain, padded, or apologetic.
2. **Generic dramatization**
   The prose signals emotion without earning it.
3. **Explanatory drag**
   The line tells what the scene already shows.
4. **Stock phrasing**
   Familiar language reduces originality and force.
5. **Atmospheric filler**
   Mood language without narrative work.

Wave 55 is the **kill-switch** for those patterns.

**WHAT IT SHOULD CATCH**

**Category A — Authority Leakage**

Examples:

* “seemed to”
* “felt like”
* “as if”
* “sort of”
* “kind of”
* “almost”
* “apparently”
* “it was like”

Not all of these are always wrong.
But globally, they often weaken force.

**Category B — Generic Emotional Signaling**

Examples:

* “his heart pounded”
* “tension filled the air”
* “a chill ran through him”
* “the air was thick”
* “his pulse quickened”
* “fear gripped him”
* “he couldn’t believe”
* “everything changed”

These often create the illusion of intensity instead of actual intensity.

**Category C — Atmospheric Filler**

Examples:

* mood-only weather lines
* repeated darkness references
* empty sensory decoration
* “silence hung between them”
* “the room felt heavy”
* “the night pressed in”

If the line adds no consequence, pressure, perception, or specificity, it is a target.

**Category D — Explanatory Redundancy**

Examples:

* dialogue followed by explanation of what dialogue already showed
* action followed by interpretation already obvious
* repeated emotional labeling after clear behavior

**Category E — Stock Literary Phrasing**

Examples:

* “let out a breath he didn’t know he was holding”
* “time seemed to stop”
* “for a moment, everything went still”
* “the weight of it settled over him”
* “something in him broke”
* “the ground dropped out beneath him”

These may occasionally be usable, but at system scale they must be treated as suspicious.

**SYSTEM GOAL**

Wave 55 should not just flag lines.
It should classify them by:

* severity
* repeat frequency
* voice damage risk
* rewrite priority

So this wave becomes the chapter’s **global prose filtration system**.

**TYPE SYSTEM**

type AuthorityKillCategory =
 | "authority\_leakage"
 | "generic\_emotion"
 | "atmospheric\_filler"
 | "explanatory\_redundancy"
 | "stock\_literary\_phrase"
 | "weak\_transition\_language"
 | "softening\_adverb"
 | "empty\_intensifier";

type AuthorityKillSeverity = "low" | "medium" | "high" | "critical";

type AuthorityKillHit = {
 lineIndex: number;
 sentenceIndex?: number;
 category: AuthorityKillCategory;
 matchedText: string;
 message: string;
 severity: AuthorityKillSeverity;
 repeatCount?: number;
 voiceDamageRisk: number; // 0–100
 replacementStrategy:
 | "delete"
 | "tighten"
 | "make\_specific"
 | "convert\_to\_action"
 | "convert\_to\_image"
 | "preserve\_but\_review";
};

type Wave55Result = {
 hits: AuthorityKillHit[];
 summary: {
 totalHits: number;
 criticalHits: number;
 repeatedPatternCount: number;
 authorityScorePenalty: number;
 };
};

**RULE SOURCE MODEL**

This wave should be rule-driven, expandable, and weighted.

type KillSwitchRule = {
 id: string;
 category: AuthorityKillCategory;
 pattern: RegExp;
 severity: AuthorityKillSeverity;
 voiceDamageRisk: number;
 replacementStrategy: AuthorityKillHit["replacementStrategy"];
 note: string;
};

**BASE RULESET**

export const WAVE\_55\_RULES: KillSwitchRule[] = [
 {
 id: "authority-seemed-to",
 category: "authority\_leakage",
 pattern: /\bseemed to\b/gi,
 severity: "high",
 voiceDamageRisk: 82,
 replacementStrategy: "tighten",
 note: "Weakens declarative force."
 },
 {
 id: "authority-felt-like",
 category: "authority\_leakage",
 pattern: /\bfelt like\b/gi,
 severity: "high",
 voiceDamageRisk: 78,
 replacementStrategy: "make\_specific",
 note: "Often substitutes approximation for precision."
 },
 {
 id: "generic-heart-pounded",
 category: "generic\_emotion",
 pattern: /\bheart pounded\b/gi,
 severity: "high",
 voiceDamageRisk: 88,
 replacementStrategy: "convert\_to\_action",
 note: "Generic physiological shorthand."
 },
 {
 id: "generic-tension-filled-air",
 category: "generic\_emotion",
 pattern: /\btension filled the air\b/gi,
 severity: "critical",
 voiceDamageRisk: 95,
 replacementStrategy: "delete",
 note: "Pure stock dramatization."
 },
 {
 id: "stock-breath",
 category: "stock\_literary\_phrase",
 pattern: /\blet out a breath he didn[’']t know he was holding\b/gi,
 severity: "critical",
 voiceDamageRisk: 97,
 replacementStrategy: "delete",
 note: "Severely overused literary phrasing."
 },
 {
 id: "softener-sort-of",
 category: "authority\_leakage",
 pattern: /\bsort of\b/gi,
 severity: "medium",
 voiceDamageRisk: 65,
 replacementStrategy: "tighten",
 note: "Softens sentence authority."
 },
 {
 id: "softener-kind-of",
 category: "authority\_leakage",
 pattern: /\bkind of\b/gi,
 severity: "medium",
 voiceDamageRisk: 64,
 replacementStrategy: "tighten",
 note: "Softens sentence authority."
 },
 {
 id: "empty-intensifier-very",
 category: "empty\_intensifier",
 pattern: /\bvery\b/gi,
 severity: "low",
 voiceDamageRisk: 38,
 replacementStrategy: "make\_specific",
 note: "Often replaceable with stronger diction."
 },
 {
 id: "softening-adverb-suddenly",
 category: "softening\_adverb",
 pattern: /\bsuddenly\b/gi,
 severity: "medium",
 voiceDamageRisk: 58,
 replacementStrategy: "convert\_to\_action",
 note: "Often announces effect instead of delivering it."
 }
];

**EXECUTOR**

export function runWave55(
 lines: string[],
 context: WaveContext
): Wave55Result {
 const hits: AuthorityKillHit[] = [];
 const patternCounts = new Map<string, number>();

 lines.forEach((line, lineIndex) => {
 for (const rule of WAVE\_55\_RULES) {
 const matches = [...line.matchAll(rule.pattern)];

 for (const match of matches) {
 const matchedText = match[0];
 patternCounts.set(rule.id, (patternCounts.get(rule.id) ?? 0) + 1);

 hits.push({
 lineIndex,
 category: rule.category,
 matchedText,
 message: rule.note,
 severity: rule.severity,
 voiceDamageRisk: rule.voiceDamageRisk,
 replacementStrategy: rule.replacementStrategy
 });
 }
 }
 });

 const repeatedPatternCount = [...patternCounts.values()].filter(c => c > 1).length;
 const criticalHits = hits.filter(h => h.severity === "critical").length;
 const authorityScorePenalty = calculateAuthorityPenalty(hits, repeatedPatternCount);

 return {
 hits,
 summary: {
 totalHits: hits.length,
 criticalHits,
 repeatedPatternCount,
 authorityScorePenalty
 }
 };
}

**AUTHORITY PENALTY MODEL**

This wave should materially affect scoring.

function calculateAuthorityPenalty(
 hits: AuthorityKillHit[],
 repeatedPatternCount: number
): number {
 let penalty = 0;

 for (const hit of hits) {
 switch (hit.severity) {
 case "low":
 penalty += 1;
 break;
 case "medium":
 penalty += 3;
 break;
 case "high":
 penalty += 6;
 break;
 case "critical":
 penalty += 10;
 break;
 }

 penalty += Math.round(hit.voiceDamageRisk / 25);
 }

 penalty += repeatedPatternCount \* 4;

 return penalty;
}

**REPEAT ESCALATION RULE**

One weak phrase might be survivable.
Pattern repetition is not.

export function escalateRepeatedPatterns(hits: AuthorityKillHit[]): AuthorityKillHit[] {
 const counts = new Map<string, number>();

 for (const hit of hits) {
 const key = `${hit.category}:${hit.matchedText.toLowerCase()}`;
 counts.set(key, (counts.get(key) ?? 0) + 1);
 }

 return hits.map(hit => {
 const key = `${hit.category}:${hit.matchedText.toLowerCase()}`;
 const repeatCount = counts.get(key) ?? 1;

 let severity = hit.severity;
 if (repeatCount >= 3 && severity === "medium") severity = "high";
 if (repeatCount >= 3 && severity === "high") severity = "critical";

 return {
 ...hit,
 repeatCount,
 severity
 };
 });
}

This matters because repetition turns a local weakness into a **chapter voice failure**.

**SURGICAL VS CHAPTER ENFORCEMENT**

Wave 55 must obey revision boundaries.

export function applyWave55Action(
 hit: AuthorityKillHit,
 context: WaveContext
): AuthorityKillHit["replacementStrategy"] {
 if (context.revisionMode === "surgical") {
 if (hit.replacementStrategy === "delete") return "tighten";
 if (hit.replacementStrategy === "convert\_to\_image") return "make\_specific";
 }

 return hit.replacementStrategy;
}

In **surgical** mode:

* tighten
* local replacement
* specificity upgrade
* no broad stylistic rewrite

In **chapter** mode:

* allow deletion
* allow image replacement
* allow forceful recasting

**SMARTER SECOND LAYER**

**Context Protection**

Wave 55 should not blindly kill language that is intentional in dialogue, voice, or irony.

You need exemptions.

type Wave55ExemptionContext = {
 insideDialogue: boolean;
 insideItalicThought: boolean;
 isVoiceSpecificUsage: boolean;
 isCharacterWeaknessIntentional: boolean;
};

function shouldExemptWave55Hit(
 hitText: string,
 cx: Wave55ExemptionContext
): boolean {
 if (cx.insideDialogue && cx.isVoiceSpecificUsage) return true;
 if (cx.insideItalicThought && cx.isCharacterWeaknessIntentional) return true;
 return false;
}

This is crucial. Otherwise the system starts flattening character voice.

**HIGH-VALUE CATEGORIES TO ADD NEXT**

After base implementation, expand Wave 55 with dedicated detectors for:

**1. Weak transition language**

* “then”
* “after that”
* “a moment later”
* “soon”
* “before long”

**2. Empty intensifiers**

* “really”
* “extremely”
* “incredibly”
* “so much”

**3. Fake precision**

* “somehow”
* “in some way”
* “for some reason”

**4. Generic body reactions**

* “stomach dropped”
* “spine tingled”
* “blood ran cold”
* “jaw tightened”

**5. Mood scaffolding**

* “silence lingered”
* “the darkness pressed in”
* “the room was full of tension”

These are all high ROI.

**OUTPUT SHAPE FOR UI / REPORTING**

type Wave55Report = {
 chapterId: string;
 authorityScore: number;
 worstPatterns: {
 phrase: string;
 count: number;
 severity: AuthorityKillSeverity;
 }[];
 topLinesToFix: {
 lineIndex: number;
 matchedText: string;
 replacementStrategy: string;
 voiceDamageRisk: number;
 }[];
};

That gives you:

* an authority score
* most repeated weak patterns
* highest-risk lines
* ranked edit targets

**PIPELINE POSITION**

Wave 55 should run here:

Pass 1–3
→ Convergence
→ Wave mapping
→ Wave 31
→ Wave 33–40
→ Wave 55
→ rewrite ranking
→ diff intelligence
→ persistence

Why here?

Because:

* structure first
* pacing second
* prose suppression after motion is understood
* then ranking and rewrite logic

**CONFLICT RULES**

Wave 55 needs explicit priority behavior.

export const WAVE\_55\_CONFLICT\_RULES = [
 {
 first: 48,
 second: 55,
 rule: "If phrase is voice-essential, Wave 48 can override Wave 55."
 },
 {
 first: 35,
 second: 55,
 rule: "If phrasing reflects POV contract, do not flatten it through global suppression."
 },
 {
 first: 41,
 second: 55,
 rule: "Wave 55 removes weakness before prose artistry upgrades are applied."
 }
];

This is important:

* Wave 55 should be powerful
* but it cannot become a blunt instrument

**WHY THIS WAVE HAS SUCH HIGH ROI**

Because it improves almost every chapter immediately.

It catches:

* weak habit phrases
* filler atmosphere
* emotional shorthand
* timid syntax
* repeated softness

So even before advanced AI rewriting, the manuscript becomes:

* cleaner
* sharper
* more authoritative
* less generic
* more voice-protective, if exemptions are built correctly

**BOTTOM LINE**

Wave 55 is your **global prose discipline engine**.

It is one of the few waves that can produce visible improvement across nearly every chapter without needing full-scale scene redesign.

It takes prose from:

“acceptable, emotional, readable”

to:

“controlled, authoritative, and hard to dismiss.”
