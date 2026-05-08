// ========================================================
// wave-modules/wave-20-pov-purity.ts
// REAL TEXT-CHANGING MODULE
// ========================================================

import type { RevisionTarget } from "@/lib/pipeline-types";
import type {
 WaveExecutionContext,
 WaveExecutionModuleResult,
 WaveTextChange,
} from "@/services/wave-executor";

const POV\_LEAK\_PATTERNS: Array<{
 pattern: RegExp;
 replacement: string;
 rationale: string;
}> = [
 {
 pattern: /\bhe wondered if\b/gi,
 replacement: "he had to know whether",
 rationale: "Tightens filter phrasing and reduces cognitive distance.",
 },
 {
 pattern: /\bshe wondered if\b/gi,
 replacement: "she had to know whether",
 rationale: "Tightens filter phrasing and reduces cognitive distance.",
 },
 {
 pattern: /\bhe realized that\b/gi,
 replacement: "the truth hit him:",
 rationale: "Converts filter realization into closer POV delivery.",
 },
 {
 pattern: /\bshe realized that\b/gi,
 replacement: "the truth hit her:",
 rationale: "Converts filter realization into closer POV delivery.",
 },
 {
 pattern: /\bhe saw that\b/gi,
 replacement: "he saw",
 rationale: "Removes unnecessary 'that' filter construction.",
 },
 {
 pattern: /\bshe saw that\b/gi,
 replacement: "she saw",
 rationale: "Removes unnecessary 'that' filter construction.",
 },
 {
 pattern: /\bhe felt that\b/gi,
 replacement: "it was",
 rationale: "Reduces abstract mediation and moves closer to direct experience.",
 },
 {
 pattern: /\bshe felt that\b/gi,
 replacement: "it was",
 rationale: "Reduces abstract mediation and moves closer to direct experience.",
 },
 {
 pattern: /\bit seemed to him that\b/gi,
 replacement: "",
 rationale: "Removes heavy filter phrase that weakens POV authority.",
 },
 {
 pattern: /\bit seemed to her that\b/gi,
 replacement: "",
 rationale: "Removes heavy filter phrase that weakens POV authority.",
 },
];

export async function executeWave20(
 context: WaveExecutionContext,
 targets: RevisionTarget[]
): Promise<WaveExecutionModuleResult> {
 let proposedText = context.text;
 const changes: WaveTextChange[] = [];
 const modifications: string[] = [];

 for (const rule of POV\_LEAK\_PATTERNS) {
 const matches = [...proposedText.matchAll(new RegExp(rule.pattern.source, rule.pattern.flags))];

 if (matches.length === 0) continue;

 for (const match of matches) {
 changes.push({
 type: "replace",
 targetText: match[0],
 replacementText: rule.replacement,
 rationale: rule.rationale,
 });
 }

 proposedText = proposedText.replace(rule.pattern, rule.replacement);
 modifications.push(`Reduced POV filter pattern: ${rule.pattern}`);
 }

 // Cleanup from empty replacements
 proposedText = proposedText
 .replace(/[ ]{2,}/g, " ")
 .replace(/\s+([,.;:!?])/g, "$1")
 .replace(/\n{3,}/g, "\n\n");

 return {
 waveNumber: 20,
 success: true,
 notes: "POV purity pass applied.",
 proposedText,
 changes,
 modifications,
 };
}

// ========================================================
// PATCH FOR src/services/wave-executor.ts
// ADD THIS IMPORT + REGISTRY ENTRY
// ========================================================

import { executeWave20 } from "@/wave-modules/wave-20-pov-purity";

// ADD to WAVE\_MODULES:

20: {
 waveNumber: 20,
 name: "Voice Differentiation Audit / POV Purity",
 execute: executeWave20,
},

Top of Form

Bottom of Form
