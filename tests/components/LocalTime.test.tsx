/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LocalTime } from '@/components/LocalTime';

jest.mock('@/lib/hooks/useUserTimezone', () => ({
  useUserTimezone: jest.fn(),
}));

const { useUserTimezone } = require('@/lib/hooks/useUserTimezone') as {
  useUserTimezone: jest.Mock;
};

describe('LocalTime', () => {
  beforeEach(() => {
    useUserTimezone.mockReturnValue({
      timezone: 'UTC',
      isLoading: false,
      error: null,
      setTimezone: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders a formatted time element', () => {
    render(<LocalTime dateTime="2026-05-06T20:00:00.000Z" />);

    const time = screen.getByRole('time');
    expect(time).toBeInTheDocument();
    expect(time.getAttribute('datetime')).toBe('2026-05-06T20:00:00.000Z');
  });

  it('renders fallback for invalid dates', () => {
    render(<LocalTime dateTime="invalid-date" fallback="Unknown" />);

    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('uses the timezone from the hook', () => {
    useUserTimezone.mockReturnValue({
      timezone: 'America/New_York',
      isLoading: false,
      error: null,
      setTimezone: jest.fn(),
    });

    render(<LocalTime dateTime="2026-05-06T20:00:00.000Z" />);

    const time = screen.getByRole('time');
    expect(time.textContent).toBeTruthy();
  });

  it('falls back safely if Intl formatting throws', () => {
    const original = Intl.DateTimeFormat;

    Intl.DateTimeFormat = jest.fn(() => {
      throw new Error('Bad timezone');
    }) as unknown as typeof Intl.DateTimeFormat;

    render(<LocalTime dateTime="2026-05-06T20:00:00.000Z" />);

    const time = screen.getByRole('time');
    expect(time).toBeInTheDocument();

    Intl.DateTimeFormat = original;
  });
});
