/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ModeConfirmationBlock from '@/components/evaluation/ModeConfirmationBlock';

const detectedMode = {
  proposedEvaluationMode: 'TESTIMONY' as const,
  proposedVoicePreservationMode: 'MAXIMUM' as const,
  confidence: 'HIGH' as const,
  evidence: [
    { signal: 'survivor-disclosure marker: trauma', where: 'char~10' },
    { signal: 'survivor-disclosure marker: assault', where: 'char~24' },
  ],
};

describe('ModeConfirmationBlock', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false, error: 'stop after payload capture' }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
    global.fetch = originalFetch;
  });

  it('defaults unconfirmed mode selection to STANDARD and BALANCED', () => {
    render(
      <ModeConfirmationBlock
        jobId="job-123"
        detectedMode={detectedMode}
        confirmedMode={null}
      />,
    );

    expect((screen.getByLabelText('Evaluation Mode') as HTMLSelectElement).value).toBe('STANDARD');
    expect((screen.getByLabelText('Voice Preservation') as HTMLSelectElement).value).toBe('BALANCED');
    expect(screen.queryByRole('button', { name: 'Keep' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Replace' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Refine' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Confirm Mode' })).toBeTruthy();
  });

  it('submits keep when the confirmed selection matches the detected proposal', async () => {
    render(
      <ModeConfirmationBlock
        jobId="job-123"
        detectedMode={detectedMode}
        confirmedMode={null}
      />,
    );

    fireEvent.change(screen.getByLabelText('Evaluation Mode'), {
      target: { value: 'TESTIMONY' },
    });
    fireEvent.change(screen.getByLabelText('Voice Preservation'), {
      target: { value: 'MAXIMUM' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Mode' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/evaluations/job-123/mode',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'keep' }),
      }),
    );
  });

  it('submits replace when the user confirms a different selection', async () => {
    render(
      <ModeConfirmationBlock
        jobId="job-123"
        detectedMode={detectedMode}
        confirmedMode={null}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Mode' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/evaluations/job-123/mode',
      expect.objectContaining({
        body: JSON.stringify({
          action: 'replace',
          confirmedMode: {
            evaluationMode: 'STANDARD',
            voicePreservationMode: 'BALANCED',
          },
        }),
      }),
    );
  });
});