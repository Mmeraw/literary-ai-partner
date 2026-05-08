// wave-registry.ts

// Source of truth for wave definitions, types, and metadata.

export type RevisionMode = "surgical" | "chapter";

export type WavePhase =

| "pre\_structure"

| "post\_structure"

| "pacing"

| "prose"

| "voice"

| "ranking"

| "finalization";

export type WavePriority = "critical" | "high" | "medium" | "low";

export type WaveId =

| 31

| 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40

| 48

| 55;

export type WaveExecutionContext = {

revisionMode: RevisionMode;

chapterId: string;

enabledWaves: WaveId[];

disabledWaves?: WaveId[];

diagnostics: {

hasPOVRisk?: boolean;

hasVoiceRisk?: boolean;

hasPacingRisk?: boolean;

hasAuthorityLeakage?: boolean;

hasPressureContinuityRisk?: boolean;

};

};

export type WaveDefinition = {

id: WaveId;

name: string;

phase: WavePhase;

priority: WavePriority;

dependsOn?: WaveId[];

conflictsWith?: WaveId[];

allowInSurgicalMode: boolean;

allowInChapterMode: boolean;

eligibility?: (context: WaveExecutionContext) => boolean;

};

export const WAVE\_REGISTRY: Record<WaveId, WaveDefinition> = {

31: {

id: 31,

name: "Scene-to-Scene Pressure Carry",

phase: "post\_structure",

priority: "critical",

allowInSurgicalMode: true,

allowInChapterMode: true,

eligibility: (cx) => !!cx.diagnostics.hasPressureContinuityRisk,

},

33: {

id: 33,

name: "Escalation Curve Integrity",

phase: "pacing",

priority: "critical",

dependsOn: [31],

allowInSurgicalMode: true,

allowInChapterMode: true,

eligibility: (cx) => !!cx.diagnostics.hasPacingRisk,

},

34: {

id: 34,

name: "Scene Length Rhythm",

phase: "pacing",

priority: "medium",

dependsOn: [33],

allowInSurgicalMode: true,

allowInChapterMode: true,

},

35: {

id: 35,

name: "POV Drift Across Scenes",

phase: "voice",

priority: "high",

dependsOn: [37],

allowInSurgicalMode: true,

allowInChapterMode: true,

eligibility: (cx) => !!cx.diagnostics.hasPOVRisk,

},

36: {

id: 36,

name: "Quiet Scene Functionality",

phase: "pacing",

priority: "high",

dependsOn: [33],

allowInSurgicalMode: true,

allowInChapterMode: true,

},

37: {

id: 37,

name: "Transition Velocity",

phase: "pacing",

priority: "high",

dependsOn: [31],

allowInSurgicalMode: true,

allowInChapterMode: true,

},

38: {

id: 38,

name: "Mid-Chapter Sag Detection",

phase: "pacing",

priority: "high",

dependsOn: [33, 36],

allowInSurgicalMode: true,

allowInChapterMode: true,

},

39: {

id: 39,

name: "End-Loading Compression",

phase: "pacing",

priority: "high",

dependsOn: [33, 38],

allowInSurgicalMode: true,

allowInChapterMode: true,

},

40: {

id: 40,

name: "Landing Force",

phase: "pacing",

priority: "critical",

dependsOn: [39],

allowInSurgicalMode: true,

allowInChapterMode: true,

},

48: {

id: 48,

name: "Voice Consistency Across Chapter",

phase: "voice",

priority: "high",

dependsOn: [55],

conflictsWith: [55],

allowInSurgicalMode: true,

allowInChapterMode: true,

eligibility: (cx) => !!cx.diagnostics.hasVoiceRisk,

},

55: {

id: 55,

name: "Authority Kill-Switch",

phase: "prose",

priority: "critical",

allowInSurgicalMode: true,

allowInChapterMode: true,

eligibility: (cx) => !!cx.diagnostics.hasAuthorityLeakage,

},

};
