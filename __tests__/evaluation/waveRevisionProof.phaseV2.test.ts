import { deriveWaveRevisionProof } from '../../lib/evaluation/phase-architecture-v2/waveRevisionProof';
import type { WaveRevisionPlanArtifact, WaveRunRecord } from '../../lib/evaluation/waveRevision';

const generatedAt = '2026-05-26T00:00:00.000Z';

function run(status: WaveRunRecord['status'], overrides: Partial<WaveRunRecord> = {}): WaveRunRecord {
  return {
    job_id: 'job-1',
    status,
    gate_result: { passed: status === 'complete', reasons: status === 'complete' ? [] : ['WORD_COUNT_BELOW_THRESHOLD'] },
    duration_ms: 123,
    generated_at: generatedAt,
    ...overrides,
  };
}

function plan(status: WaveRevisionPlanArtifact['status'], overrides: Partial<WaveRevisionPlanArtifact> = {}): WaveRevisionPlanArtifact {
  return {
    status,
    generated_at: generatedAt,
    ...overrides,
  };
}

describe('Phase Architecture v2 — WAVE Revision proof', () => {
  it('requires both plan and run metadata', () => {
    const result = deriveWaveRevisionProof(null, null);

    expect(result.ok).toBe(false);
    expect(result.status).toBe('missing');
    expect(result.code).toBe('WAVE_PROOF_MISSING');
    expect(result.quality_gate_label).toBe('Quality Gate');
    expect(result.wave_label).toBe('WAVE Revision');
  });

  it('fails when plan and run statuses disagree', () => {
    const result = deriveWaveRevisionProof(plan('complete'), run('skipped'));

    expect(result.ok).toBe(false);
    expect(result.code).toBe('WAVE_PROOF_STATUS_MISMATCH');
  });

  it('accepts complete WAVE proof with modules, revision session, and passed gate', () => {
    const result = deriveWaveRevisionProof(
      plan('complete', {
        modules_run: 3,
        revision_session_id: 'session-1',
      }),
      run('complete', {
        modules_run: 3,
        gate_result: { passed: true, reasons: [] },
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe('complete');
    expect(result.code).toBe('WAVE_REVISION_COMPLETE_PROOF_VALID');
  });

  it('rejects incomplete complete-WAVE proof', () => {
    const result = deriveWaveRevisionProof(
      plan('complete', {
        modules_run: 3,
      }),
      run('complete', {
        modules_run: 3,
        gate_result: { passed: true, reasons: [] },
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.code).toBe('WAVE_COMPLETE_PROOF_INCOMPLETE');
  });

  it('accepts skipped WAVE proof with reason codes and failed WAVE gate', () => {
    const result = deriveWaveRevisionProof(
      plan('skipped', {
        reason: 'STRUCTURAL_FLOOR_NOT_MET',
        reason_codes: ['WORD_COUNT_BELOW_THRESHOLD'],
      }),
      run('skipped', {
        gate_result: { passed: false, reasons: ['WORD_COUNT_BELOW_THRESHOLD'] },
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe('skipped');
    expect(result.code).toBe('WAVE_REVISION_SKIPPED_PROOF_VALID');
  });

  it('rejects skipped WAVE proof without reason codes', () => {
    const result = deriveWaveRevisionProof(plan('skipped'), run('skipped'));

    expect(result.ok).toBe(false);
    expect(result.code).toBe('WAVE_SKIPPED_PROOF_INCOMPLETE');
  });

  it('treats retryable timeout as explicit but not successful proof', () => {
    const result = deriveWaveRevisionProof(
      plan('timeout', { retryable: true }),
      run('timeout', { gate_result: { passed: true, reasons: [] } }),
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe('timeout');
    expect(result.code).toBe('WAVE_REVISION_TIMEOUT_RETRYABLE');
  });

  it('rejects timeout without retryable proof', () => {
    const result = deriveWaveRevisionProof(plan('timeout'), run('timeout'));

    expect(result.ok).toBe(false);
    expect(result.code).toBe('WAVE_TIMEOUT_PROOF_INCOMPLETE');
  });

  it('treats failed WAVE as blocking and distinct from Quality Gate', () => {
    const result = deriveWaveRevisionProof(
      plan('failed', { reason: 'WAVE_EXECUTION_ERROR' }),
      run('failed', { error: 'WAVE_EXECUTION_ERROR' }),
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.code).toBe('WAVE_REVISION_FAILED_BLOCKING');
    expect(result.quality_gate_label).toBe('Quality Gate');
    expect(result.wave_label).toBe('WAVE Revision');
    expect(result.quality_gate_label).not.toBe(result.wave_label);
  });
});
