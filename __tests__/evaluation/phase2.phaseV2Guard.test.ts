import { guardPhase2Start } from '../../lib/evaluation/phase-architecture-v2/phase2Guard';
import type { PhaseV2ArtifactSet, PhaseV2Progress } from '../../lib/evaluation/phase-architecture-v2/gateValidity';
import type { ChecklistArtifactState } from '../../lib/evaluation/phase-architecture-v2/checklistEnforcer';

const artifact = (id: string) => ({ artifact_id: id, source_hash: `sha256:${id}` });
const checklistArtifact = (artifact_type: ChecklistArtifactState['artifact_type']): ChecklistArtifactState => ({
  artifact_type,
  artifact_id: `${artifact_type}-id`,
  schema_valid: true,
  semantic_status: 'valid',
  is_resume_safe: true,
  checksum: `${artifact_type}-checksum`,
});

const acceptedArtifacts: PhaseV2ArtifactSet = {
  accepted_story_ledger_v1: artifact('accepted-ledger'),
};

const doneProgress: PhaseV2Progress = {
  pass3a_status: 'done',
  pass3a_completed_at: '2026-05-26T00:00:00.000Z',
};

const degradedProgress: PhaseV2Progress = {
  pass3a_status: 'degraded',
  degraded_reason: 'PASS3A_REDUCE_TIMEOUT',
  degraded_reason_codes: ['PASS3A_REDUCE_TIMEOUT'],
  degraded_at: '2026-05-26T00:00:00.000Z',
};

describe('Phase Architecture v2 — Phase 2 guard helper', () => {
  it('blocks Phase 2 without accepted_story_ledger_v1', () => {
    const result = guardPhase2Start(doneProgress, {
      pass3_preflight_draft_v1: artifact('preflight'),
    });

    expect(result.ok).toBe(false);
    expect(result.can_start_phase2).toBe(false);
    expect(result.progress_patch.phase2_preflight_gate).toBe('blocked');
    expect(result.progress_patch.phase2_preflight_gate_code).toBe('PHASE2_STORY_AUTHORITY_MISSING');
  });

  it('blocks Phase 2 for missing/running/half-written/failed Pass 3A', () => {
    for (const status of ['not_started', 'running', 'map_done', 'reduce_running', 'failed'] as const) {
      const result = guardPhase2Start(
        { pass3a_status: status },
        {
          ...acceptedArtifacts,
          pass3_preflight_draft_v1: artifact('preflight'),
        },
      );

      expect(result.ok).toBe(false);
      expect(result.can_start_phase2).toBe(false);
      expect(result.progress_patch.phase2_preflight_gate).toBe('blocked');
      expect(['PASS3A_NOT_READY', 'PASS3A_HALF_WRITTEN', 'PASS3A_FAILED_BLOCKING']).toContain(
        result.progress_patch.phase2_preflight_gate_code,
      );
    }
  });

  it('blocks Phase 2 when done lacks pass3_preflight_draft_v1', () => {
    const result = guardPhase2Start(doneProgress, acceptedArtifacts);

    expect(result.ok).toBe(false);
    expect(result.can_start_phase2).toBe(false);
    expect(result.progress_patch.phase2_preflight_gate_code).toBe('PASS3A_ARTIFACT_MISSING');
    expect(result.progress_patch.pass3a_gate_validity).toBe('gate_blocking');
  });

  it('blocks Phase 2 when done lacks completion metadata', () => {
    const result = guardPhase2Start(
      { pass3a_status: 'done' },
      {
        ...acceptedArtifacts,
        pass3_preflight_draft_v1: artifact('preflight'),
      },
    );

    expect(result.ok).toBe(false);
    expect(result.can_start_phase2).toBe(false);
    expect(result.progress_patch.phase2_preflight_gate_code).toBe('PASS3A_COMPLETION_METADATA_MISSING');
  });

  it('blocks Phase 2 when degraded lacks structured proof', () => {
    const result = guardPhase2Start({ pass3a_status: 'degraded' }, acceptedArtifacts);

    expect(result.ok).toBe(false);
    expect(result.can_start_phase2).toBe(false);
    expect(result.progress_patch.phase2_preflight_gate_code).toBe('PASS3A_DEGRADED_PROOF_MISSING');
  });

  it('allows Phase 2 when accepted ledger and done preflight are valid', () => {
    const result = guardPhase2Start(doneProgress, {
      ...acceptedArtifacts,
      pass3_preflight_draft_v1: artifact('preflight'),
    });

    expect(result.ok).toBe(true);
    expect(result.can_start_phase2).toBe(true);
    expect(result.progress_patch.phase2_preflight_gate).toBe('passed');
    expect(result.progress_patch.phase2_preflight_gate_code).toBe('PHASE2_PRECONDITIONS_SATISFIED');
    expect(result.progress_patch.pass3a_gate_validity).toBe('gate_valid');
  });

  it('allows Phase 2 when accepted ledger and degraded preflight proof are valid', () => {
    const result = guardPhase2Start(degradedProgress, acceptedArtifacts);

    expect(result.ok).toBe(true);
    expect(result.can_start_phase2).toBe(true);
    expect(result.progress_patch.phase2_preflight_gate).toBe('passed');
    expect(result.progress_patch.pass3a_gate_validity).toBe('gate_valid');
  });

  it('blocks Phase 2 when checklist accepted_story_context_v1 is missing', () => {
    const result = guardPhase2Start(
      doneProgress,
      {
        ...acceptedArtifacts,
        pass3_preflight_draft_v1: artifact('preflight'),
      },
      {},
    );

    expect(result.ok).toBe(false);
    expect(result.can_start_phase2).toBe(false);
    expect(result.progress_patch.phase2_preflight_gate_code).toBe('CHECKLIST_REQUIRED_INPUT_MISSING');
  });

  it('allows Phase 2 when legacy preconditions and checklist accepted context are valid', () => {
    const result = guardPhase2Start(
      doneProgress,
      {
        ...acceptedArtifacts,
        pass3_preflight_draft_v1: artifact('preflight'),
      },
      {
        accepted_story_context_v1: checklistArtifact('accepted_story_context_v1'),
      },
    );

    expect(result.ok).toBe(true);
    expect(result.can_start_phase2).toBe(true);
  });
});
