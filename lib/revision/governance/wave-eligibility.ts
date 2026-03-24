import type {
  SceneContext,
  WaveEligibilityResult,
  WaveRejectionReason,
  StoryLayer,
  WaveLayerPolicy,
} from './types';

/** Hard waves that cannot run on vignettes or system-exposure scenes */
const HARD_WAVES = new Set(['WAVE3', 'WAVE4', 'WAVE33', 'WAVE34', 'WAVE40']);

/** Layer policies per wave — defines what each wave may touch vs introduce */
const WAVE_LAYER_POLICY: Record<string, WaveLayerPolicy> = {
  WAVE2: { mayTouch: ['HUMAN'], mayIntroduce: ['HUMAN'] },
  WAVE3: { mayTouch: ['HUMAN'], mayIntroduce: ['HUMAN'] },
  WAVE4: { mayTouch: ['HUMAN'], mayIntroduce: ['HUMAN'] },
  WAVE7: { mayTouch: ['HUMAN', 'REALM'], mayIntroduce: ['HUMAN'] },
  WAVE21: { mayTouch: ['HUMAN', 'REALM', 'SCRIPTURE'], mayIntroduce: ['HUMAN'] },
  WAVE28: { mayTouch: ['HUMAN', 'FROG', 'REALM', 'SCRIPTURE'], mayIntroduce: ['HUMAN'] },
  WAVE33: { mayTouch: ['HUMAN'], mayIntroduce: ['HUMAN'] },
  WAVE34: { mayTouch: ['HUMAN'], mayIntroduce: ['HUMAN'] },
  WAVE40: { mayTouch: ['HUMAN'], mayIntroduce: ['HUMAN'] },
  WAVE55: { mayTouch: ['HUMAN', 'FROG', 'REALM', 'SCRIPTURE'], mayIntroduce: ['HUMAN', 'FROG', 'REALM', 'SCRIPTURE'] },
};

function enforceLayerIsolation(sceneLayers: StoryLayer[], proposedLayers: StoryLayer[]): boolean {
  return proposedLayers.every((layer) => sceneLayers.includes(layer));
}

/**
 * Wave Eligibility Gate — FAIL-CLOSED. No partial execution.
 * If ANY wave is rejected, ALL waves are blocked.
 */
export function validateWaveRequest(
  context: SceneContext,
  request: { mode: string; waves: string[]; propagationRequired?: boolean }
): WaveEligibilityResult {
  const allowed: string[] = [];
  const rejected: WaveEligibilityResult['rejected'] = [];

  for (const waveId of request.waves) {
    // Diagnostic mode: never generate patches
    if (request.mode === 'DIAGNOSTIC_ONLY') {
      rejected.push({ waveId, reason: 'MODE_BLOCK', detail: `Wave ${waveId} blocked: DIAGNOSTIC_ONLY mode.` });
      continue;
    }

    // Full rewrite gate
    if (request.mode !== 'FULL_REWRITE' && waveId === 'FULL_SCENE_REWRITE') {
      rejected.push({ waveId, reason: 'MODE_BLOCK', detail: `Wave ${waveId} requires FULL_REWRITE mode.` });
      continue;
    }

    // Propagation gate
    if (!context.propagationRequired && (waveId === 'WAVE3' || waveId === 'WAVE4')) {
      rejected.push({ waveId, reason: 'PROPAGATION_BLOCK', detail: `Wave ${waveId} blocked: propagationRequired=false.` });
      continue;
    }

    // Scene type + function lock
    if (context.sceneType === 'VIGNETTE' && context.sceneFunction === 'SYSTEM_EXPOSURE' && HARD_WAVES.has(waveId)) {
      rejected.push({ waveId, reason: 'SCENE_FUNCTION_BLOCK', detail: `Wave ${waveId} blocked for VIGNETTE+SYSTEM_EXPOSURE.` });
      continue;
    }

    // Layer introduction policy
    const policy = WAVE_LAYER_POLICY[waveId];
    if (policy && !enforceLayerIsolation(context.activeLayers, policy.mayIntroduce)) {
      rejected.push({ waveId, reason: 'LAYER_BLOCK', detail: `Wave ${waveId} may introduce disallowed layers.` });
      continue;
    }

    allowed.push(waveId);
  }

  // FAIL-CLOSED: any rejection means no waves execute
  if (rejected.length > 0) {
    return { allowed: [], rejected, status: 'FAIL' };
  }

  return { allowed, rejected: [], status: 'PASS' };
}
