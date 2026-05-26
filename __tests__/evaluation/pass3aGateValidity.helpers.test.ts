import {
  assertPhase2Preconditions,
  derivePass3aGateValidity,
  deriveReviewGateReadiness,
  type ArtifactSet,
  type PhaseV2Progress,
} from '../../lib/evaluation/stage-machine/hardStopGuards';

const artifact = (id: string) => ({ artifact_id: id, source_hash: `sha256:${id}` });

const baseArtifacts: ArtifactSet = {
  pass1a_story_layer_v1: artifact('story-layer-1'),
  ledger_quality_report_v1: artifact('quality-report-1'),
};

describe('Phase v2 Pass 3A helpers', () => {
  describe('derivePass3aGateValidity', () => {
    it('failed is never gate-valid', () => {
      const progress: PhaseV2Progress = { pass3a_status: 'failed' };
      expect(derivePass3aGateValidity(progress, baseArtifacts)).toBe('gate_blocking');
    });

    it('degraded is gate-valid only with structured proof', () => {
      const missingProof: PhaseV2Progress = {
        pass3a_status: 'degraded',
      };
      const withProof: PhaseV2Progress = {
        pass3a_status: 'degraded',
        degraded_reason: 'PASS3A_REDUCE_TIMEOUT',
        degraded_reason_codes: ['PASS3A_REDUCE_TIMEOUT'],
        degraded_at: '2026-05-26T00:00:00.000Z',
      };

      expect(derivePass3aGateValidity(missingProof, baseArtifacts)).toBe('gate_blocking');
      expect(derivePass3aGateValidity(withProof, baseArtifacts)).toBe('gate_valid');
    });

    it('done without pass3_preflight_draft_v1 is gate-blocking', () => {
      const progress: PhaseV2Progress = {
        pass3a_status: 'done',
        pass3a_completed_at: '2026-05-26T00:00:00.000Z',
      };

      expect(derivePass3aGateValidity(progress, baseArtifacts)).toBe('gate_blocking');
    });
  });

  describe('deriveReviewGateReadiness', () => {
    const doneValidProgress: PhaseV2Progress = {
      pass3a_status: 'done',
      pass3a_completed_at: '2026-05-26T00:00:00.000Z',
    };

    const artifactsWithPass3a: ArtifactSet = {
      ...baseArtifacts,
      pass3_preflight_draft_v1: artifact('pass3-preflight-1'),
    };

    it('requires story layer + quality report + pass3a gate-valid', () => {
      expect(deriveReviewGateReadiness(doneValidProgress, artifactsWithPass3a)).toBe(true);

      expect(
        deriveReviewGateReadiness(doneValidProgress, {
          ledger_quality_report_v1: artifact('quality-report-1'),
          pass3_preflight_draft_v1: artifact('pass3-preflight-1'),
        }),
      ).toBe(false);

      expect(
        deriveReviewGateReadiness(doneValidProgress, {
          pass1a_story_layer_v1: artifact('story-layer-1'),
          pass3_preflight_draft_v1: artifact('pass3-preflight-1'),
        }),
      ).toBe(false);

      expect(
        deriveReviewGateReadiness({ pass3a_status: 'running' }, artifactsWithPass3a),
      ).toBe(false);
    });
  });

  describe('assertPhase2Preconditions', () => {
    const pass3Artifact: ArtifactSet = {
      ...baseArtifacts,
      pass3_preflight_draft_v1: artifact('pass3-preflight-1'),
    };

    it('blocks missing/running/half-written/failed Pass 3A', () => {
      const notReadyStatuses: Array<PhaseV2Progress['pass3a_status']> = [
        undefined,
        'not_started',
        'running',
        'map_done',
        'reduce_running',
      ];

      for (const status of notReadyStatuses) {
        expect(() => assertPhase2Preconditions({ pass3a_status: status }, pass3Artifact)).toThrow(
          'PASS3A_NOT_READY',
        );
      }

      expect(() => assertPhase2Preconditions({ pass3a_status: 'failed' }, pass3Artifact)).toThrow(
        'PASS3A_FAILED_BLOCKING',
      );

      expect(() =>
        assertPhase2Preconditions(
          {
            pass3a_status: 'done',
            pass3a_completed_at: '2026-05-26T00:00:00.000Z',
          },
          baseArtifacts,
        ),
      ).toThrow('PASS3A_ARTIFACT_MISSING');

      expect(() =>
        assertPhase2Preconditions(
          {
            pass3a_status: 'done',
          },
          pass3Artifact,
        ),
      ).toThrow('PASS3A_HALF_WRITTEN');
    });

    it('passes for done with artifact + completion metadata', () => {
      expect(() =>
        assertPhase2Preconditions(
          {
            pass3a_status: 'done',
            pass3a_completed_at: '2026-05-26T00:00:00.000Z',
          },
          pass3Artifact,
        ),
      ).not.toThrow();
    });

    it('passes for degraded only with structured proof', () => {
      expect(() =>
        assertPhase2Preconditions(
          {
            pass3a_status: 'degraded',
            degraded_reason: 'PASS3A_REDUCE_TIMEOUT',
            degraded_reason_codes: ['PASS3A_REDUCE_TIMEOUT'],
            degraded_at: '2026-05-26T00:00:00.000Z',
          },
          baseArtifacts,
        ),
      ).not.toThrow();

      expect(() =>
        assertPhase2Preconditions(
          {
            pass3a_status: 'degraded',
            degraded_reason: 'PASS3A_REDUCE_TIMEOUT',
          },
          baseArtifacts,
        ),
      ).toThrow('PASS3A_DEGRADED_PROOF_MISSING');
    });
  });
});
