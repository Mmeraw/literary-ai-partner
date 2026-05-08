// diff-intelligence.ts

// Edit ranking, risk classification, grouping, and review intelligence.

import type { WaveId, RevisionMode } from "./wave-registry";

export type DiffCategory =

| "pressure"

| "pacing"

| "prose"

| "voice"

| "clarity"

| "structure"

| "transition"

| "landing";

export type DiffRiskLevel = "low" | "medium" | "high" | "critical";

export type ProposedEdit = {

id: string;

waveId: WaveId;

chapterId: string;

sceneIndex?: number;

lineIndex?: number;

category: DiffCategory;

originalText: string;

proposedText: string;

rationale: string;

impactScore: number;

confidenceScore: number;

voiceAlterationScore: number;

structuralRiskScore: number;

scopeScore: number;

};

export type RankedEdit = ProposedEdit & {

priorityScore: number;

riskLevel: DiffRiskLevel;

groupKey: string;

requiresReview: boolean;

};

function classifyRisk(edit: ProposedEdit): DiffRiskLevel {

const composite = Math.round(

edit.voiceAlterationScore \* 0.4 +

edit.structuralRiskScore \* 0.4 +

edit.scopeScore \* 0.2

);

if (composite >= 80) return "critical";

if (composite >= 60) return "high";

if (composite >= 35) return "medium";

return "low";

}

function calculatePriorityScore(edit: ProposedEdit): number {

return Math.round(

edit.impactScore \* 0.45 +

edit.confidenceScore \* 0.2 -

edit.voiceAlterationScore \* 0.15 -

edit.structuralRiskScore \* 0.1 -

edit.scopeScore \* 0.1

);

}

function buildGroupKey(edit: ProposedEdit): string {

if (edit.sceneIndex !== undefined)

return `scene:${edit.sceneIndex}:${edit.category}`;

return `chapter:${edit.category}`;

}

export function enforceRevisionModeOnDiffs(

edits: ProposedEdit[],

mode: RevisionMode

): ProposedEdit[] {

if (mode === "chapter") return edits;

return edits.filter(

(edit) => edit.scopeScore <= 35 && edit.structuralRiskScore <= 40

);

}

export function rankEdits(edits: ProposedEdit[]): RankedEdit[] {

return edits

.map((edit) => {

const riskLevel = classifyRisk(edit);

const priorityScore = calculatePriorityScore(edit);

return {

...edit,

priorityScore,

riskLevel,

groupKey: buildGroupKey(edit),

requiresReview:

riskLevel === "high" || riskLevel === "critical",

};

})

.sort((a, b) => b.priorityScore - a.priorityScore);

}

export function groupRankedEdits(

edits: RankedEdit[]

): Record<string, RankedEdit[]> {

return edits.reduce<Record<string, RankedEdit[]>>((acc, edit) => {

if (!acc[edit.groupKey]) acc[edit.groupKey] = [];

acc[edit.groupKey].push(edit);

return acc;

}, {});

}

export function getHighRiskEdits(edits: RankedEdit[]): RankedEdit[] {

return edits.filter(

(edit) => edit.riskLevel === "high" || edit.riskLevel === "critical"

);

}

export function getVoiceAlteringEdits(edits: RankedEdit[]): RankedEdit[] {

return edits.filter((edit) => edit.voiceAlterationScore >= 60);

}
