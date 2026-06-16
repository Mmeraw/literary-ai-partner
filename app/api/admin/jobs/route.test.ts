import { NextRequest } from 'next/server';
import { GET } from './route';

jest.mock('@/lib/admin/requireAdmin', () => ({
  requireAdmin: jest.fn(async () => null),
}));

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(),
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

  it('uses created_at ordering for all-status recent jobs so completed jobs are visible', async () => {
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
    const rpc = jest.fn();
    createAdminClient.mockReturnValue({ from, rpc });

    const req = new NextRequest('http://localhost/api/admin/jobs?limit=50');
    const response = await GET(req);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.jobs[0].id).toBe('recent-complete');
    expect(json.filters.ordering).toBe('created_at_desc_all_statuses');
    expect(from).toHaveBeenCalledWith('evaluation_jobs');
    expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('keeps filtered status queries on the admin_list_jobs RPC path', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [{ id: 'failed-job', has_more: false, failed_at: '2026-06-14T00:00:00.000Z', created_at: '2026-06-14T00:00:00.000Z' }],
      error: null,
    });
    createAdminClient.mockReturnValue({ rpc });

    const req = new NextRequest('http://localhost/api/admin/jobs?status=failed&limit=50');
    const response = await GET(req);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith('admin_list_jobs', expect.objectContaining({ p_status: 'failed' }));
  });
});
