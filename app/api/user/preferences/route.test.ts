/**
 * Tests for GET /api/user/preferences and PATCH /api/user/preferences.
 *
 * Supabase and authentication helpers are fully mocked so no real DB is needed.
 */

import { GET, PATCH } from './route';
import { NextResponse } from 'next/server';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@/lib/supabase/server', () => ({
  getAuthenticatedUser: jest.fn(),
  createClient: jest.fn(),
}));

const { getAuthenticatedUser, createClient } = require('@/lib/supabase/server') as {
  getAuthenticatedUser: jest.Mock;
  createClient: jest.Mock;
};

/** Build a chainable Supabase query mock */
function buildQueryMock(result: { data: unknown; error: unknown }) {
  const chain: Record<string, jest.Mock> = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.maybeSingle = jest.fn().mockResolvedValue(result);
  chain.upsert = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue(result);
  return chain;
}

function mockSupabaseClient(result: { data: unknown; error: unknown }) {
  const chain = buildQueryMock(result);
  const client = { from: jest.fn().mockReturnValue(chain) };
  createClient.mockResolvedValue(client);
  return { client, chain };
}

function makeRequest(body?: unknown): Request {
  if (body === undefined) {
    return new Request('http://localhost/api/user/preferences');
  }
  return new Request('http://localhost/api/user/preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ============================================================================
// GET
// ============================================================================

describe('GET /api/user/preferences', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    getAuthenticatedUser.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('returns { timezone: null } when no preference is stored', async () => {
    getAuthenticatedUser.mockResolvedValue({ id: 'user-1' });
    mockSupabaseClient({ data: null, error: null });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.timezone).toBeNull();
  });

  it('returns the stored timezone', async () => {
    getAuthenticatedUser.mockResolvedValue({ id: 'user-1' });
    mockSupabaseClient({ data: { timezone: 'America/New_York' }, error: null });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.timezone).toBe('America/New_York');
  });

  it('returns 500 on database error', async () => {
    getAuthenticatedUser.mockResolvedValue({ id: 'user-1' });
    mockSupabaseClient({ data: null, error: { message: 'DB failure' } });

    const res = await GET();
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Failed to read preferences');
  });

  it('sets Cache-Control: no-store', async () => {
    getAuthenticatedUser.mockResolvedValue({ id: 'user-1' });
    mockSupabaseClient({ data: null, error: null });

    const res = await GET();
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});

// ============================================================================
// PATCH
// ============================================================================

describe('PATCH /api/user/preferences', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    getAuthenticatedUser.mockResolvedValue(null);

    const res = await PATCH(makeRequest({ timezone: 'UTC' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid JSON body', async () => {
    getAuthenticatedUser.mockResolvedValue({ id: 'user-1' });

    const req = new Request('http://localhost/api/user/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });

    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid JSON body');
  });

  it('returns 400 when timezone field is missing', async () => {
    getAuthenticatedUser.mockResolvedValue({ id: 'user-1' });

    const res = await PATCH(makeRequest({ other: 'field' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Missing timezone field');
  });

  it('returns 400 for an invalid timezone string', async () => {
    getAuthenticatedUser.mockResolvedValue({ id: 'user-1' });

    const res = await PATCH(makeRequest({ timezone: 'not_a_valid/tz!!!' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid timezone format');
  });

  it('returns 400 for a non-string timezone value', async () => {
    getAuthenticatedUser.mockResolvedValue({ id: 'user-1' });

    const res = await PATCH(makeRequest({ timezone: 123 }));
    expect(res.status).toBe(400);
  });

  it('accepts null timezone (clears preference)', async () => {
    getAuthenticatedUser.mockResolvedValue({ id: 'user-1' });
    mockSupabaseClient({ data: { timezone: null }, error: null });

    const res = await PATCH(makeRequest({ timezone: null }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.timezone).toBeNull();
  });

  it('upserts a valid IANA timezone and returns it', async () => {
    getAuthenticatedUser.mockResolvedValue({ id: 'user-1' });
    mockSupabaseClient({ data: { timezone: 'Europe/London' }, error: null });

    const res = await PATCH(makeRequest({ timezone: 'Europe/London' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.timezone).toBe('Europe/London');
  });

  it('accepts compound timezones like America/Indiana/Indianapolis', async () => {
    getAuthenticatedUser.mockResolvedValue({ id: 'user-1' });
    mockSupabaseClient({ data: { timezone: 'America/Indiana/Indianapolis' }, error: null });

    const res = await PATCH(makeRequest({ timezone: 'America/Indiana/Indianapolis' }));
    expect(res.status).toBe(200);
  });

  it('returns 500 on database error', async () => {
    getAuthenticatedUser.mockResolvedValue({ id: 'user-1' });
    mockSupabaseClient({ data: null, error: { message: 'DB failure' } });

    const res = await PATCH(makeRequest({ timezone: 'UTC' }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Failed to update preferences');
  });

  it('sets Cache-Control: no-store on success', async () => {
    getAuthenticatedUser.mockResolvedValue({ id: 'user-1' });
    mockSupabaseClient({ data: { timezone: 'UTC' }, error: null });

    const res = await PATCH(makeRequest({ timezone: 'UTC' }));
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});
