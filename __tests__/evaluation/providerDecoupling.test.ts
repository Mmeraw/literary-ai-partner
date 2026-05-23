import { getArtifactRegistryEntry } from '../../lib/evaluation/artifacts/artifactRegistry';
import {
  EXTERNAL_VERIFICATION_TEXT_CAP,
  assertExternalReportCrosscheckBounds,
  capExternalVerificationText,
  type ExternalReportCrosscheckV1,
} from '../../lib/evaluation/artifacts/verificationSchemas';
import { DEFAULT_VERIFICATION_FLAGS } from '../../lib/evaluation/orchestration/providerContracts';
import {
  compileFinalSynthesis,
  type SynthesisInputPayload,
} from '../../lib/evaluation/processor/synthesisGate';

const crosscheckArtifact: ExternalReportCrosscheckV1 = {
  envelope: {
    job_id: 'job_test_001',
    evaluation_project_id: 'eval_proj_test_001',
    manuscript_id: 42,
    manuscript_version_hash: 'sha256:fakehash',
    artifact_id: 'crosscheck_test_001',
    artifact_type: 'external_report_crosscheck_v1',
    artifact_version: 'v1',
    source_hash: 'sha256:sourcefake',
    generated_at: '2026-05-22T12:00:00.000Z',
  },
  verdict: 'FAIL',
  crosscheck_timestamp: '2026-05-22T12:01:00.000Z',
  violations: [
    {
      rule_id: 'forbidden_terminology',
      offending_text_snippet: 'The report displayed an internal chunk label to the user.',
      contradicted_ledger_layer: 1,
      reason_code: 'ERR_FORBIDDEN_WORD_CHUNK',
      reason_summary: 'Report used forbidden internal terminology.',
    },
  ],
};

describe('PR9 provider role isolation and verification boundaries', () => {
  it('defaults external verification rails off', () => {
    expect(DEFAULT_VERIFICATION_FLAGS).toEqual({
      ENABLE_EXTERNAL_FACT_AUDIT: false,
      ENABLE_EXTERNAL_REPORT_CROSSCHECK: false,
    });
  });

  it('compiles final synthesis when driven exclusively by primary_editorial_engine', () => {
    const validInputs: SynthesisInputPayload[] = [
      {
        provider: 'primary_editorial_engine',
        content: 'Clean, deep literary analysis text derived from accepted_story_ledger_v1.',
      },
    ];

    expect(compileFinalSynthesis(validInputs)).toContain('literary analysis text');
  });

  it('hard-blocks external_factual_auditor prose from Phase 3 synthesis', () => {
    const contaminatedInputs: SynthesisInputPayload[] = [
      {
        provider: 'primary_editorial_engine',
        content: 'Valid ChatGPT craft evaluation report.',
      },
      {
        provider: 'external_factual_auditor',
        content: 'Unstructured secondary opinion text that could contaminate synthesis.',
      },
    ];

    expect(() => compileFinalSynthesis(contaminatedInputs)).toThrow(
      /Security Gate Violation: Unsanctioned provider input detected in Phase 3 synthesis/,
    );
  });

  it('hard-blocks external_compliance_checker prose from Phase 3 synthesis', () => {
    const contaminatedInputs: SynthesisInputPayload[] = [
      {
        provider: 'primary_editorial_engine',
        content: 'Valid ChatGPT craft evaluation report.',
      },
      {
        provider: 'external_compliance_checker',
        content: 'Compliance prose must not be merged into the final report.',
      },
    ];

    expect(() => compileFinalSynthesis(contaminatedInputs)).toThrow(/external_compliance_checker/);
  });

  it('requires exactly one primary editorial input', () => {
    expect(() => compileFinalSynthesis([])).toThrow(/Missing input from primary_editorial_engine/);
    expect(() => compileFinalSynthesis([
      { provider: 'primary_editorial_engine', content: 'first' },
      { provider: 'primary_editorial_engine', content: 'second' },
    ])).toThrow(/Expected exactly one primary_editorial_engine input/);
  });

  it('keeps external report crosscheck bounded to structured violations', () => {
    expect(crosscheckArtifact.verdict).toBe('FAIL');
    expect(crosscheckArtifact.violations[0].reason_code).toBe('ERR_FORBIDDEN_WORD_CHUNK');
    expect(() => assertExternalReportCrosscheckBounds(crosscheckArtifact)).not.toThrow();
  });

  it('enforces text caps for external verification payloads', () => {
    const oversized = 'x'.repeat(EXTERNAL_VERIFICATION_TEXT_CAP + 1);
    const capped = capExternalVerificationText(oversized);

    expect(capped).toHaveLength(EXTERNAL_VERIFICATION_TEXT_CAP);
    expect(() => assertExternalReportCrosscheckBounds({
      ...crosscheckArtifact,
      violations: [
        {
          ...crosscheckArtifact.violations[0],
          reason_summary: oversized,
        },
      ],
    })).toThrow(/reason_summary must be 500 characters or fewer/);
  });

  it('registers verification artifacts as external verification, not story authority', () => {
    expect(getArtifactRegistryEntry('factual_anomalies_detected_v1')).toMatchObject({
      authority: 'external_verification',
      phase: 'phase_0_calibration',
      phase2StoryAuthority: false,
      createsStoryLayer: false,
    });
    expect(getArtifactRegistryEntry('external_report_crosscheck_v1')).toMatchObject({
      authority: 'external_verification',
      phase: 'phase_4_cross_check',
      phase2StoryAuthority: false,
      createsStoryLayer: false,
    });
  });
});
