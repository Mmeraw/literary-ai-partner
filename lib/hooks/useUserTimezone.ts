'use client';

/**
 * useUserTimezone — fetches the authenticated user's stored IANA timezone
 * preference from /api/user/preferences and exposes a setter.
 *
 * Fallback chain:
 *  1. Stored preference from public.user_preferences.timezone
 *  2. Browser Intl timezone
 *  3. UTC
 */

import { useEffect, useState } from 'react';

export type UserTimezoneResult = {
  timezone: string;
  isLoading: boolean;
  error: Error | null;
  setTimezone: (tz: string | null) => Promise<void>;
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
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setTimezone = async (tz: string | null): Promise<void> => {
    const res = await fetch('/api/user/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone: tz }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? 'Failed to update timezone preference');
    }

    const data = (await res.json()) as { timezone?: string | null };
    setTimezoneState(data.timezone ?? getBrowserTimezone());
  };

  return { timezone, isLoading, error, setTimezone };
}
