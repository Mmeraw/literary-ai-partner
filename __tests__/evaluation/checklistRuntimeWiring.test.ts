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
    expect(selected.target_phase).toBe('phase_2');
  });

  it('falls back to legacy phase2 handoff when no checklist resume-safe artifact exists', () => {
    const selected = selectResumeCheckpoint({
      rows: [row('evaluation_result_v2', { schema_valid: false })],
      hasLegacyPhase2Handoff: true,
    });

    expect(selected.resume_mode).toBe('phase2_handoff');
    expect(selected.target_phase).toBe('phase_2');
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
});
