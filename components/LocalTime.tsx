'use client';

/**
 * LocalTime — renders an absolute timestamp in the authenticated user's
 * preferred IANA timezone (or browser timezone as fallback).
 *
 * Outputs a semantic <time> element with:
 *   - `dateTime` attribute set to the ISO-8601 UTC string
 *   - `title` attribute showing the UTC value for screen-reader / hover context
 *   - inner text formatted via Intl.DateTimeFormat in the resolved timezone
 *
 * Fallback behaviour:
 *  - Invalid timezone  → falls back to 'UTC' for the formatted output
 *  - Unparseable input → renders `fallback` prop (default: empty string)
 */

import { useUserTimezone } from '@/lib/hooks/useUserTimezone';

export interface LocalTimeProps {
  /** ISO-8601 string or Date object to display. */
  dateTime: string | Date;
  /**
   * Intl.DateTimeFormatOptions for the visible text.
   * Defaults to a human-friendly date + time (e.g. "May 6, 2026, 10:30 AM").
   */
  options?: Intl.DateTimeFormatOptions;
  /** Text to render when `dateTime` is unparseable. Defaults to `''`. */
  fallback?: string;
}

const DEFAULT_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

function toDate(dateTime: string | Date): Date | null {
  const d = typeof dateTime === 'string' ? new Date(dateTime) : dateTime;
  return isNaN(d.getTime()) ? null : d;
}

function formatInTimezone(
  date: Date,
  timezone: string,
  options: Intl.DateTimeFormatOptions,
): string {
  try {
    return new Intl.DateTimeFormat(undefined, { ...options, timeZone: timezone }).format(date);
  } catch {
    // Invalid timezone — fall back to UTC
    return new Intl.DateTimeFormat(undefined, { ...options, timeZone: 'UTC' }).format(date);
  }
}

export function LocalTime({
  dateTime,
  options = DEFAULT_FORMAT,
  fallback = '',
}: LocalTimeProps) {
  const { timezone } = useUserTimezone();
  const date = toDate(dateTime);

  if (!date) {
    return <time>{fallback}</time>;
  }

  const isoString = date.toISOString();
  const formatted = formatInTimezone(date, timezone, options);

  return (
    <time dateTime={isoString} title={`UTC: ${isoString}`}>
      {formatted}
    </time>
  );
}
