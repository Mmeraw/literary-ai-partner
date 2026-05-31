/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';

import DownloadReportButton from '@/components/reports/DownloadReportButton';

describe('DownloadReportButton', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    window.open = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('routes PDF option to canonical print view', () => {
    render(<DownloadReportButton jobId="e5ced7ac-117f-4d13-8cd0-3957c15dc189" disabled={false} />);

    fireEvent.click(screen.getByRole('button', { name: /Download Report/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /PDF \(.pdf\)/i }));

    expect(window.open).toHaveBeenCalledWith(
      '/api/reports/e5ced7ac-117f-4d13-8cd0-3957c15dc189/print',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('routes TXT option to canonical download endpoint', () => {
    render(<DownloadReportButton jobId="e5ced7ac-117f-4d13-8cd0-3957c15dc189" disabled={false} />);

    fireEvent.click(screen.getByRole('button', { name: /Download Report/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Plain Text \(.txt\)/i }));

    expect(window.open).toHaveBeenCalledWith(
      '/api/reports/e5ced7ac-117f-4d13-8cd0-3957c15dc189/download?format=txt',
      '_self',
    );
  });

  it('does not show Word option in menu', () => {
    render(<DownloadReportButton jobId="e5ced7ac-117f-4d13-8cd0-3957c15dc189" disabled={false} />);

    fireEvent.click(screen.getByRole('button', { name: /Download Report/i }));

    expect(screen.queryByRole('menuitem', { name: /Word/i })).toBeNull();
    expect(screen.getByText(/Word export is temporarily hidden/i)).toBeTruthy();
  });
});
