'use client';

import { useUserTimezone } from '@/lib/hooks/useUserTimezone';

export interface LocalTimeProps {
  dateTime: string | Date;
  options?: Intl.DateTimeFormatOptions;
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
    return new Intl.DateTimeFormat(undefined, {
      ...options,
      timeZone: timezone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(undefined, {
      ...options,
      timeZone: 'UTC',
    }).format(date);
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
