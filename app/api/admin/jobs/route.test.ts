import { NextRequest } from 'next/server';
import { GET } from './route';

jest.mock('@/lib/admin/requireAdmin', () => ({
  requireAdmin: jest.fn(async () => null),
}));

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(),
}));

jest.mock('@/lib/manuscripts/testRange', () => ({
  isTestManuscript: jest.fn(() => false),
  TEST_MANUSCRIPT_ID_MIN: 9000,
}));

const { createAdminClient } = require('@/lib/supabase/admin') as {
  createAdminClient: jest.Mock;
};

function makeQuery(result: { data: unknown; error: unknown }) {
  const promise = Promise.resolve(result);
  return {
    select: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };
}

describe('GET /api/admin/jobs', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('reads evaluation_jobs table directly with updated_at ordering', async () => {
    const query = makeQuery({
      data: [
        {
          id: 'recent-complete',
          manuscript_id: 7519,
          job_type: 'evaluation',
          status: 'complete',
          phase: 'phase_2',
          phase_status: 'complete',
          attempt_count: 0,
          max_attempts: 3,
          failed_at: null,
          next_attempt_at: null,
          last_error: null,
          created_at: '2026-06-14T02:00:25.402Z',
          updated_at: '2026-06-14T02:22:09.016Z',
        },
      ],
      error: null,
    });
    const from = jest.fn().mockReturnValue(query);
    createAdminClient.mockReturnValue({ from });

    const req = new NextRequest('http://localhost/api/admin/jobs?limit=50');
    const response = await GET(req);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.jobs[0].id).toBe('recent-complete');
    expect(from).toHaveBeenCalledWith('evaluation_jobs');
    expect(query.order).toHaveBeenCalledWith('updated_at', { ascending: false });
  });

  it('applies status filter client-side using semantic status matching', async () => {
    const query = makeQuery({
      data: [
        { id: 'failed-job', manuscript_id: 100, status: 'failed', failed_at: '2026-06-14T00:00:00.000Z', created_at: '2026-06-14T00:00:00.000Z' },
        { id: 'running-job', manuscript_id: 101, status: 'running', created_at: '2026-06-14T00:00:00.000Z' },
      ],
      error: null,
    });
    const from = jest.fn().mockReturnValue(query);
    createAdminClient.mockReturnValue({ from });

    const req = new NextRequest('http://localhost/api/admin/jobs?status=failed&limit=50');
    const response = await GET(req);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.jobs.every((j: Record<string, unknown>) => j.status === 'failed')).toBe(true);
    expect(json.filters.requestedStatus).toBe('failed');
    expect(json.filters.source).toBe('evaluation_jobs');
  });
});
