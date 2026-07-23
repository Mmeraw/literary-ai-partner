import { evaluateAuthorExposureCertification, getAuthorExposureDecision } from '@/lib/evaluation/authorExposureCertification';
import { evaluateGate15AuthorExposure } from '@/lib/evaluation/gate15/authorExposureGate15';
import { runGate15Audit } from '@/lib/evaluation/gate15/gate15_orchestrator';

const passingDcipCompliance = { status: 'pass', reasons: [] };
const JOB_ID = 'job-1';

function certifiedPayload() {
  return {
    decision: 'certified',
    certified_at: '2026-02-22T00:00:00.000Z',
    blocking_reasons: [],
    parity_results: { status: 'pass' },
    dcip_compliance: passingDcipCompliance,
  };
}

function finalAuditPayload(status: 'pass' | 'warn' | 'block' = 'pass', sourceHash: string = 'result-source-hash-1') {
  return {
    artifact_type: 'final_external_audit_v1',
    status,
    evaluation_result_source_hash: sourceHash,
  };
}

function gate15AuditPayload(overallStatus: 'PASS' | 'WARN' | 'FAIL' | 'SKIPPED' = 'PASS', overrides: Record<string, unknown> = {}) {
  return {
    version: 'gate_15_audit_v1',
    jobId: JOB_ID,
    manuscriptId: 'manuscript-1',
    timestamp: '2026-07-22T00:00:00.000Z',
    valid_until: '2026-10-20T00:00:00.000Z',
    lineage_status: 'current',
    lineage: {
      artifact_type: 'gate_15_audit_v1',
      jobId: JOB_ID,
      manuscriptId: 'manuscript-1',
      timestamp: '2026-07-22T00:00:00.000Z',
    },
    overallStatus,
    ...overrides,
  };
}

function gate15NonblockingDisposition(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: 'gate_15_author_exposure_disposition_v1',
    disposition: 'nonblocking',
    scope: 'author_exposure',
    gate_15_audit_version: 'gate_15_audit_v1',
    gate_15_audit_job_id: JOB_ID,
    job_id: JOB_ID,
    approver: 'repository-owner',
    rationale: 'Finding is diagnostic-only for this report and does not affect author-facing correctness.',
    effective_date: '2026-07-22T00:00:00.000Z',
    evidence_lineage: { gate_15_audit_v1: 'audit-hash' },
    ...overrides,
  };
}

function mockAdmin({
  artifacts = {},
  errors = {},
  job = { word_count: 100 },
  sourceHashes = { evaluation_result_v2: 'result-source-hash-1' },
}: {
  artifacts?: Record<string, unknown>;
  errors?: Record<string, string>;
  job?: Record<string, unknown> | null;
  sourceHashes?: Record<string, string | null>;
}) {
  return {
    from: jest.fn((table: string) => {
      if (table === 'evaluation_jobs') {
        const jobRow = job
          ? { manuscript_word_count: (job as { word_count?: number | null }).word_count ?? null }
          : null;
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn(async () => ({ data: jobRow, error: null })),
            })),
          })),
        };
      }
      let artifactType = '';
      const query = {
        select: jest.fn(() => query),
        eq: jest.fn((field: string, value: string) => {
          if (field === 'artifact_type') artifactType = value;
          return query;
        }),
        order: jest.fn(() => query),
        limit: jest.fn(() => query),
        maybeSingle: jest.fn(async () => {
          if (errors[artifactType]) {
            return { data: null, error: { message: errors[artifactType] } };
          }
          if (!Object.prototype.hasOwnProperty.call(artifacts, artifactType) && sourceHashes[artifactType] == null) {
            return { data: null, error: null };
          }
          return {
            data: {
              content: Object.prototype.hasOwnProperty.call(artifacts, artifactType) ? artifacts[artifactType] : null,
              source_hash: sourceHashes[artifactType] ?? null,
            },
            error: null,
          };
        }),
      };
      return query;
    }),
  } as never;
}

function mockArtifactAdmin(artifacts: Record<string, unknown>, errors: Record<string, string> = {}) {
  return mockAdmin({ artifacts, errors });
}

describe('evaluateAuthorExposureCertification', () => {
  test('allows certified payload with empty blockers and passing parity', () => {
    const decision = evaluateAuthorExposureCertification({
      decision: 'certified',
      certified_at: '2026-02-22T00:00:00.000Z',
      blocking_reasons: [],
      parity_results: { status: 'pass' },
      dcip_compliance: passingDcipCompliance,
    });

    expect(decision.exposable).toBe(true);
    if (decision.exposable) {
      expect(decision.certifiedAt).toBe('2026-02-22T00:00:00.000Z');
    }
  });

  test('allows certified payload when supplied Phase 4B audit passes', () => {
    const decision = evaluateAuthorExposureCertification({
      decision: 'certified',
      certified_at: '2026-02-22T00:00:00.000Z',
      blocking_reasons: [],
      parity_results: { status: 'pass' },
      dcip_compliance: passingDcipCompliance,
      final_external_audit: {
        artifact_type: 'final_external_audit_v1',
        status: 'pass',
      },
    });

    expect(decision.exposable).toBe(true);
  });

  test('allows certified payload when supplied Phase 4B audit warns but does not block', () => {
    const decision = evaluateAuthorExposureCertification({
      decision: 'certified',
      blocking_reasons: [],
      parity_results: { status: 'pass' },
      dcip_compliance: passingDcipCompliance,
      final_external_audit: {
        artifact_type: 'final_external_audit_v1',
        status: 'warn',
      },
    });

    expect(decision.exposable).toBe(true);
  });

  test('blocks certified payload when supplied Phase 4B audit blocks', () => {
    const decision = evaluateAuthorExposureCertification({
      decision: 'certified',
      blocking_reasons: [],
      parity_results: { status: 'pass' },
      dcip_compliance: passingDcipCompliance,
      final_external_audit: {
        artifact_type: 'final_external_audit_v1',
        status: 'block',
      },
    });

    expect(decision).toMatchObject({
      exposable: false,
      reason: 'final_external_audit_failed',
    });
  });

  test('blocks certified payload when supplied Phase 4B audit is malformed', () => {
    const decision = evaluateAuthorExposureCertification({
      decision: 'certified',
      blocking_reasons: [],
      parity_results: { status: 'pass' },
      dcip_compliance: passingDcipCompliance,
      final_external_audit: { status: 'pass' },
    });

    expect(decision).toMatchObject({
      exposable: false,
      reason: 'final_external_audit_failed',
    });
  });

  test('blocks when decision is not certified', () => {
    const decision = evaluateAuthorExposureCertification({
      decision: 'blocked',
      blocking_reasons: [],
      parity_results: { status: 'pass' },
    });

    expect(decision).toMatchObject({
      exposable: false,
      reason: 'decision_not_certified',
    });
  });

  test('blocks when blocking reasons are present', () => {
    const decision = evaluateAuthorExposureCertification({
      decision: 'certified',
      blocking_reasons: ['policy violation'],
      parity_results: { status: 'pass' },
    });

    expect(decision).toMatchObject({
      exposable: false,
      reason: 'blocking_reasons_present',
    });
  });

  test('blocks when parity includes failure signal', () => {
    const decision = evaluateAuthorExposureCertification({
      decision: 'certified',
      blocking_reasons: [],
      parity_results: { docx: { status: 'failed' } },
    });

    expect(decision).toMatchObject({
      exposable: false,
      reason: 'parity_check_failed',
    });
  });

  test('blocks malformed payloads fail-closed', () => {
    const decision = evaluateAuthorExposureCertification('not-an-object');

    expect(decision).toMatchObject({
      exposable: false,
      reason: 'invalid_certification_payload',
    });
  });

  test('blocks null payload fail-closed', () => {
    const decision = evaluateAuthorExposureCertification(null);
    expect(decision).toMatchObject({ exposable: false, reason: 'invalid_certification_payload' });
  });

  test('blocks when decision field is missing', () => {
    const decision = evaluateAuthorExposureCertification({
      blocking_reasons: [],
      parity_results: { status: 'pass' },
    });
    expect(decision).toMatchObject({ exposable: false, reason: 'decision_not_certified' });
  });

  test('blocks when parity_results is null', () => {
    const decision = evaluateAuthorExposureCertification({
      decision: 'certified',
      blocking_reasons: [],
      parity_results: null,
    });
    expect(decision).toMatchObject({ exposable: false, reason: 'parity_check_failed' });
  });

  test('blocks when parity_results array contains a failed entry', () => {
    const decision = evaluateAuthorExposureCertification({
      decision: 'certified',
      blocking_reasons: [],
      parity_results: [{ status: 'pass' }, { status: 'fail' }],
    });
    expect(decision).toMatchObject({ exposable: false, reason: 'parity_check_failed' });
  });

  test('certifiedAt is null when certified_at field is absent', () => {
    const decision = evaluateAuthorExposureCertification({
      decision: 'certified',
      blocking_reasons: [],
      parity_results: { status: 'pass' },
      dcip_compliance: passingDcipCompliance,
    });
    expect(decision.exposable).toBe(true);
    if (decision.exposable) {
      expect(decision.certifiedAt).toBeNull();
    }
  });

  test('extracts nested author_exposure_certification key if present', () => {
    const decision = evaluateAuthorExposureCertification({
      author_exposure_certification: {
        decision: 'certified',
        certified_at: '2026-01-01T00:00:00.000Z',
        blocking_reasons: [],
        parity_results: { status: 'pass' },
        dcip_compliance: passingDcipCompliance,
      },
    });
    expect(decision.exposable).toBe(true);
    if (decision.exposable) {
      expect(decision.certifiedAt).toBe('2026-01-01T00:00:00.000Z');
    }
  });

  test('extracts nested author_exposure_certification and enforces nested Phase 4B audit', () => {
    const decision = evaluateAuthorExposureCertification({
      author_exposure_certification: {
        decision: 'certified',
        blocking_reasons: [],
        parity_results: { status: 'pass' },
        dcip_compliance: passingDcipCompliance,
        final_external_audit: {
          artifact_type: 'final_external_audit_v1',
          status: 'block',
        },
      },
    });

    expect(decision).toMatchObject({ exposable: false, reason: 'final_external_audit_failed' });
  });

  // blocking_reasons fail-closed contract: must be a present empty array
  test('blocks when blocking_reasons is undefined (fail closed)', () => {
    const decision = evaluateAuthorExposureCertification({
      decision: 'certified',
      parity_results: { status: 'pass' },
      // blocking_reasons intentionally absent
    });
    expect(decision).toMatchObject({ exposable: false, reason: 'blocking_reasons_present' });
  });

  test('blocks when blocking_reasons is null (fail closed)', () => {
    const decision = evaluateAuthorExposureCertification({
      decision: 'certified',
      blocking_reasons: null,
      parity_results: { status: 'pass' },
    });
    expect(decision).toMatchObject({ exposable: false, reason: 'blocking_reasons_present' });
  });

  test('blocks when blocking_reasons is a string (fail closed)', () => {
    const decision = evaluateAuthorExposureCertification({
      decision: 'certified',
      blocking_reasons: 'none',
      parity_results: { status: 'pass' },
    });
    expect(decision).toMatchObject({ exposable: false, reason: 'blocking_reasons_present' });
  });

  test('blocks when blocking_reasons is an object not an array (fail closed)', () => {
    const decision = evaluateAuthorExposureCertification({
      decision: 'certified',
      blocking_reasons: {},
      parity_results: { status: 'pass' },
    });
    expect(decision).toMatchObject({ exposable: false, reason: 'blocking_reasons_present' });
  });
});

describe('evaluateGate15AuthorExposure', () => {
  test.each(['PASS', 'WARN', 'SKIPPED'] as const)('allows %s Gate 15 audit status', (status) => {
    const decision = evaluateGate15AuthorExposure(gate15AuditPayload(status), { jobId: JOB_ID });

    expect(decision.exposable).toBe(true);
  });

  test('blocks Gate 15 FAIL without authorized nonblocking disposition', () => {
    const decision = evaluateGate15AuthorExposure(gate15AuditPayload('FAIL'), { jobId: JOB_ID });

    expect(decision).toMatchObject({
      exposable: false,
      reason: 'gate_15_audit_failed',
    });
  });

  test('fails closed when Gate 15 audit is missing or malformed', () => {
    expect(evaluateGate15AuthorExposure(null, { jobId: JOB_ID })).toMatchObject({
      exposable: false,
      reason: 'missing_gate_15_audit',
    });
    expect(evaluateGate15AuthorExposure({ status: 'PASS' }, { jobId: JOB_ID })).toMatchObject({
      exposable: false,
      reason: 'invalid_gate_15_audit_payload',
    });
  });

  test('fails closed for stale Gate 15 evidence', () => {
    const decision = evaluateGate15AuthorExposure(
      gate15AuditPayload('PASS', { valid_until: '2026-07-21T00:00:00.000Z' }),
      { jobId: JOB_ID, now: new Date('2026-07-22T00:00:00.000Z') },
    );

    expect(decision).toMatchObject({
      exposable: false,
      reason: 'gate_15_audit_stale',
    });
  });

  test('fails closed when Gate 15 valid_until is not derived from timestamp plus 90 days', () => {
    const decision = evaluateGate15AuthorExposure(
      gate15AuditPayload('PASS', { valid_until: '2026-10-21T00:00:00.000Z' }),
      { jobId: JOB_ID, now: new Date('2026-07-22T00:00:00.000Z') },
    );

    expect(decision).toMatchObject({
      exposable: false,
      reason: 'gate_15_audit_stale',
    });
  });

  test('fails closed when Gate 15 freshness proof is missing', () => {
    const decision = evaluateGate15AuthorExposure(
      gate15AuditPayload('PASS', { valid_until: undefined }),
      { jobId: JOB_ID, now: new Date('2026-07-22T00:00:00.000Z') },
    );

    expect(decision).toMatchObject({
      exposable: false,
      reason: 'gate_15_audit_stale',
    });
  });

  test('fails closed when Gate 15 lineage status is not current', () => {
    const decision = evaluateGate15AuthorExposure(
      gate15AuditPayload('PASS', { lineage_status: 'superseded' }),
      { jobId: JOB_ID, now: new Date('2026-07-22T00:00:00.000Z') },
    );

    expect(decision).toMatchObject({
      exposable: false,
      reason: 'gate_15_audit_stale',
    });
  });

  test('fails closed for Gate 15 lineage mismatch', () => {
    const decision = evaluateGate15AuthorExposure(gate15AuditPayload('PASS', { jobId: 'other-job' }), { jobId: JOB_ID });

    expect(decision).toMatchObject({
      exposable: false,
      reason: 'gate_15_lineage_mismatch',
    });
  });

  test('fails closed when Gate 15 lineage proof is missing or mismatched', () => {
    expect(evaluateGate15AuthorExposure(
      gate15AuditPayload('PASS', { lineage: undefined }),
      { jobId: JOB_ID },
    )).toMatchObject({
      exposable: false,
      reason: 'gate_15_lineage_mismatch',
    });

    expect(evaluateGate15AuthorExposure(
      gate15AuditPayload('PASS', { lineage: { artifact_type: 'gate_15_audit_v1', jobId: 'other-job', timestamp: '2026-07-22T00:00:00.000Z' } }),
      { jobId: JOB_ID },
    )).toMatchObject({
      exposable: false,
      reason: 'gate_15_lineage_mismatch',
    });
  });

  test('successful remediation is represented by a fresh passing Gate 15 audit', () => {
    const blocked = evaluateGate15AuthorExposure(gate15AuditPayload('FAIL'), { jobId: JOB_ID });
    const remediated = evaluateGate15AuthorExposure(gate15AuditPayload('PASS'), { jobId: JOB_ID });

    expect(blocked.exposable).toBe(false);
    expect(remediated.exposable).toBe(true);
  });

  test('accepts a genuine runGate15Audit artifact and rejects mutated freshness or lineage', () => {
    const manuscript = 'Short form content. '.repeat(200);
    const artifact = runGate15Audit(manuscript, JOB_ID, 'manuscript-1');
    const now = new Date(artifact.timestamp);

    expect(evaluateGate15AuthorExposure(artifact, { jobId: JOB_ID, now })).toMatchObject({
      exposable: true,
      status: 'skipped',
    });

    expect(evaluateGate15AuthorExposure({ ...artifact, valid_until: '2026-07-21T00:00:00.000Z' }, {
      jobId: JOB_ID,
      now: new Date('2026-07-22T00:00:00.000Z'),
    })).toMatchObject({
      exposable: false,
      reason: 'gate_15_audit_stale',
    });

    expect(evaluateGate15AuthorExposure({ ...artifact, valid_until: undefined }, { jobId: JOB_ID, now })).toMatchObject({
      exposable: false,
      reason: 'gate_15_audit_stale',
    });

    expect(evaluateGate15AuthorExposure({ ...artifact, jobId: 'other-job' }, { jobId: JOB_ID, now })).toMatchObject({
      exposable: false,
      reason: 'gate_15_lineage_mismatch',
    });

    expect(evaluateGate15AuthorExposure({ ...artifact, lineage_status: 'superseded' }, { jobId: JOB_ID, now })).toMatchObject({
      exposable: false,
      reason: 'gate_15_audit_stale',
    });
  });
});

describe('getAuthorExposureDecision', () => {
  test('returns missing_certification when artifact is absent', async () => {
    const admin = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(async () => ({ data: null, error: null })),
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => ({
                  maybeSingle: jest.fn(async () => ({ data: null, error: null })),
                })),
              })),
            })),
          })),
        })),
      })),
    } as never;

    const decision = await getAuthorExposureDecision(admin, 'job-1');
    expect(decision).toMatchObject({
      exposable: false,
      reason: 'missing_certification',
    });
  });

  test('returns decision_not_certified when artifact decision is blocked', async () => {
    const admin = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(async () => ({ data: null, error: null })),
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => ({
                  maybeSingle: jest.fn(async () => ({
                    data: {
                      content: {
                        decision: 'blocked',
                        blocking_reasons: ['x'],
                        parity_results: { status: 'pass' },
                      },
                    },
                    error: null,
                  })),
                })),
              })),
            })),
          })),
        })),
      })),
    } as never;

    const decision = await getAuthorExposureDecision(admin, 'job-1');
    expect(decision).toMatchObject({
      exposable: false,
      reason: 'decision_not_certified',
    });
  });

  test('returns db_error on DB error (not missing_certification)', async () => {
    const admin = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(async () => ({ data: null, error: null })),
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => ({
                  maybeSingle: jest.fn(async () => ({
                    data: null,
                    error: { message: 'connection refused' },
                  })),
                })),
              })),
            })),
          })),
        })),
      })),
    } as never;

    const decision = await getAuthorExposureDecision(admin, 'job-1');
    expect(decision).toMatchObject({
      exposable: false,
      reason: 'db_error',
      details: 'connection refused',
    });
  });

  test('fails closed when a certified artifact has no independently persisted final audit', async () => {
    const admin = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(async () => ({ data: null, error: null })),
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => ({
                  maybeSingle: jest.fn(async () => ({
                    data: {
                      content: {
                        decision: 'certified',
                        certified_at: '2026-02-22T00:00:00.000Z',
                        blocking_reasons: [],
                        parity_results: { status: 'pass' },
                        dcip_compliance: passingDcipCompliance,
                      },
                    },
                    error: null,
                  })),
                })),
              })),
            })),
          })),
        })),
      })),
    } as never;

    const decision = await getAuthorExposureDecision(admin, 'job-1');
    expect(decision).toMatchObject({
      exposable: false,
      reason: 'final_external_audit_failed',
    });
  });

  test('returns final_external_audit_failed when certification embeds blocking Phase 4B audit', async () => {
    const admin = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(async () => ({ data: null, error: null })),
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => ({
                  maybeSingle: jest.fn(async () => ({
                    data: {
                      content: {
                        decision: 'certified',
                        blocking_reasons: [],
                        parity_results: { status: 'pass' },
                        dcip_compliance: passingDcipCompliance,
                        final_external_audit: {
                          artifact_type: 'final_external_audit_v1',
                          status: 'block',
                        },
                      },
                    },
                    error: null,
                  })),
                })),
              })),
            })),
          })),
        })),
      })),
    } as never;

    const decision = await getAuthorExposureDecision(admin, 'job-1');
    expect(decision).toMatchObject({
      exposable: false,
      reason: 'final_external_audit_failed',
    });
  });

  test('returns missing_certification when content field is absent', async () => {
    const admin = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(async () => ({ data: null, error: null })),
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => ({
                  maybeSingle: jest.fn(async () => ({ data: { content: null }, error: null })),
                })),
              })),
            })),
          })),
        })),
      })),
    } as never;

    const decision = await getAuthorExposureDecision(admin, 'job-1');
    expect(decision).toMatchObject({
      exposable: false,
      reason: 'missing_certification',
    });
  });

  test('allows exposure only when certification, final audit, and Gate 15 all pass', async () => {
    const admin = mockArtifactAdmin({
      author_exposure_certification_v1: certifiedPayload(),
      final_external_audit_v1: finalAuditPayload('pass'),
      gate_15_audit_v1: gate15AuditPayload('PASS'),
    });

    const decision = await getAuthorExposureDecision(admin, JOB_ID);

    expect(decision).toMatchObject({ exposable: true });
  });

  test('blocks author exposure when authoritative Gate 15 audit is missing', async () => {
    const admin = mockArtifactAdmin({
      author_exposure_certification_v1: certifiedPayload(),
      final_external_audit_v1: finalAuditPayload('pass'),
    });

    const decision = await getAuthorExposureDecision(admin, JOB_ID);

    expect(decision).toMatchObject({
      exposable: false,
      reason: 'gate_15_audit_failed',
      details: 'gate_15_audit_v1 artifact missing',
    });
  });

  test('blocks author exposure when authoritative Gate 15 audit fails', async () => {
    const admin = mockArtifactAdmin({
      author_exposure_certification_v1: certifiedPayload(),
      final_external_audit_v1: finalAuditPayload('pass'),
      gate_15_audit_v1: gate15AuditPayload('FAIL'),
    });

    const decision = await getAuthorExposureDecision(admin, JOB_ID);

    expect(decision).toMatchObject({
      exposable: false,
      reason: 'gate_15_audit_failed',
    });
  });

  test('blocks author exposure when Gate 15 fail has loaded but currently disabled disposition artifact', async () => {
    const admin = mockArtifactAdmin({
      author_exposure_certification_v1: certifiedPayload(),
      final_external_audit_v1: finalAuditPayload('pass'),
      gate_15_audit_v1: gate15AuditPayload('FAIL'),
      gate_15_author_exposure_disposition_v1: gate15NonblockingDisposition(),
    });

    const decision = await getAuthorExposureDecision(admin, JOB_ID);

    expect(decision).toMatchObject({
      exposable: false,
      reason: 'gate_15_audit_failed',
    });
  });

  test('allows exposure for pipeline final_external_audit_v1 with SKIP verdict', async () => {
    const admin = mockArtifactAdmin({
      author_exposure_certification_v1: certifiedPayload(),
      final_external_audit_v1: {
        schema_version: 'final_external_audit_v1',
        verdict: 'SKIP',
        codes: ['FINAL_AUDIT_SKIPPED_SHORT_FORM'],
        evaluation_result_source_hash: 'result-source-hash-1',
      },
      gate_15_audit_v1: gate15AuditPayload('PASS'),
    });

    const decision = await getAuthorExposureDecision(admin, JOB_ID);

    expect(decision).toMatchObject({ exposable: true });
  });

  test('allows exposure when short-form final audit is bound to actual job metadata', async () => {
    const admin = mockAdmin({
      artifacts: {
        author_exposure_certification_v1: certifiedPayload(),
        final_external_audit_v1: {
          schema_version: 'final_external_audit_v1',
          verdict: 'SKIP',
          codes: ['FINAL_AUDIT_SKIPPED_SHORT_FORM'],
          word_count: 100,
          evaluation_result_version: 'evaluation_result_v2',
          evaluation_result_source_hash: 'result-source-hash-1',
        },
        gate_15_audit_v1: gate15AuditPayload('PASS'),
      },
      job: { word_count: 100 },
    });

    const decision = await getAuthorExposureDecision(admin, JOB_ID);

    expect(decision).toMatchObject({ exposable: true });
  });

  test('blocks exposure when short-form final audit source hash does not match the canonical result (stale prior result)', async () => {
    const admin = mockAdmin({
      artifacts: {
        author_exposure_certification_v1: certifiedPayload(),
        final_external_audit_v1: {
          schema_version: 'final_external_audit_v1',
          verdict: 'SKIP',
          codes: ['FINAL_AUDIT_SKIPPED_SHORT_FORM'],
          word_count: 100,
          evaluation_result_version: 'evaluation_result_v2',
          evaluation_result_source_hash: 'result-source-hash-stale',
        },
        gate_15_audit_v1: gate15AuditPayload('PASS'),
      },
      job: { word_count: 100 },
    });

    const decision = await getAuthorExposureDecision(admin, JOB_ID);

    expect(decision).toMatchObject({
      exposable: false,
      reason: 'final_external_audit_failed',
    });
    if (!('exposable' in decision) || decision.exposable !== false) return;
    expect(decision.details).toContain('evaluation_result_source_hash mismatch');
  });

  test('blocks exposure when short-form final audit word_count does not match job', async () => {
    const admin = mockAdmin({
      artifacts: {
        author_exposure_certification_v1: certifiedPayload(),
        final_external_audit_v1: {
          schema_version: 'final_external_audit_v1',
          verdict: 'SKIP',
          codes: ['FINAL_AUDIT_SKIPPED_SHORT_FORM'],
          word_count: 50,
          evaluation_result_version: 'evaluation_result_v2',
          evaluation_result_source_hash: 'result-source-hash-1',
        },
        gate_15_audit_v1: gate15AuditPayload('PASS'),
      },
      job: { word_count: 100 },
    });

    const decision = await getAuthorExposureDecision(admin, JOB_ID);

    expect(decision).toMatchObject({
      exposable: false,
      reason: 'final_external_audit_failed',
    });
    if (!('exposable' in decision) || decision.exposable !== false) return;
    expect(decision.details).toContain('word_count mismatch');
  });

  test('blocks exposure when final audit is missing evaluation_result_source_hash binding', async () => {
    const admin = mockAdmin({
      artifacts: {
        author_exposure_certification_v1: certifiedPayload(),
        final_external_audit_v1: {
          schema_version: 'final_external_audit_v1',
          verdict: 'SKIP',
          codes: ['FINAL_AUDIT_SKIPPED_SHORT_FORM'],
          word_count: 100,
          evaluation_result_version: 'evaluation_result_v2',
        },
        gate_15_audit_v1: gate15AuditPayload('PASS'),
      },
      job: { word_count: 100 },
    });

    const decision = await getAuthorExposureDecision(admin, JOB_ID);

    expect(decision).toMatchObject({
      exposable: false,
      reason: 'final_external_audit_failed',
    });
    if (!('exposable' in decision) || decision.exposable !== false) return;
    expect(decision.details).toContain('missing required evaluation_result_source_hash binding');
  });

  test('blocks exposure when canonical evaluation_result_v2 source hash cannot be proven', async () => {
    const admin = mockAdmin({
      artifacts: {
        author_exposure_certification_v1: certifiedPayload(),
        final_external_audit_v1: {
          schema_version: 'final_external_audit_v1',
          verdict: 'SKIP',
          codes: ['FINAL_AUDIT_SKIPPED_SHORT_FORM'],
          word_count: 100,
          evaluation_result_version: 'evaluation_result_v2',
          evaluation_result_source_hash: 'result-source-hash-1',
        },
        gate_15_audit_v1: gate15AuditPayload('PASS'),
      },
      job: { word_count: 100 },
      sourceHashes: { evaluation_result_v2: null },
    });

    const decision = await getAuthorExposureDecision(admin, JOB_ID);

    expect(decision).toMatchObject({
      exposable: false,
      reason: 'final_external_audit_failed',
    });
    if (!('exposable' in decision) || decision.exposable !== false) return;
    expect(decision.details).toContain('canonical evaluation_result_v2 source hash is unavailable');
  });

  test('blocks long-form exposure when final audit artifact is missing', async () => {
    const admin = mockAdmin({
      artifacts: {
        author_exposure_certification_v1: certifiedPayload(),
        gate_15_audit_v1: gate15AuditPayload('PASS'),
      },
      job: { word_count: 50000 },
    });

    const decision = await getAuthorExposureDecision(admin, JOB_ID);

    expect(decision).toMatchObject({
      exposable: false,
      reason: 'final_external_audit_failed',
    });
  });
});
