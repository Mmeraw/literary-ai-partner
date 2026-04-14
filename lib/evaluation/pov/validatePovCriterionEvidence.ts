import type { PovVoiceCriterionEvidencePack } from "./types";

export function validatePovCriterionEvidence(
  pack: PovVoiceCriterionEvidencePack,
): PovVoiceCriterionEvidencePack {
  const povHasAnchor = pack.pov.findings.some((f) => !!f.anchor?.excerpt?.trim());
  const dialogueHasAnchor = pack.dialogue.findings.some((f) => !!f.anchor?.excerpt?.trim());

  if (!povHasAnchor) {
    return {
      ...pack,
      requiredEvidencePresent: false,
      invalidReason: "MISSING_POV_EVIDENCE",
    };
  }

  if (!dialogueHasAnchor) {
    return {
      ...pack,
      requiredEvidencePresent: false,
      invalidReason: "MISSING_DIALOGUE_EVIDENCE",
    };
  }

  return {
    ...pack,
    requiredEvidencePresent: true,
  };
}
