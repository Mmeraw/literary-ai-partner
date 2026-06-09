import { decideChecklistPublication } from '../../lib/evaluation/phase-architecture-v2/checklistPublicationGate';
import type { ChecklistArtifactState } from '../../lib/evaluation/phase-architecture-v2/checklistEnforcer';

const valid = (artifact_type: ChecklistArtifactState['artifact_type']): ChecklistArtifactState => ({
  artifact_type,
  artifact_id: `${artifact_type}-id`,
  schema_valid: true,
  semantic_status: 'valid',
  is_resume_safe: true,
  checksum: `${artifact_type}-checksum`,
});

describe('checklist publication gate', () => {
  it('routes publication to audit-only when required inputs are missing', () => {
    const decision = decideChecklistPublication({
      phaseId: 'phase_2',
      inputArtifacts: {},
      outputArtifact: valid('pass12_handoff_v1'),
    });

    expect(decision.ok).toBe(false);
    expect(decision.disposition).toBe('saved_for_audit');
    expect(decision.may_mark_usable_downstream).toBe(false);
    expect(decision.may_mark_resume_safe).toBe(false);
  });

  it('refuses resume-safe publication when output artifact is not resume-safe', () => {
    const decision = decideChecklistPublication({
      phaseId: 'phase_2',
      inputArtifacts: {
        accepted_story_ledger_v1: valid('accepted_story_ledger_v1'),
      },
      outputArtifact: {
        ...valid('pass12_handoff_v1'),
        is_resume_safe: false,
      },
    });

    expect(decision.ok).toBe(false);
    expect(decision.disposition).toBe('usable_downstream');
    expect(decision.may_mark_usable_downstream).toBe(true);
    expect(decision.may_mark_resume_safe).toBe(false);
  });

  it('allows resume-safe publication when inputs and output are valid', () => {
    const decision = decideChecklistPublication({
      phaseId: 'phase_2',
      inputArtifacts: {
        accepted_story_ledger_v1: valid('accepted_story_ledger_v1'),
      },
      outputArtifact: valid('pass12_handoff_v1'),
    });

    expect(decision.ok).toBe(true);
    expect(decision.disposition).toBe('resume_safe');
    expect(decision.may_mark_usable_downstream).toBe(true);
    expect(decision.may_mark_resume_safe).toBe(true);
  });
});
