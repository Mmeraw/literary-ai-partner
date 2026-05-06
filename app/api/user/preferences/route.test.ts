import { GET, PATCH } from './route';

jest.mock('@/lib/supabase/server', () => ({
  getAuthenticatedUser: jest.fn(),
  createClient: jest.fn(),
}));

const { getAuthenticatedUser, createClient } = require('@/lib/supabase/server') as {
  getAuthenticatedUser: jest.Mock;
  createClient: jest.Mock;
};

function makeQuery(result: { data: unknown; error: unknown }) {
  const query: Record<string, jest.Mock> = {
    select: jest.fn(),
    eq: jest.fn(),
    maybeSingle: jest.fn(),
    upsert: jest.fn(),
    single: jest.fn(),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue(result);
  query.upsert.mockReturnValue(query);
  query.single.mockResolvedValue(result);

  return query;
}

function mockSupabase(result: { data: unknown; error: unknown }) {
  const query = makeQuery(result);
  const client = { from: jest.fn().mockReturnValue(query) };
  createClient.mockResolvedValue(client);
  return { client, query };
}

function patchRequest(body: unknown): Request {
  return new Request('http://localhost/api/user/preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('GET /api/user/preferences', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    getAuthenticatedUser.mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('returns stored timezone for the authenticated user', async () => {
    getAuthenticatedUser.mockResolvedValue({ id: 'user-1' });
    const { client, query } = mockSupabase({
      data: { timezone: 'America/New_York' },
      error: null,
    });

    const res = await GET();

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ timezone: 'America/New_York' });
    expect(client.from).toHaveBeenCalledWith('user_preferences');
    expect(query.select).toHaveBeenCalledWith('timezone');
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(query.maybeSingle).toHaveBeenCalled();
  });

  it('returns null timezone when no row exists', async () => {
    getAuthenticatedUser.mockResolvedValue({ id: 'user-1' });
    mockSupabase({ data: null, error: null });

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ timezone: null });
  });

  it('returns 500 on database read error', async () => {
    getAuthenticatedUser.mockResolvedValue({ id: 'user-1' });
    mockSupabase({ data: null, error: { message: 'boom' } });

    const res = await GET();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to read preferences' });
  });
});

describe('PATCH /api/user/preferences', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    getAuthenticatedUser.mockResolvedValue(null);

    const res = await PATCH(patchRequest({ timezone: 'UTC' }));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('returns 400 for invalid JSON', async () => {
    getAuthenticatedUser.mockResolvedValue({ id: 'user-1' });

    const res = await PATCH(patchRequest('{bad-json'));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid JSON body' });
  });

  it('returns 400 when timezone field is missing', async () => {
    getAuthenticatedUser.mockResolvedValue({ id: 'user-1' });

    const res = await PATCH(patchRequest({ other: 'UTC' }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Missing timezone field' });
  });

  it('returns 400 for invalid timezone format', async () => {
    getAuthenticatedUser.mockResolvedValue({ id: 'user-1' });

    const res = await PATCH(patchRequest({ timezone: 'not valid/tz!' }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid timezone format' });
  });

  it('upserts valid timezone and returns it', async () => {
    getAuthenticatedUser.mockResolvedValue({ id: 'user-1' });
    const { client, query } = mockSupabase({
      data: { timezone: 'Europe/London' },
      error: null,
    });

    const res = await PATCH(patchRequest({ timezone: 'Europe/London' }));

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ timezone: 'Europe/London' });
    expect(client.from).toHaveBeenCalledWith('user_preferences');
    expect(query.upsert).toHaveBeenCalledWith(
      { user_id: 'user-1', timezone: 'Europe/London' },
      { onConflict: 'user_id' },
    );
    expect(query.select).toHaveBeenCalledWith('timezone');
    expect(query.single).toHaveBeenCalled();
  });

  it('accepts null timezone to clear preference', async () => {
    getAuthenticatedUser.mockResolvedValue({ id: 'user-1' });
    mockSupabase({ data: { timezone: null }, error: null });

    const res = await PATCH(patchRequest({ timezone: null }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ timezone: null });
  });

  it('returns 500 on database update error', async () => {
    getAuthenticatedUser.mockResolvedValue({ id: 'user-1' });
    mockSupabase({ data: null, error: { message: 'boom' } });

    const res = await PATCH(patchRequest({ timezone: 'UTC' }));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to update preferences' });
  });
});
