export const PHASE_V2_PROGRESS_LADDER = [
  { key: 'queued', label: 'Queued', percent: 2 },
  { key: 'phase_0_calibrating', label: 'Phase 0 calibrating', percent: 5 },
  { key: 'chunk_routing', label: 'Chunk routing / manuscript prep', percent: 10 },
  { key: 'parallel_reading', label: 'Phase 1A + Preflight reading in parallel', percentRange: [15, 40] as const },
  { key: 'reduce_and_assembly', label: '3A REDUCE + Story Layer assembly', percentRange: [42, 47] as const },
  { key: 'review_gate', label: 'Review Gate', percent: 50 },
  { key: 'phase_2_criteria', label: 'Phase 2 criteria analysis', percentRange: [60, 75] as const },
  { key: 'phase_3b_synthesis', label: 'Phase 3B synthesis', percentRange: [80, 92] as const },
  { key: 'dream_longform', label: 'DREAM longform', percentRange: [95, 99] as const },
  { key: 'complete', label: 'Complete', percent: 100 },
] as const;

export type PhaseV2ProgressLadderKey = (typeof PHASE_V2_PROGRESS_LADDER)[number]['key'];

export const PHASE_V2_RUNTIME_LABELS = {
  queued: 'Queued',
  phase0Calibrating: 'Phase 0 calibrating',
  chunkRouting: 'Chunk routing / manuscript prep',
  phase1aStoryLayerReading: 'Phase 1A Story Layer reading',
  pass3aMapReading: 'Pass 3A MAP reading',
  pass3aReduce: 'Pass 3A REDUCE',
  reviewGate: 'Review Gate',
  phase2CriteriaAnalysis: 'Phase 2 Criteria Analysis',
  phase3bSynthesis: 'Phase 3B Synthesis',
  qualityGate: 'Quality Gate',
  waveRevision: 'WAVE Readiness Layer',
  dreamLongform: 'DREAM longform',
  complete: 'Complete',
} as const;

export type PhaseV2RuntimeLabelKey = keyof typeof PHASE_V2_RUNTIME_LABELS;

export const PHASE_V2_LOG_EVENTS = {
  phase0Started: 'phase0_started',
  phase0Completed: 'phase0_completed',
  chunkRoutingManifestReady: 'chunk_routing_manifest_ready',
  phase1aStoryLayerStarted: 'phase1a_story_layer_started',
  phase1aStoryLayerCompleted: 'phase1a_story_layer_completed',
  pass3aMapStarted: 'pass3a_map_started',
  pass3aMapCompleted: 'pass3a_map_completed',
  pass3aReduceStarted: 'pass3a_reduce_started',
  pass3aReduceCompleted: 'pass3a_reduce_completed',
  pass3aDegraded: 'pass3a_degraded',
  pass3aFailed: 'pass3a_failed',
  reviewGateReady: 'review_gate_ready',
  reviewGateBlocked: 'review_gate_blocked',
  phase2Started: 'phase2_started',
  phase2Blocked: 'phase2_blocked',
  phase3bStarted: 'phase3b_started',
  qualityGateStarted: 'quality_gate_started',
  waveRevisionStarted: 'wave_revision_started',
} as const;

export type PhaseV2LogEventKey = keyof typeof PHASE_V2_LOG_EVENTS;

export const PHASE_V2_NAMING_RULES = [
  'Pass 3A is never Phase 0.',
  'Pass 3A is never hidden inside generic Phase 1A labels once Track C is split.',
  'Quality Gate is never WAVE.',
  'WAVE is the long-form readiness / revision-planning analysis layer — not Pass 4 and not the Revise workflow.',
  'WAVE can diagnose and plan. Revise (Queue / TrustedPath) repairs.',
  'Failed Pass 3A must be visibly blocking.',
  'Degraded Pass 3A must be visibly degraded, not complete.',
] as const;
