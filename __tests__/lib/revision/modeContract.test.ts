import { deriveReviseEligibilityLabel } from '@/lib/evaluation/modeGate';
import {
  hasExplicitRevisionModeContract,
  modeContractToConfirmedMode,
  normalizeEvaluationMode,
  normalizeVoicePreservationMode,
  policyFamilyForEvaluationMode,
  resolveRevisionModeContract,
  voicePreservationLevelForMode,
  type RevisionModeContract,
} from '@/lib/revision/modeContract';
import type { EvaluationMode, VoicePreservationMode } from '@/lib/evaluation/modeDetection';

const EVALUATION_MODES: EvaluationMode[] = ['STANDARD', 'TRANSGRESSIVE', 'TESTIMONY'];
const VOICE_MODES: VoicePreservationMode[] = ['MAXIMUM', 'BALANCED', 'POLISHED'];

describe('Revision mode contract', () => {
  it('preserves all nine evaluation-mode × voice-preservation cells', () => {
    const cells = EVALUATION_MODES.flatMap((evaluationMode) =>
      VOICE_MODES.map((voicePreservationMode) => ({ evaluationMode, voicePreservationMode })),
    );

    expect(cells).toHaveLength(9);

    for (const cell of cells) {
      const contract = resolveRevisionModeContract({
        evaluationPayload: {
          confirmed_mode: {
            evaluationMode: cell.evaluationMode,
            voicePreservationMode: cell.voicePreservationMode,
          },
        },
        job: {
          policy_family: 'standard',
          voice_preservation_level: 'balanced',
        },
      });

      expect(contract.evaluation_mode).toBe(cell.evaluationMode);
      expect(contract.voice_preservation).toBe(cell.voicePreservationMode);
      expect(contract.source).toBe('evaluation_result_v2.confirmed_mode');
    }
  });

  it('normalizes legacy job row values without flattening to standard/balanced', () => {
    expect(normalizeEvaluationMode('transgressive')).toBe('TRANSGRESSIVE');
    expect(normalizeEvaluationMode('testimony')).toBe('TESTIMONY');
    expect(normalizeEvaluationMode('standard')).toBe('STANDARD');
    expect(normalizeVoicePreservationMode('maximum')).toBe('MAXIMUM');
    expect(normalizeVoicePreservationMode('balanced')).toBe('BALANCED');
    expect(normalizeVoicePreservationMode('polished')).toBe('POLISHED');
    expect(normalizeVoicePreservationMode('strict')).toBe('MAXIMUM');
    expect(normalizeVoicePreservationMode('expressive')).toBe('POLISHED');
  });

  it('maps confirmed mode selections back to persisted job row values', () => {
    expect(policyFamilyForEvaluationMode('STANDARD')).toBe('standard');
    expect(policyFamilyForEvaluationMode('TRANSGRESSIVE')).toBe('transgressive');
    expect(policyFamilyForEvaluationMode('TESTIMONY')).toBe('testimony');
    expect(voicePreservationLevelForMode('MAXIMUM')).toBe('maximum');
    expect(voicePreservationLevelForMode('BALANCED')).toBe('balanced');
    expect(voicePreservationLevelForMode('POLISHED')).toBe('polished');
  });

  it('distinguishes explicit standard/balanced from missing-contract default fallback', () => {
    const explicitStandardBalanced = resolveRevisionModeContract({
      evaluationPayload: null,
      job: {
        policy_family: 'standard',
        voice_preservation_level: 'balanced',
      },
    });
    const missingContractFallback = resolveRevisionModeContract({
      evaluationPayload: null,
      job: null,
    });

    expect(explicitStandardBalanced.evaluation_mode).toBe('STANDARD');
    expect(explicitStandardBalanced.voice_preservation).toBe('BALANCED');
    expect(hasExplicitRevisionModeContract(explicitStandardBalanced)).toBe(true);

    expect(missingContractFallback.evaluation_mode).toBe('STANDARD');
    expect(missingContractFallback.voice_preservation).toBe('BALANCED');
    expect(hasExplicitRevisionModeContract(missingContractFallback)).toBe(false);
  });

  it('keeps TrustedPath eligible only for standard/balanced or standard/polished contracts', () => {
    const labels: Record<string, string> = {};

    for (const evaluationMode of EVALUATION_MODES) {
      for (const voicePreservation of VOICE_MODES) {
        const contract: RevisionModeContract = {
          evaluation_mode: evaluationMode,
          voice_preservation: voicePreservation,
          source: 'evaluation_result_v2.confirmed_mode',
          policy_family: policyFamilyForEvaluationMode(evaluationMode),
          voice_preservation_level: voicePreservationLevelForMode(voicePreservation),
        };
        labels[`${evaluationMode}/${voicePreservation}`] = deriveReviseEligibilityLabel({
          confirmedMode: modeContractToConfirmedMode(contract),
        });
      }
    }

    expect(labels['STANDARD/BALANCED']).toBe('Eligible for Trustpath');
    expect(labels['STANDARD/POLISHED']).toBe('Eligible for Trustpath');
    expect(labels['STANDARD/MAXIMUM']).toBe('Manual only — Voice Preservation (Maximum)');
    expect(labels['TRANSGRESSIVE/BALANCED']).toBe('Eligible for Trustpath');
    expect(labels['TRANSGRESSIVE/POLISHED']).toBe('Eligible for Trustpath');
    expect(labels['TRANSGRESSIVE/MAXIMUM']).toBe('Manual only — Voice Preservation (Maximum)');
    expect(labels['TESTIMONY/MAXIMUM']).toBe('Manual only — Testimony guardrail');
    expect(labels['TESTIMONY/BALANCED']).toBe('Manual only — Testimony guardrail');
    expect(labels['TESTIMONY/POLISHED']).toBe('Manual only — Testimony guardrail');
  });
});
