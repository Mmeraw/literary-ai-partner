import {
  PHASE_V2_LOG_EVENTS,
  PHASE_V2_NAMING_RULES,
  PHASE_V2_PROGRESS_LADDER,
  PHASE_V2_RUNTIME_LABELS,
} from '../../lib/evaluation/phase-architecture-v2/progressLabels';

describe('Phase Architecture v2 — progress labels and naming rules', () => {
  it('contains the canonical progress ladder percentages', () => {
    expect(PHASE_V2_PROGRESS_LADDER).toEqual([
      { key: 'queued', label: 'Queued', percent: 2 },
      { key: 'phase_0_calibrating', label: 'Phase 0 calibrating', percent: 5 },
      { key: 'chunk_routing', label: 'Chunk routing / manuscript prep', percent: 10 },
      { key: 'parallel_reading', label: 'Phase 1A + Preflight reading in parallel', percentRange: [15, 40] },
      { key: 'reduce_and_assembly', label: '3A REDUCE + Story Layer assembly', percentRange: [42, 47] },
      { key: 'review_gate', label: 'Review Gate', percent: 50 },
      { key: 'phase_2_criteria', label: 'Phase 2 criteria analysis', percentRange: [60, 75] },
      { key: 'phase_3b_synthesis', label: 'Phase 3B synthesis', percentRange: [80, 92] },
      { key: 'dream_longform', label: 'DREAM longform', percentRange: [95, 99] },
      { key: 'complete', label: 'Complete', percent: 100 },
    ]);
  });

  it('distinguishes Phase 1A Story Layer from Pass 3A MAP/REDUCE labels', () => {
    expect(PHASE_V2_RUNTIME_LABELS.phase1aStoryLayerReading).toBe('Phase 1A Story Layer reading');
    expect(PHASE_V2_RUNTIME_LABELS.pass3aMapReading).toBe('Pass 3A MAP reading');
    expect(PHASE_V2_RUNTIME_LABELS.pass3aReduce).toBe('Pass 3A REDUCE');
  });

  it('keeps Quality Gate and WAVE Revision separate', () => {
    expect(PHASE_V2_RUNTIME_LABELS.qualityGate).toBe('Quality Gate');
    expect(PHASE_V2_RUNTIME_LABELS.waveRevision).toBe('WAVE Readiness Layer');
    expect(PHASE_V2_RUNTIME_LABELS.qualityGate).not.toBe(PHASE_V2_RUNTIME_LABELS.waveRevision);
  });

  it('declares explicit lifecycle log event names', () => {
    expect(PHASE_V2_LOG_EVENTS.pass3aMapStarted).toBe('pass3a_map_started');
    expect(PHASE_V2_LOG_EVENTS.pass3aReduceCompleted).toBe('pass3a_reduce_completed');
    expect(PHASE_V2_LOG_EVENTS.reviewGateBlocked).toBe('review_gate_blocked');
    expect(PHASE_V2_LOG_EVENTS.phase2Blocked).toBe('phase2_blocked');
    expect(PHASE_V2_LOG_EVENTS.qualityGateStarted).toBe('quality_gate_started');
    expect(PHASE_V2_LOG_EVENTS.waveRevisionStarted).toBe('wave_revision_started');
  });

  it('captures the hard naming rules', () => {
    expect(PHASE_V2_NAMING_RULES).toContain('Pass 3A is never Phase 0.');
    expect(PHASE_V2_NAMING_RULES).toContain('Quality Gate is never WAVE.');
    expect(PHASE_V2_NAMING_RULES).toContain('Failed Pass 3A must be visibly blocking.');
    expect(PHASE_V2_NAMING_RULES).toContain('Degraded Pass 3A must be visibly degraded, not complete.');
  });
});
