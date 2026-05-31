import {
  assertManuscriptReadingTracksMayStart,
  assertPass3aMayStart,
  assertPhase05aMayStart,
  assertPhase05bMayStart,
  assertPhase1aMayStart,
  assertPhase1aSeedVerificationMayStart,
} from '../../lib/evaluation/phase-architecture-v2/readinessGuards';
import type { ChecklistArtifactState } from '../../lib/evaluation/phase-architecture-v2/checklistEnforcer';

const valid = (artifact_type: ChecklistArtifactState['artifact_type']): ChecklistArtifactState => ({
  artifact_type,
  artifact_id: `${artifact_type}-id`,
  schema_valid: true,
  semantic_status: 'valid',
  is_resume_safe: true,
  checksum: `${artifact_type}-checksum`,
});

describe('Phase Architecture v2 — manuscript-reading readiness guards', () => {
  it('blocks manuscript-reading tracks before Phase 0 completes', () => {
    const result = assertManuscriptReadingTracksMayStart({
      phase0_status: 'running',
      chunk_manifest_status: 'done',
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('PHASE0_NOT_COMPLETE');
  });

  it('blocks manuscript-reading tracks before chunk manifest is durable', () => {
    const result = assertManuscriptReadingTracksMayStart({
      phase0_status: 'done',
      chunk_manifest_status: 'running',
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('CHUNK_MANIFEST_NOT_DURABLE');
  });

  it('allows manuscript-reading tracks only after Phase 0 and chunk manifest are complete', () => {
    const result = assertManuscriptReadingTracksMayStart({
      phase0_status: 'done',
      chunk_manifest_status: 'done',
    });

    expect(result.ok).toBe(true);
    expect(result.code).toBe('MANUSCRIPT_READING_TRACKS_READY');
  });

  it('blocks Phase 0.5A without authority proof', () => {
    const result = assertPhase05aMayStart({
      phase0_status: 'complete',
      chunk_manifest_status: 'complete',
      checklist_artifacts: {},
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('CHECKLIST_REQUIRED_INPUT_MISSING');
  });

  it('blocks Phase 0.5B without authority proof', () => {
    const result = assertPhase05bMayStart({
      phase0_status: 'complete',
      chunk_manifest_status: 'complete',
      checklist_artifacts: {},
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('CHECKLIST_REQUIRED_INPUT_MISSING');
  });

  it('allows Phase 0.5A when authority proof is valid', () => {
    const result = assertPhase05aMayStart({
      phase0_status: 'complete',
      chunk_manifest_status: 'complete',
      checklist_artifacts: {
        phase0_authority_proof_v1: valid('phase0_authority_proof_v1'),
      },
    });

    expect(result.ok).toBe(true);
    expect(result.code).toBe('CHECKLIST_PHASE_MAY_START');
  });

  it('allows Phase 1A from the shared readiness rule when no checklist artifacts are supplied for legacy callers', () => {
    const result = assertPhase1aMayStart({
      phase0_status: 'complete',
      chunk_manifest_status: 'complete',
    });

    expect(result.ok).toBe(true);
    expect(result.code).toBe('PHASE1A_MAY_START');
  });

  it('blocks Phase 1A seed verification without story_map_seed_v1 when checklist artifacts are supplied', () => {
    const result = assertPhase1aSeedVerificationMayStart({
      phase0_status: 'complete',
      chunk_manifest_status: 'complete',
      checklist_artifacts: {
        phase0_authority_proof_v1: valid('phase0_authority_proof_v1'),
      },
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('CHECKLIST_REQUIRED_INPUT_MISSING');
  });

  it('allows Pass 3A from the shared readiness rule', () => {
    const result = assertPass3aMayStart({
      phase0_status: 'completed',
      chunk_manifest_status: 'completed',
    });

    expect(result.ok).toBe(true);
    expect(result.code).toBe('PASS3A_MAY_START');
  });
});
