/**
 * @jest-environment jsdom
 *
 * Tests for the LocalTime component.
 *
 * useUserTimezone is mocked so no real fetch occurs.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { LocalTime } from '@/components/LocalTime';

// ============================================================================
// Mock the hook
// ============================================================================

jest.mock('@/lib/hooks/useUserTimezone', () => ({
  useUserTimezone: jest.fn(),
}));

const { useUserTimezone } = require('@/lib/hooks/useUserTimezone') as {
  useUserTimezone: jest.Mock;
};

function mockTimezone(tz: string) {
  useUserTimezone.mockReturnValue({
    timezone: tz,
    isLoading: false,
    error: null,
    setTimezone: jest.fn(),
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('LocalTime', () => {
  afterEach(() => jest.clearAllMocks());

  it('renders a <time> element', () => {
    mockTimezone('UTC');
    render(<LocalTime dateTime="2026-05-06T17:00:00.000Z" />);

    const el = document.querySelector('time');
    expect(el).not.toBeNull();
  });

  it('sets the dateTime attribute to the ISO-8601 UTC string', () => {
    mockTimezone('UTC');
    render(<LocalTime dateTime="2026-05-06T17:00:00.000Z" />);

    const el = document.querySelector('time');
    expect(el?.getAttribute('dateTime')).toBe('2026-05-06T17:00:00.000Z');
  });

  it('sets a title attribute with UTC value', () => {
    mockTimezone('UTC');
    render(<LocalTime dateTime="2026-05-06T17:00:00.000Z" />);

    const el = document.querySelector('time');
    expect(el?.getAttribute('title')).toContain('UTC');
  });

  it('renders non-empty text content for a valid dateTime', () => {
    mockTimezone('America/New_York');
    render(<LocalTime dateTime="2026-05-06T17:00:00.000Z" />);

    const el = document.querySelector('time');
    expect(el?.textContent?.trim().length).toBeGreaterThan(0);
  });

  it('renders fallback for an unparseable dateTime string', () => {
    mockTimezone('UTC');
    render(<LocalTime dateTime="not-a-date" fallback="—" />);

    const el = document.querySelector('time');
    expect(el?.textContent).toBe('—');
    expect(el?.getAttribute('dateTime')).toBeNull();
  });

  it('renders empty string by default for an unparseable dateTime', () => {
    mockTimezone('UTC');
    render(<LocalTime dateTime="not-a-date" />);

    const el = document.querySelector('time');
    expect(el?.textContent).toBe('');
  });

  it('accepts a Date object', () => {
    mockTimezone('UTC');
    const date = new Date('2026-05-06T17:00:00.000Z');
    render(<LocalTime dateTime={date} />);

    const el = document.querySelector('time');
    expect(el?.getAttribute('dateTime')).toBe('2026-05-06T17:00:00.000Z');
    expect(el?.textContent?.trim().length).toBeGreaterThan(0);
  });

  it('applies custom Intl format options', () => {
    mockTimezone('UTC');
    render(
      <LocalTime
        dateTime="2026-05-06T17:00:00.000Z"
        options={{ year: 'numeric', month: 'long', day: 'numeric' }}
      />,
    );

    const el = document.querySelector('time');
    // Should contain the year
    expect(el?.textContent).toContain('2026');
  });

  it('falls back to UTC when the resolved timezone is invalid', () => {
    mockTimezone('Not/A/Real_Timezone_XYZ');
    // Should not throw; renders something (UTC fallback)
    expect(() =>
      render(<LocalTime dateTime="2026-05-06T17:00:00.000Z" />),
    ).not.toThrow();

    const el = document.querySelector('time');
    expect(el?.textContent?.trim().length).toBeGreaterThan(0);
  });
});
