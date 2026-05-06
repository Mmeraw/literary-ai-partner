/**
 * @jest-environment jsdom
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useUserTimezone } from '@/lib/hooks/useUserTimezone';

const mockFetch = jest.fn();
global.fetch = mockFetch;

function mockFetchSuccess(timezone: string | null) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({ timezone }),
  });
}

function mockFetchError(status = 500) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: () => Promise.resolve({ error: 'Server error' }),
  });
}

describe('useUserTimezone', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('starts loading and resolves to stored timezone', async () => {
    mockFetchSuccess('America/New_York');

    const { result } = renderHook(() => useUserTimezone());

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.timezone).toBe('America/New_York');
    expect(result.current.error).toBeNull();
  });

  it('falls back to browser timezone when API returns null', async () => {
    mockFetchSuccess(null);

    const { result } = renderHook(() => useUserTimezone());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.timezone.length).toBeGreaterThan(0);
  });

  it('falls back to browser timezone on non-OK API response', async () => {
    mockFetchError(401);

    const { result } = renderHook(() => useUserTimezone());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.timezone.length).toBeGreaterThan(0);
    expect(result.current.error).toBeNull();
  });

  it('sets error and keeps fallback on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'));

    const { result } = renderHook(() => useUserTimezone());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Network failure');
    expect(result.current.timezone.length).toBeGreaterThan(0);
  });

  it('setTimezone updates state and calls PATCH', async () => {
    mockFetchSuccess('UTC');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ timezone: 'Europe/Berlin' }),
    });

    const { result } = renderHook(() => useUserTimezone());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.setTimezone('Europe/Berlin');
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/user/preferences',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ timezone: 'Europe/Berlin' }),
      }),
    );
    expect(result.current.timezone).toBe('Europe/Berlin');
  });

  it('setTimezone throws when PATCH fails', async () => {
    mockFetchSuccess('UTC');
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Invalid timezone format' }),
    });

    const { result } = renderHook(() => useUserTimezone());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      act(async () => {
        await result.current.setTimezone('not/a/tz!!!');
      }),
    ).rejects.toThrow('Invalid timezone format');
  });
});
