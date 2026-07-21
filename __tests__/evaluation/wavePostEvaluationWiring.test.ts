/**
 * Issue #737 — Verify WAVE Revision post-evaluation wiring.
 *
 * Acceptance criteria from the issue:
 * 1. Production evaluation path produces evaluation_result_v2
 * 2. Runs deterministic Quality Gate
 * 3. Runs or schedules WAVE Revision for eligible long-form manuscripts
 * 4. Persists WAVE output/proof (wave_revision_plan_v1 + metadata)
 * 5. WAVE is not confused with Quality Gate
 * 6. Short-form/ineligible manuscripts get explicit skip reasons
 *
 * These are architecture invariant tests verified against processor.ts source.
 */
import * as fs from 'fs';
import * as path from 'path';

const PROCESSOR_PATH = path.resolve(__dirname, '../../lib/evaluation/processor.ts');
const processorSource = fs.readFileSync(PROCESSOR_PATH, 'utf-8');

const WAVE_PROOF_PATH = path.resolve(__dirname, '../../lib/evaluation/phase-architecture-v2/waveRevisionProof.ts');
const waveProofSource = fs.readFileSync(WAVE_PROOF_PATH, 'utf-8');

describe('Issue #737 — WAVE Revision post-evaluation wiring verification', () => {
  describe('1. WAVE runs AFTER evaluation completion (post-persistEvaluationResultV2)', () => {
    it('WAVE eligibility check occurs after atomic completion RPC', () => {
      const completionIdx = processorSource.indexOf('persistEvaluationResultV2');
      const waveEligibleIdx = processorSource.indexOf('isWaveEligible');
      expect(completionIdx).toBeGreaterThan(-1);
      expect(waveEligibleIdx).toBeGreaterThan(-1);
      // WAVE eligibility is checked AFTER the evaluation is persisted
      expect(waveEligibleIdx).toBeGreaterThan(completionIdx);
    });

    it('WAVE has a 60-second timeout cap (non-fatal)', () => {
      const waveExecutions = Array.from(
        processorSource.matchAll(/executeWaveRevision\(/g),
        match => match.index,
      );

      expect(waveExecutions).toHaveLength(2);
      for (const executionIndex of waveExecutions) {
        const managedCall = processorSource.slice(
          Math.max(0, executionIndex - 150),
          executionIndex + 350,
        );
        expect(managedCall).toContain('withManagedTimeout(');
        expect(managedCall).toContain('60_000');
        expect(managedCall).toContain("throw new Error('WAVE_TIMEOUT')");
      }
    });

    it('WAVE failure never fails the evaluation — base evaluation is the paid product', () => {
      expect(processorSource).toContain('WAVE never fails the evaluation');
      // After WAVE error, job still returns success
      const waveErrorSection = processorSource.slice(
        processorSource.indexOf('WAVE never fails the evaluation'),
        processorSource.indexOf('WAVE never fails the evaluation') + 2000
      );
      expect(waveErrorSection).toContain('return { success: true }');
    });
  });

  describe('2. WAVE eligibility gate (long-form only)', () => {
    it('requires word count >= WAVE_MIN_WORDS (25,000)', () => {
      expect(processorSource).toContain('WAVE_MIN_WORDS');
      expect(processorSource).toContain('coverageWords >= WAVE_MIN_WORDS');
    });

    it('requires all 13 criteria to meet minimum score', () => {
      expect(processorSource).toContain('WAVE_MIN_CRITERION_SCORE');
      expect(processorSource).toContain('finalScores.length === 13');
    });

    it('requires CharacterLedgerV2 from Phase 1A', () => {
      expect(processorSource).toContain('isWaveEligibleLedger');
      expect(processorSource).toContain('!!pipelineResult.characterLedgerV2');
    });

    it('all three gates must pass for WAVE to run', () => {
      expect(processorSource).toContain(
        'isWaveEligibleWord && isWaveEligibleCriteria && isWaveEligibleLedger'
      );
    });
  });

  describe('3. WAVE persists wave_revision_plan_v1 artifact', () => {
    it('persists artifact on success', () => {
      // The persist call is nearby (within the block)
      const persistIdx = processorSource.indexOf("artifactType: 'wave_revision_plan_v1'");
      expect(persistIdx).toBeGreaterThan(-1);
    });

    it('persists failure artifact with reason_code on WAVE error', () => {
      expect(processorSource).toContain("status: 'failed' as const");
      expect(processorSource).toContain('reason_code: reasonCode');
      // Failure artifact still uses wave_revision_plan_v1 type
      const failSection = processorSource.slice(
        processorSource.indexOf("status: 'failed' as const"),
        processorSource.indexOf("status: 'failed' as const") + 1500
      );
      expect(failSection).toContain("artifactType: 'wave_revision_plan_v1'");
    });

    it('persists failed artifact when synthesis is missing (explicit skip)', () => {
      expect(processorSource).toContain("reason_code: 'PHASE3_SYNTHESIS_MISSING'");
      expect(processorSource).toContain(
        'Evaluation result artifact missing or has no synthesis'
      );
    });

    it('handles all WAVE error reason codes', () => {
      expect(processorSource).toContain("'WAVE_TIMEOUT'");
      expect(processorSource).toContain("'WAVE_SOURCE_VERSION_RESOLUTION_FAILED'");
      expect(processorSource).toContain("'WAVE_SESSION_CREATE_FAILED'");
      expect(processorSource).toContain("'WAVE_ERROR'");
    });
  });

  describe('4. WAVE is NOT confused with Quality Gate', () => {
    it('waveRevisionProof.ts labels are explicitly distinct', () => {
      expect(waveProofSource).toContain("quality_gate_label: 'Quality Gate'");
      expect(waveProofSource).toContain("wave_label: 'WAVE Readiness Layer'");
    });

    it('WAVE proof module docstring explicitly separates concerns', () => {
      expect(waveProofSource).toContain('WAVE is the long-form readiness / revision-planning analysis layer');
      expect(waveProofSource).toContain('It is not Pass 4');
      expect(waveProofSource).toContain('It is not the Revise workflow');
    });

    it('Canon Governance advisory runner does NOT downgrade lifecycle after WAVE', () => {
      // Find the canon governance section after WAVE
      const canonGovIdx = processorSource.indexOf('Canon Governance Runner (advisory');
      expect(canonGovIdx).toBeGreaterThan(-1);
      const canonGovSection = processorSource.slice(canonGovIdx, canonGovIdx + 500);
      // Must state it's advisory only
      expect(canonGovSection).toContain('advisory');
      // Must NOT contain lifecycle mutation in its immediate block
      expect(canonGovSection).not.toContain('markFailed');
      expect(canonGovSection).not.toContain('quality_issue_detected');
    });
  });

  describe('5. WAVE runs in both Phase 3 entry points', () => {
    it('WAVE runs in the dedicated Phase 3 cron path', () => {
      expect(processorSource).toContain('[WAVE/Phase3] Artifacts persisted');
    });

    it('WAVE runs inline when Phase 3 completes during Phase 2', () => {
      expect(processorSource).toContain('[WAVE/Phase3-inline] Artifact persisted');
    });

    it('both paths use the same wave_revision_plan_v1 artifact type', () => {
      const matches = processorSource.match(/artifactType: 'wave_revision_plan_v1'/g);
      // Multiple persist calls across both paths (success + failure + inline)
      expect(matches!.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('6. Final External Audit treats WAVE as optional (warn, not block)', () => {
    const AUDIT_PATH = path.resolve(__dirname, '../../lib/evaluation/pipeline/finalExternalAudit.ts');
    const auditSource = fs.readFileSync(AUDIT_PATH, 'utf-8');

    it('WAVE artifact absence is WARN not BLOCK in final audit', () => {
      expect(auditSource).toContain('wave_revision_plan_v1 — written by main processor; missing = WARN, not BLOCK');
    });

    it('missing WAVE emits FINAL_AUDIT_MISSING_WAVE code (advisory)', () => {
      expect(auditSource).toContain('FINAL_AUDIT_MISSING_WAVE');
    });
  });
});
