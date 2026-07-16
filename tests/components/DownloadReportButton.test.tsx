/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import DownloadReportButton from '@/components/reports/DownloadReportButton';

describe('DownloadReportButton', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    window.URL.createObjectURL = jest.fn(() => 'blob:mock');
    window.URL.revokeObjectURL = jest.fn();
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetAllMocks();
  });

  function mockJobStatusComplete() {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/jobs/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ job: { status: 'complete' } }),
        });
      }
      if (url.includes('/api/reports/')) {
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob(['test'], { type: 'application/pdf' })),
          headers: new Headers({ 'Content-Disposition': 'attachment; filename="report.pdf"' }),
        });
      }
      return Promise.resolve({ ok: false });
    });
  }

  function mockButtonPosition(top: number, bottom: number) {
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top,
      bottom,
      left: 0,
      right: 200,
      width: 200,
      height: bottom - top,
      x: 0,
      y: top,
      toJSON: () => ({}),
    });
  }

  it('opens the header download menu downward when there is room below', async () => {
    mockJobStatusComplete();
    mockButtonPosition(120, 160);
    render(<DownloadReportButton jobId="e5ced7ac-117f-4d13-8cd0-3957c15dc189" disabled={false} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Download Report/i }).getAttribute('aria-disabled')).not.toBe('true');
    });

    fireEvent.click(screen.getByRole('button', { name: /Download Report/i }));

    const menu = screen.getByTestId('download-report-menu');
    expect(menu.className).toContain('top-full');
    expect(menu.className).not.toContain('bottom-full');
    expect(menu.getAttribute('data-placement')).toBe('below');
    expect(screen.getByRole('button', { name: /Download Report/i }).textContent).toContain('▾');
  });

  it('keeps the footer download menu opening upward when space below is limited', async () => {
    mockJobStatusComplete();
    mockButtonPosition(820, 860);
    render(<DownloadReportButton jobId="e5ced7ac-117f-4d13-8cd0-3957c15dc189" disabled={false} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Download Report/i }).getAttribute('aria-disabled')).not.toBe('true');
    });

    fireEvent.click(screen.getByRole('button', { name: /Download Report/i }));

    const menu = screen.getByTestId('download-report-menu');
    expect(menu.className).toContain('bottom-full');
    expect(menu.className).not.toContain('top-full');
    expect(menu.getAttribute('data-placement')).toBe('above');
    expect(screen.getByRole('button', { name: /Download Report/i }).textContent).toContain('▴');
  });

  it('opens a lower-page download menu upward even when the old height estimate would fit below', async () => {
    mockJobStatusComplete();
    mockButtonPosition(500, 540);
    render(<DownloadReportButton jobId="e5ced7ac-117f-4d13-8cd0-3957c15dc189" disabled={false} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Download Report/i }).getAttribute('aria-disabled')).not.toBe('true');
    });

    fireEvent.click(screen.getByRole('button', { name: /Download Report/i }));

    const menu = screen.getByTestId('download-report-menu');
    expect(menu.className).toContain('bottom-full');
    expect(menu.className).not.toContain('top-full');
    expect(menu.getAttribute('data-placement')).toBe('above');
  });

  it('routes PDF option to canonical download endpoint', async () => {
    mockJobStatusComplete();
    render(<DownloadReportButton jobId="e5ced7ac-117f-4d13-8cd0-3957c15dc189" disabled={false} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Download Report/i }).getAttribute('aria-disabled')).not.toBe('true');
    });

    fireEvent.click(screen.getByRole('button', { name: /Download Report/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /PDF \(.pdf\)/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/reports/e5ced7ac-117f-4d13-8cd0-3957c15dc189/download?format=pdf',
      );
    });
  });

  it('routes TXT option to canonical download endpoint', async () => {
    mockJobStatusComplete();
    render(<DownloadReportButton jobId="e5ced7ac-117f-4d13-8cd0-3957c15dc189" disabled={false} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Download Report/i }).getAttribute('aria-disabled')).not.toBe('true');
    });

    fireEvent.click(screen.getByRole('button', { name: /Download Report/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Plain Text \(.txt\)/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/reports/e5ced7ac-117f-4d13-8cd0-3957c15dc189/download?format=txt',
      );
    });
  });

  it('routes Word option to canonical download endpoint', async () => {
    mockJobStatusComplete();
    render(<DownloadReportButton jobId="e5ced7ac-117f-4d13-8cd0-3957c15dc189" disabled={false} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Download Report/i }).getAttribute('aria-disabled')).not.toBe('true');
    });

    fireEvent.click(screen.getByRole('button', { name: /Download Report/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Word \(.docx\)/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/reports/e5ced7ac-117f-4d13-8cd0-3957c15dc189/download?format=docx',
      );
    });
  });
});
