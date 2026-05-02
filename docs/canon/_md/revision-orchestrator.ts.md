// revision-orchestrator.ts

// Master coordination: builds plan, runs waves, collects edits, returns unified chapter artifact.

import type { WaveExecutionContext } from "./wave-registry";

import { buildWaveExecutionPlan } from "./wave-planner";

import {

enforceRevisionModeOnDiffs,

rankEdits,

groupRankedEdits,

getHighRiskEdits,

getVoiceAlteringEdits,

type ProposedEdit,

} from "./diff-intelligence";

// Import actual wave executors when implemented
