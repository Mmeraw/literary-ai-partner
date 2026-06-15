/**
 * @jest-environment jsdom
 */

import { render, waitFor } from '@testing-library/react';
import { EvaluationPoller, type JobState } from '@/components/EvaluationPoller';

const push = jest.fn();
const refresh = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));

function makeCompleteJob(overrides: Partial<JobState> = {}): JobState {
  return {
    id: '024fd7d4-e5ef-4f32-9ad2-e63a237d7525',
    status: 'complete',
    progress: 100,
    created_at: '2026-05-24T12:00:00.000Z',
    updated_at: '2026-05-24T12:10:00.000Z',
    last_error: undefined,
    failure_code: undefined,
    phase: 'phase_3',
    phase_status: 'complete',
    cross_check_status: 'complete',
    total_units: 1,
    completed_units: 1,
    phase1_started_at: '2026-05-24T12:00:00.000Z',
    phase1_completed_at: '2026-05-24T12:03:00.000Z',
    phase2_started_at: '2026-05-24T12:03:00.000Z',
    phase2_completed_at: '2026-05-24T12:08:00.000Z',
    pass3_started_at: '2026-05-24T12:08:00.000Z',
    pass3_completed_at: '2026-05-24T12:10:00.000Z',
    manuscript_word_count: 1000,
    ...overrides,
  };
}

describe('EvaluationPoller complete handoff', () => {
  const reportNavigator = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens the canonical report automatically when a final completed job is visible at 100%', async () => {
    render(
      <EvaluationPoller
        jobId="024fd7d4-e5ef-4f32-9ad2-e63a237d7525"
        initialJob={makeCompleteJob()}
        redirectOnComplete
        reportNavigator={reportNavigator}
      />,
    );

    await waitFor(() => {
      expect(reportNavigator).toHaveBeenCalledWith('/reports/024fd7d4-e5ef-4f32-9ad2-e63a237d7525');
    });
  });

  it('opens a long-form report automatically after narrative synthesis completes', async () => {
    render(
      <EvaluationPoller
        jobId="024fd7d4-e5ef-4f32-9ad2-e63a237d7525"
        initialJob={makeCompleteJob({ manuscript_word_count: 84007 })}
        redirectOnComplete
        reportNavigator={reportNavigator}
      />,
    );

    await waitFor(() => {
      expect(reportNavigator).toHaveBeenCalledWith('/reports/024fd7d4-e5ef-4f32-9ad2-e63a237d7525');
    });
  });

  it('does not open a long-form report before narrative synthesis is ready', async () => {
    render(
      <EvaluationPoller
        jobId="024fd7d4-e5ef-4f32-9ad2-e63a237d7525"
        initialJob={makeCompleteJob({
          manuscript_word_count: 84007,
          pass3_completed_at: null,
        })}
        redirectOnComplete
        reportNavigator={reportNavigator}
      />,
    );

    await waitFor(() => {
      expect(reportNavigator).not.toHaveBeenCalled();
    });
  });
});
