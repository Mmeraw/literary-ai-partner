import {
  assertWorkerPhaseEntry,
  selectResumeCheckpoint,
  toChecklistArtifactMap,
} from '../../lib/evaluation/phase-architecture-v2/checklistRuntimeWiring';
import type { RuntimeArtifactRow } from '../../lib/evaluation/phase-architecture-v2/checklistRuntimeWiring';

const row = (artifact_type: string, overrides: Record<string, unknown> = {}): RuntimeArtifactRow => ({
  id: `${artifact_type}-row-id`,
  artifact_type,
  source_hash: `${artifact_type}-source-hash`,
  created_at: new Date().toISOString(),
  content: {
    artifact_id: `${artifact_type}-artifact-id`,
    schema_valid: true,
    semantic_status: 'valid',
    is_resume_safe: true,
    checksum: `${artifact_type}-checksum`,
    ...overrides,
  },
});

describe('checklist runtime wiring helpers', () => {
  it('maps runtime artifact rows into checklist artifact state', () => {
    const map = toChecklistArtifactMap([
      row('phase0_authority_proof_v1'),
      row('story_map_seed_v1'),
      row('not_a_checklist_artifact'),
    ]);

    expect(map.phase0_authority_proof_v1?.artifact_id).toBe('phase0_authority_proof_v1-artifact-id');
    expect(map.story_map_seed_v1?.schema_valid).toBe(true);
    expect(Object.keys(map)).not.toContain('not_a_checklist_artifact');
  });

  it('blocks worker phase entry when checklist-required inputs are missing', () => {
    const decision = assertWorkerPhaseEntry('phase_0_5a', []);

    expect(decision.ok).toBe(false);
    expect(decision.code).toBe('CHECKLIST_REQUIRED_INPUT_MISSING');
  });

  it('allows worker phase entry when required artifacts are usable', () => {
    const decision = assertWorkerPhaseEntry('phase_0_5a', [row('phase0_authority_proof_v1')]);

    expect(decision.ok).toBe(true);
    expect(decision.code).toBe('CHECKLIST_PHASE_MAY_START');
  });

  it('selects last valid resume-safe artifact over newest invalid artifact', () => {
    const selected = selectResumeCheckpoint({
      rows: [
        row('pass12_handoff_v1'),
        row('evaluation_result_v2', { schema_valid: false }),
      ],
    });

    expect(selected.resume_mode).toBe('checklist_resume_safe');
    expect(selected.checkpoint_artifact_type).toBe('pass12_handoff_v1');
    // pass12_handoff_v1 is Phase 2 OUTPUT — resume at phase_3, not phase_2.
    expect(selected.target_phase).toBe('phase_3');
  });

  it('falls back to legacy phase2 handoff when no checklist resume-safe artifact exists', () => {
    const selected = selectResumeCheckpoint({
      rows: [row('evaluation_result_v2', { schema_valid: false })],
      hasLegacyPhase2Handoff: true,
    });

    expect(selected.resume_mode).toBe('phase2_handoff');
    // Legacy handoff also means Phase 2 completed — resume at phase_3.
    expect(selected.target_phase).toBe('phase_3');
  });

  it('falls back to chunk checkpoint before full restart', () => {
    const selected = selectResumeCheckpoint({
      rows: [],
      hasLegacyChunkCheckpoint: true,
    });

    expect(selected.resume_mode).toBe('chunk_checkpoint');
    expect(selected.target_phase).toBe('phase_1a');
  });

  it('uses full restart only when no checklist-safe or legacy checkpoint exists', () => {
    const selected = selectResumeCheckpoint({ rows: [] });

    expect(selected.resume_mode).toBe('full_restart');
    expect(selected.target_phase).toBe('phase_1a');
  });

  // ── Regression: Phase 2/3 loop root cause ─────────────────────────────
  // pass12_handoff_v1 is the FINAL output of Phase 2. When it exists,
  // recovery must target phase_3, never phase_2. The previous mapping
  // (pass12_handoff_v1 → phase_2) caused a crash→replay loop where
  // Phase 3 crashes would route back to Phase 2 unnecessarily.

  it('pass12_handoff_v1 resume targets phase_3, not phase_2 (Phase 2/3 loop regression)', () => {
    const selected = selectResumeCheckpoint({
      rows: [row('pass12_handoff_v1')],
    });

    expect(selected.resume_mode).toBe('checklist_resume_safe');
    expect(selected.checkpoint_artifact_type).toBe('pass12_handoff_v1');
    expect(selected.target_phase).toBe('phase_3');
    expect(selected.target_phase).not.toBe('phase_2');
  });

  it('accepted_story_ledger_v1 resume correctly targets phase_2 (Phase 1A output)', () => {
    const selected = selectResumeCheckpoint({
      rows: [row('accepted_story_ledger_v1')],
    });

    expect(selected.resume_mode).toBe('checklist_resume_safe');
    expect(selected.checkpoint_artifact_type).toBe('accepted_story_ledger_v1');
    expect(selected.target_phase).toBe('phase_2');
  });

  it('evaluation_result_v2 resume targets phase_3 (Phase 3 output)', () => {
    const selected = selectResumeCheckpoint({
      rows: [row('evaluation_result_v2')],
    });

    expect(selected.resume_mode).toBe('checklist_resume_safe');
    expect(selected.checkpoint_artifact_type).toBe('evaluation_result_v2');
    expect(selected.target_phase).toBe('phase_3');
  });

  it('revision_opportunity_ledger_v1 resume targets phase_3', () => {
    const selected = selectResumeCheckpoint({
      rows: [row('revision_opportunity_ledger_v1')],
    });

    expect(selected.resume_mode).toBe('checklist_resume_safe');
    expect(selected.checkpoint_artifact_type).toBe('revision_opportunity_ledger_v1');
    expect(selected.target_phase).toBe('phase_3');
  });

  it('Phase 3 crash with valid handoff + chunk caches resumes at phase_3, not phase_2', () => {
    // Simulates the exact Sister crash scenario:
    // Phase 2 completed (all 3 artifacts exist), Phase 3 crashed.
    const selected = selectResumeCheckpoint({
      rows: [
        row('pass1_chunk_cache_v1'),
        row('pass2_chunk_cache_v1'),
        row('pass12_handoff_v1'),
      ],
      hasLegacyPhase2Handoff: true,
      hasLegacyChunkCheckpoint: true,
    });

    expect(selected.target_phase).toBe('phase_3');
    expect(selected.checkpoint_artifact_type).toBe('pass12_handoff_v1');
  });

  it('legacy handoff fallback also targets phase_3 (not phase_2)', () => {
    // When no checklist-resume-safe artifact matches but legacy handoff exists.
    const selected = selectResumeCheckpoint({
      rows: [],
      hasLegacyPhase2Handoff: true,
    });

    expect(selected.resume_mode).toBe('phase2_handoff');
    expect(selected.target_phase).toBe('phase_3');
  });
});
