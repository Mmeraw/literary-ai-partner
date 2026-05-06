'use client';

/**
 * useUserTimezone — fetches the authenticated user's stored IANA timezone
 * preference from /api/user/preferences and exposes a setter.
 *
 * Fallback chain (in order):
 *  1. Stored preference from the API (public.user_preferences.timezone)
 *  2. Browser's Intl timezone (Intl.DateTimeFormat().resolvedOptions().timeZone)
 *  3. 'UTC' if Intl is unavailable
 *
 * The fallback is applied immediately so `timezone` is never an empty string
 * during loading.
 */

import { useState, useEffect } from 'react';

export type UserTimezoneResult = {
  /** Resolved IANA timezone string (preference or browser fallback). Never empty. */
  timezone: string;
  /** True while the initial preference fetch is in flight. */
  isLoading: boolean;
  /** Set if the preference fetch failed. `timezone` still holds the fallback value. */
  error: Error | null;
  /** Persist a new timezone preference. Throws on network / validation error. */
  setTimezone: (tz: string) => Promise<void>;
};

function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function useUserTimezone(): UserTimezoneResult {
  const [timezone, setTimezoneState] = useState<string>(getBrowserTimezone);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/user/preferences')
      .then(async (res) => {
        if (!res.ok) {
          // Unauthenticated or server error — keep browser fallback silently
          if (!cancelled) setIsLoading(false);
          return;
        }
        const data = (await res.json()) as { timezone?: string | null };
        if (!cancelled) {
          if (data.timezone) setTimezoneState(data.timezone);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Failed to load timezone preference'));
          setIsLoading(false);
          // timezone state already holds the browser fallback
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setTimezone = async (tz: string): Promise<void> => {
    const res = await fetch('/api/user/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone: tz }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? 'Failed to update timezone preference');
    }

    const data = (await res.json()) as { timezone?: string | null };
    setTimezoneState(data.timezone ?? getBrowserTimezone());
  };

  return { timezone, isLoading, error, setTimezone };
}
