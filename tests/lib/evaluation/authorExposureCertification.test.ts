import { evaluateAuthorExposureCertification, getAuthorExposureDecision } from '@/lib/evaluation/authorExposureCertification';

describe('evaluateAuthorExposureCertification', () => {
  test('allows certified payload with empty blockers and passing parity', () => {
    const decision = evaluateAuthorExposureCertification({
      decision: 'certified',
      certified_at: '2026-02-22T00:00:00.000Z',
      blocking_reasons: [],
      parity_results: { status: 'pass' },
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

describe('getAuthorExposureDecision', () => {
  test('returns missing_certification when artifact is absent', async () => {
    const admin = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
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

  test('returns exposable=true for fully certified artifact', async () => {
    const admin = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
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
      exposable: true,
      certifiedAt: '2026-02-22T00:00:00.000Z',
    });
  });

  test('returns final_external_audit_failed when certification embeds blocking Phase 4B audit', async () => {
    const admin = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => ({
                  maybeSingle: jest.fn(async () => ({
                    data: {
                      content: {
                        decision: 'certified',
                        blocking_reasons: [],
                        parity_results: { status: 'pass' },
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
});
