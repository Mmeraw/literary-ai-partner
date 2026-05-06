/**
 * @jest-environment jsdom
 *
 * Tests for useUserTimezone hook.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useUserTimezone } from '@/lib/hooks/useUserTimezone';

// ============================================================================
// Mock fetch
// ============================================================================

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

function mockFetchNetworkFailure() {
  mockFetch.mockRejectedValueOnce(new Error('Network failure'));
}

// ============================================================================
// Tests
// ============================================================================

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

    // Should be a non-empty string (browser tz or UTC)
    expect(typeof result.current.timezone).toBe('string');
    expect(result.current.timezone.length).toBeGreaterThan(0);
  });

  it('falls back to browser timezone on non-OK API response', async () => {
    mockFetchError(401);

    const { result } = renderHook(() => useUserTimezone());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(typeof result.current.timezone).toBe('string');
    expect(result.current.timezone.length).toBeGreaterThan(0);
    expect(result.current.error).toBeNull();
  });

  it('sets error and keeps browser fallback on network failure', async () => {
    mockFetchNetworkFailure();

    const { result } = renderHook(() => useUserTimezone());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error!.message).toBe('Network failure');
    // Fallback timezone is still usable
    expect(typeof result.current.timezone).toBe('string');
    expect(result.current.timezone.length).toBeGreaterThan(0);
  });

  it('setTimezone updates state and calls PATCH', async () => {
    mockFetchSuccess('UTC'); // initial GET
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ timezone: 'Europe/Berlin' }),
    }); // PATCH response

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
    mockFetchSuccess('UTC'); // initial GET
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
