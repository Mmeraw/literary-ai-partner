import { deriveWaveRevisionProof } from './waveRevisionProof';
import type { WaveRevisionPlanArtifact, WaveRunRecord } from '../waveRevision';

export type WaveProofProgressPatch = {
  wave_revision_status: 'complete' | 'skipped' | 'timeout' | 'failed' | 'missing';
  wave_revision_proof_ok: boolean;
  wave_revision_proof_code: string;
  wave_revision_proof_reason: string;
  quality_gate_label: 'Quality Gate';
  wave_label: 'WAVE Revision';
};

/**
 * Converts WAVE proof validation into a safe progress patch.
 *
 * This helper intentionally does not run WAVE and does not mutate jobs. Runtime
 * callers can persist the returned patch after WAVE execution/skipping so WAVE
 * never silently no-ops and is never confused with deterministic Quality Gate.
 */
export function buildWaveProofProgressPatch(
  plan?: WaveRevisionPlanArtifact | null,
  runRecord?: WaveRunRecord | null,
): WaveProofProgressPatch {
  const decision = deriveWaveRevisionProof(plan, runRecord);

  return {
    wave_revision_status: decision.status,
    wave_revision_proof_ok: decision.ok,
    wave_revision_proof_code: decision.code,
    wave_revision_proof_reason: decision.reason,
    quality_gate_label: decision.quality_gate_label,
    wave_label: decision.wave_label,
  };
}
