import {
  CHECKLIST_MATRIX,
  getChecklistRow,
  type ChecklistArtifactType,
  type ChecklistPhaseId,
  type ChecklistMatrixRow,
} from './checklistMatrix';

export type ChecklistArtifactState = {
  artifact_type: ChecklistArtifactType;
  artifact_id?: string | null;
  schema_valid?: boolean | null;
  semantic_status?: 'valid' | 'degraded_with_reasons' | 'blocked' | 'failed' | 'unknown' | null;
  is_resume_safe?: boolean | null;
  blocking_reason_codes?: readonly string[] | null;
  checksum?: string | null;
};

export type ChecklistArtifactMap = Partial<Record<ChecklistArtifactType, ChecklistArtifactState | null | undefined>>;

export type ChecklistDecision = {
  ok: boolean;
  code: string;
  reason: string;
  phase_id: ChecklistPhaseId;
  required_inputs: readonly ChecklistArtifactType[];
  missing_inputs: ChecklistArtifactType[];
  invalid_inputs: ChecklistArtifactType[];
};

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasReasonCodes(value: unknown): boolean {
  return Array.isArray(value) && value.some(hasText);
}

export function isArtifactUsableForPhaseInput(artifact: ChecklistArtifactState | null | undefined): boolean {
  if (!artifact) return false;
  if (!hasText(artifact.artifact_id)) return false;
  if (artifact.schema_valid !== true) return false;

  if (artifact.semantic_status === 'valid') return true;

  if (artifact.semantic_status === 'degraded_with_reasons') {
    return hasReasonCodes(artifact.blocking_reason_codes);
  }

  return false;
}

export function isArtifactResumeSafe(artifact: ChecklistArtifactState | null | undefined): boolean {
  return isArtifactUsableForPhaseInput(artifact) && artifact?.is_resume_safe === true;
}

export function assertChecklistPhaseMayStart(
  phaseId: ChecklistPhaseId,
  artifacts: ChecklistArtifactMap = {},
): ChecklistDecision {
  const row = getChecklistRow(phaseId);
  const missingInputs: ChecklistArtifactType[] = [];
  const invalidInputs: ChecklistArtifactType[] = [];

  for (const requiredType of row.required_inputs) {
    const artifact = artifacts[requiredType];
    if (!artifact) {
      missingInputs.push(requiredType);
      continue;
    }

    if (!isArtifactUsableForPhaseInput(artifact)) {
      invalidInputs.push(requiredType);
    }
  }

  if (row.required_authority_proof) {
    const authority = artifacts.phase0_authority_proof_v1;
    if (!authority) {
      if (!missingInputs.includes('phase0_authority_proof_v1')) {
        missingInputs.push('phase0_authority_proof_v1');
      }
    } else if (!isArtifactUsableForPhaseInput(authority)) {
      if (!invalidInputs.includes('phase0_authority_proof_v1')) {
        invalidInputs.push('phase0_authority_proof_v1');
      }
    }
  }

  if (missingInputs.length > 0) {
    return {
      ok: false,
      code: 'CHECKLIST_REQUIRED_INPUT_MISSING',
      reason: `Phase ${phaseId} cannot start: missing required artifact(s): ${missingInputs.join(', ')}.`,
      phase_id: phaseId,
      required_inputs: row.required_inputs,
      missing_inputs: missingInputs,
      invalid_inputs: invalidInputs,
    };
  }

  if (invalidInputs.length > 0) {
    return {
      ok: false,
      code: 'CHECKLIST_REQUIRED_INPUT_INVALID',
      reason: `Phase ${phaseId} cannot start: invalid required artifact(s): ${invalidInputs.join(', ')}.`,
      phase_id: phaseId,
      required_inputs: row.required_inputs,
      missing_inputs: missingInputs,
      invalid_inputs: invalidInputs,
    };
  }

  return {
    ok: true,
    code: 'CHECKLIST_PHASE_MAY_START',
    reason: `Phase ${phaseId} may start: checklist inputs satisfied.`,
    phase_id: phaseId,
    required_inputs: row.required_inputs,
    missing_inputs: [],
    invalid_inputs: [],
  };
}

export function selectLastResumeSafeArtifact(
  artifactsInPublicationOrder: readonly ChecklistArtifactState[],
): ChecklistArtifactState | null {
  for (let index = artifactsInPublicationOrder.length - 1; index >= 0; index -= 1) {
    const artifact = artifactsInPublicationOrder[index];
    if (isArtifactResumeSafe(artifact)) {
      return artifact;
    }
  }

  return null;
}

export function checklistRowsRequiringAuthorityProof(): ChecklistMatrixRow[] {
  return CHECKLIST_MATRIX.filter((row) => row.required_authority_proof);
}
