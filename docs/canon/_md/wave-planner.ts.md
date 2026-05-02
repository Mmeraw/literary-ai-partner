// wave-planner.ts

// Builds the final wave execution plan from registry, eligibility, dependencies, and conflicts.

import {

WAVE\_REGISTRY,

type WaveDefinition,

type WaveExecutionContext,

type WaveId,

type WavePhase,

type WavePriority,

} from "./wave-registry";

import { resolveWaveConflicts } from "./wave-conflicts";

export type WaveExecutionDecision = {

waveId: WaveId;

shouldRun: boolean;

reason: string;

phase: WavePhase;

priority: WavePriority;

order: number;

};

const PRIORITY\_WEIGHT: Record<WavePriority, number> = {

critical: 400,

high: 300,

medium: 200,

low: 100,

};

const PHASE\_WEIGHT: Record<WavePhase, number> = {

pre\_structure: 100,

post\_structure: 200,

pacing: 300,

prose: 400,

voice: 500,

ranking: 600,

finalization: 700,

};

function isWaveAllowedInMode(

wave: WaveDefinition,

mode: "surgical" | "chapter"

): boolean {

return mode === "surgical"

? wave.allowInSurgicalMode

: wave.allowInChapterMode;

}

function isWaveEligible(

wave: WaveDefinition,

context: WaveExecutionContext

): boolean {

if (!context.enabledWaves.includes(wave.id)) return false;

if (context.disabledWaves?.includes(wave.id)) return false;

if (!isWaveAllowedInMode(wave, context.revisionMode)) return false;

if (wave.eligibility && !wave.eligibility(context)) return false;

return true;

}

function dependenciesSatisfied(

wave: WaveDefinition,

selected: Set<WaveId>

): boolean {

if (!wave.dependsOn?.length) return true;

return wave.dependsOn.every((dep) => selected.has(dep));

}

export function buildWaveExecutionPlan(

context: WaveExecutionContext

): WaveExecutionDecision[] {

const eligible = Object.values(WAVE\_REGISTRY).filter((wave) =>

isWaveEligible(wave, context)

);

const selectedIds = new Set<WaveId>(eligible.map((w) => w.id));

const dependencyFiltered = eligible.filter((w) =>

dependenciesSatisfied(w, selectedIds)

);

const conflictResolutions = resolveWaveConflicts(

dependencyFiltered.map((w) => w.id),

context

);

const suppressed = new Set(

conflictResolutions

.filter((r) => r.mode === "suppress")

.map((r) => r.affect)

);

const deferred = new Set(

conflictResolutions

.filter((r) => r.mode === "defer")

.map((r) => r.affect)

);

const planned = dependencyFiltered

.filter((w) => !suppressed.has(w.id))

.sort((a, b) => {

const scoreA = PRIORITY\_WEIGHT[a.priority] + PHASE\_WEIGHT[a.phase];

const scoreB = PRIORITY\_WEIGHT[b.priority] + PHASE\_WEIGHT[b.phase];

return scoreA - scoreB;

});

const ordered = [

...planned.filter((w) => !deferred.has(w.id)),

...planned.filter((w) => deferred.has(w.id)),

];

return ordered.map((wave, index) => ({

waveId: wave.id,

shouldRun: true,

reason:

"Eligible, dependency-satisfied, mode-allowed, and conflict-cleared.",

phase: wave.phase,

priority: wave.priority,

order: index + 1,

}));

}
