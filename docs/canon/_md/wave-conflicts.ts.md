// wave-conflicts.ts

// Conflict resolution rules between waves. Kept separate from planner for safe evolution.

import type { WaveExecutionContext, WaveId } from "./wave-registry";

export type ConflictResolutionMode = "suppress" | "defer" | "scope\_limit";

export type WaveConflictResolution = {

keep: WaveId;

affect: WaveId;

mode: ConflictResolutionMode;

reason: string;

};

export function resolveWaveConflicts(

selected: WaveId[],

context: WaveExecutionContext

): WaveConflictResolution[] {

const resolutions: WaveConflictResolution[] = [];

if (

selected.includes(48) &&

selected.includes(55) &&

context.diagnostics.hasVoiceRisk

) {

resolutions.push({

keep: 48,

affect: 55,

mode: "scope\_limit",

reason:

"Voice-signature language must be protected from global prose suppression.",

});

}

if (selected.includes(37) && selected.includes(35)) {

resolutions.push({

keep: 37,

affect: 35,

mode: "defer",

reason:

"Transition weakness should be assessed before chapter-scale POV drift.",

});

}

return resolutions;

}
