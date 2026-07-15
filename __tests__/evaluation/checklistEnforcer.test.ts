import {
  CHECKLIST_MATRIX,
  SIPOC_STAGE_REFS,
} from '../../lib/evaluation/phase-architecture-v2/checklistMatrix';
import {
  assertChecklistPhaseMayStart,
  isArtifactResumeSafe,
  selectLastResumeSafeArtifact,
  checklistRowsRequiringAuthorityProof,
  type ChecklistArtifactState,
} from '../../lib/evaluation/phase-architecture-v2/checklistEnforcer';

const valid = (artifact_type: ChecklistArtifactState['artifact_type']): ChecklistArtifactState => ({
  artifact_type,
  artifact_id: `${artifact_type}-id`,
  schema_valid: true,
  semantic_status: 'valid',
  is_resume_safe: true,
  checksum: `${artifact_type}-checksum`,
});

describe('Phase Architecture v2 checklist-as-code enforcer', () => {
  it('binds every checklist row to an allowed SIPOC stage reference', () => {
    const allowed = new Set<string>(SIPOC_STAGE_REFS);

    expect(CHECKLIST_MATRIX.length).toBeGreaterThan(0);
    for (const row of CHECKLIST_MATRIX) {
      expect(allowed.has(row.sipoc_stage_ref)).toBe(true);
    }
  });

  it('keeps Phase 0.5 and Revise/WAVE rows adjacent rather than pretending they are certified S01-S11 spine stages', () => {
    expect(CHECKLIST_MATRIX.find((row) => row.phase_id === 'phase_0_5a')?.sipoc_stage_ref).toBe(
      'ADJACENT_PHASE_0_5A',
    );
    expect(CHECKLIST_MATRIX.find((row) => row.phase_id === 'phase_0_5b')?.sipoc_stage_ref).toBe(
      'ADJACENT_PHASE_0_5B',
    );
    expect(CHECKLIST_MATRIX.find((row) => row.phase_id === 'revise_admission')?.sipoc_stage_ref).toBe(
      'ADJACENT_REVISE',
    );
    expect(CHECKLIST_MATRIX.find((row) => row.phase_id === 'wave')?.sipoc_stage_ref).toBe(
      'ADJACENT_WAVE',
    );
  });

  it('blocks Phase 0.5A without phase0_authority_proof_v1', () => {
    const result = assertChecklistPhaseMayStart('phase_0_5a', {});

    expect(result.ok).toBe(false);
    expect(result.code).toBe('CHECKLIST_REQUIRED_INPUT_MISSING');
    expect(result.missing_inputs).toContain('phase0_authority_proof_v1');
  });

  it('blocks Phase 0.5B without phase0_authority_proof_v1', () => {
    const result = assertChecklistPhaseMayStart('phase_0_5b', {});

    expect(result.ok).toBe(false);
    expect(result.code).toBe('CHECKLIST_REQUIRED_INPUT_MISSING');
    expect(result.missing_inputs).toContain('phase0_authority_proof_v1');
  });

  it('allows Phase 0.5A when authority proof is valid', () => {
    const result = assertChecklistPhaseMayStart('phase_0_5a', {
      phase0_authority_proof_v1: valid('phase0_authority_proof_v1'),
    });

    expect(result.ok).toBe(true);
    expect(result.code).toBe('CHECKLIST_PHASE_MAY_START');
  });

  it('blocks Phase 1A without seed artifacts but not phase0_authority_proof_v1', () => {
    const result = assertChecklistPhaseMayStart('phase_1a', {
      phase0_authority_proof_v1: valid('phase0_authority_proof_v1'),
    });

    expect(result.ok).toBe(false);
    expect(result.missing_inputs).toContain('story_map_seed_v1');
    expect(result.missing_inputs).toContain('evaluation_seed_v1');
    expect(result.missing_inputs).not.toContain('phase0_authority_proof_v1');
  });

  it('allows Phase 1A with complete seeds and no phase0_authority_proof_v1 artifact', () => {
    const result = assertChecklistPhaseMayStart('phase_1a', {
      story_map_seed_v1: valid('story_map_seed_v1'),
      evaluation_seed_v1: valid('evaluation_seed_v1'),
    });

    expect(result.ok).toBe(true);
    expect(result.code).toBe('CHECKLIST_PHASE_MAY_START');
  });

  it('blocks Phase 2 without accepted_story_ledger_v1', () => {
    const result = assertChecklistPhaseMayStart('phase_2', {});

    expect(result.ok).toBe(false);
    expect(result.missing_inputs).toContain('accepted_story_ledger_v1');
  });

  it('requires degraded artifacts to carry reason codes before use', () => {
    const degradedWithoutProof: ChecklistArtifactState = {
      artifact_type: 'phase0_authority_proof_v1',
      artifact_id: 'authority-id',
      schema_valid: true,
      semantic_status: 'degraded_with_reasons',
      is_resume_safe: true,
      blocking_reason_codes: [],
    };

    const result = assertChecklistPhaseMayStart('phase_0_5a', {
      phase0_authority_proof_v1: degradedWithoutProof,
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('CHECKLIST_REQUIRED_INPUT_INVALID');
  });

  it('selects the last valid resume-safe artifact, not the newest artifact', () => {
    const older = valid('pass12_handoff_v1');
    const newestInvalid: ChecklistArtifactState = {
      artifact_type: 'evaluation_result_v2',
      artifact_id: 'evaluation-result-id',
      schema_valid: false,
      semantic_status: 'valid',
      is_resume_safe: true,
    };

    expect(selectLastResumeSafeArtifact([older, newestInvalid])).toBe(older);
  });

  it('does not treat usable but non-resume-safe artifacts as resume points', () => {
    const usableButNotResumeSafe: ChecklistArtifactState = {
      ...valid('evaluation_result_v2'),
      is_resume_safe: false,
    };

    expect(isArtifactResumeSafe(usableButNotResumeSafe)).toBe(false);
    expect(selectLastResumeSafeArtifact([usableButNotResumeSafe])).toBeNull();
  });

  it('declares only Phase 0.5 seed rows as authority-proof required in the initial slice', () => {
    expect(checklistRowsRequiringAuthorityProof().map((row) => row.phase_id)).toEqual([
      'phase_0_5a',
      'phase_0_5b',
    ]);
  });
});
