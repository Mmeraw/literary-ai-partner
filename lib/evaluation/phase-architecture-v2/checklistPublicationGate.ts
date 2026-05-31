import {
  assertChecklistPhaseMayStart,
  isArtifactResumeSafe,
  type ChecklistArtifactMap,
  type ChecklistArtifactState,
} from './checklistEnforcer';
import type { ChecklistPhaseId } from './checklistMatrix';

export type ChecklistPublicationDisposition = 'saved_for_audit' | 'usable_downstream' | 'resume_safe';

export type ChecklistPublicationDecision = {
  ok: boolean;
  code: string;
  reason: string;
  phase_id: ChecklistPhaseId;
  disposition: ChecklistPublicationDisposition;
  may_mark_usable_downstream: boolean;
  may_mark_resume_safe: boolean;
};

export function decideChecklistPublication(params: {
  phaseId: ChecklistPhaseId;
  inputArtifacts?: ChecklistArtifactMap;
  outputArtifact: ChecklistArtifactState;
  requestedResumeSafe?: boolean;
}): ChecklistPublicationDecision {
  const inputDecision = assertChecklistPhaseMayStart(params.phaseId, params.inputArtifacts ?? {});

  if (!inputDecision.ok) {
    return {
      ok: false,
      code: inputDecision.code,
      reason: `Publication for ${params.phaseId} is audit-only: ${inputDecision.reason}`,
      phase_id: params.phaseId,
      disposition: 'saved_for_audit',
      may_mark_usable_downstream: false,
      may_mark_resume_safe: false,
    };
  }

  if (!isArtifactResumeSafe(params.outputArtifact)) {
    return {
      ok: false,
      code: 'CHECKLIST_OUTPUT_NOT_RESUME_SAFE',
      reason:
        'Output artifact may be saved for audit but cannot be marked resume-safe until schema, semantic usability, and resume-safe flags are valid.',
      phase_id: params.phaseId,
      disposition: 'usable_downstream',
      may_mark_usable_downstream: true,
      may_mark_resume_safe: false,
    };
  }

  if (params.requestedResumeSafe === false) {
    return {
      ok: true,
      code: 'CHECKLIST_PUBLICATION_USABLE_DOWNSTREAM',
      reason: 'Output artifact is usable downstream but caller did not request resume-safe publication.',
      phase_id: params.phaseId,
      disposition: 'usable_downstream',
      may_mark_usable_downstream: true,
      may_mark_resume_safe: false,
    };
  }

  return {
    ok: true,
    code: 'CHECKLIST_PUBLICATION_RESUME_SAFE',
    reason: 'Output artifact may be marked usable downstream and resume-safe.',
    phase_id: params.phaseId,
    disposition: 'resume_safe',
    may_mark_usable_downstream: true,
    may_mark_resume_safe: true,
  };
}
