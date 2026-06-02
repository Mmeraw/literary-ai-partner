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

  it('routes PDF option to canonical download endpoint', () => {
    render(<DownloadReportButton jobId="e5ced7ac-117f-4d13-8cd0-3957c15dc189" disabled={false} />);

    fireEvent.click(screen.getByRole('button', { name: /Download Report/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /PDF \(.pdf\)/i }));

    expect(window.open).toHaveBeenCalledWith(
      '/api/reports/e5ced7ac-117f-4d13-8cd0-3957c15dc189/download?format=pdf',
      '_self',
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

  it('routes Word option to canonical download endpoint', () => {
    render(<DownloadReportButton jobId="e5ced7ac-117f-4d13-8cd0-3957c15dc189" disabled={false} />);

    fireEvent.click(screen.getByRole('button', { name: /Download Report/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Word \(.docx\)/i }));

    expect(window.open).toHaveBeenCalledWith(
      '/api/reports/e5ced7ac-117f-4d13-8cd0-3957c15dc189/download?format=docx',
      '_self',
    );
  });
});
