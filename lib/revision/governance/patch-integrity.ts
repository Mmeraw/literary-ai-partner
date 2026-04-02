import type {
  GovernanceContext,
  GovernanceResult,
  PatchValidationResult,
  ProposedPatch,
  SceneContext,
  StoryLayer,
  WaveId,
} from './types';

function enforceLayerIsolation(sceneLayers: StoryLayer[], proposedLayers: StoryLayer[]): boolean {
  return proposedLayers.every((layer) => sceneLayers.includes(layer));
}

function addsEnvironmentalAgency(patchText: string): boolean {
  const patterns = [
    /water didn't move/i,
    /sheen held longer/i,
    /near the shoreline stilled/i,
    /surface held/i,
  ];
  return patterns.some((p) => p.test(patchText));
}

function addsMoralInterpretation(patchText: string): boolean {
  const patterns = [
    /was clear that/i,
    /showed that/i,
    /lesson was/i,
    /failed to understand/i,
  ];
  return patterns.some((p) => p.test(patchText));
}

function violatesIntent(patchText: string, context: SceneContext): boolean {
  if (context.sceneType === 'VIGNETTE' && context.sceneFunction === 'SYSTEM_EXPOSURE') {
    if (addsEnvironmentalAgency(patchText)) return true;
    if (addsMoralInterpretation(patchText)) return true;
  }
  return false;
}

/**
 * Post-patch validation: catches layer leakage, environmental agency,
 * and moral interpretation even after an allowed wave executes.
 */
export function validatePatchIntegrity(
  patch: ProposedPatch,
  context: SceneContext
): PatchValidationResult {
  const violations: PatchValidationResult['violations'] = [];

  if (!enforceLayerIsolation(context.activeLayers, patch.introducedLayers)) {
    violations.push({
      reason: 'LAYER_BLOCK',
      detail: 'Patch introduces layers not active in this scene.',
    });
  }

  if (violatesIntent(patch.text, context)) {
    violations.push({
      reason: 'INTENT_LOCK_BLOCK',
      detail: 'Patch violates declared scene intent.',
    });
  }

  return { valid: violations.length === 0, violations };
}

/**
 * Pipeline compatibility stub for run-revision-pipeline.ts.
 *
 * NOTE:
 * - This adapter preserves the API expected by current pipeline callers.
 * - It is intentionally permissive until the pipeline is fully wired to produce
 *   the ProposedPatch/SceneContext inputs required by validatePatchIntegrity().
 */
export function checkPatchIntegrity(
  _ctx: GovernanceContext,
  _waveId: WaveId,
  _sceneText: string,
  _patch: string
): GovernanceResult {
  return {
    pass: true,
    reason: 'Patch integrity compatibility stub — always passes until wired',
  };
}
