/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { useFailedJobRecovery } from '@/components/evaluation/FailedJobRecovery';

const AUTO_RESUME_STORAGE_KEY = 'revisiongrade:auto-resume-attempted:job-auto-resume-1';

function checkpointProgress() {
  return {
    pass1_checkpoint_resume: {
      cached_chunks: 1,
      expected_chunks: 1,
    },
  };
}

async function flushHookEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useFailedJobRecovery auto-resume guard', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.useFakeTimers();
    window.sessionStorage.clear();
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: true }),
    } as Response)) as typeof fetch;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    global.fetch = originalFetch;
    window.sessionStorage.clear();
  });

  test('does not auto-resume again after refresh when polling sees queued state', async () => {
    const onResumed = jest.fn();
    const firstMount = renderHook(() => useFailedJobRecovery(
      'job-auto-resume-1',
      'failed',
      checkpointProgress(),
      onResumed,
    ));

    await flushHookEffects();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/jobs/job-auto-resume-1/resume',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(window.sessionStorage.getItem(AUTO_RESUME_STORAGE_KEY)).toBe('true');

    firstMount.unmount();
    (global.fetch as jest.Mock).mockClear();

    renderHook(() => useFailedJobRecovery(
      'job-auto-resume-1',
      'queued',
      checkpointProgress(),
      onResumed,
    ));

    await flushHookEffects();

    expect(global.fetch).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(AUTO_RESUME_STORAGE_KEY)).toBeNull();
  });

  test('sessionStorage guard blocks repeated auto-resume for same failed job after reload', async () => {
    window.sessionStorage.setItem(AUTO_RESUME_STORAGE_KEY, 'true');

    renderHook(() => useFailedJobRecovery(
      'job-auto-resume-1',
      'failed',
      checkpointProgress(),
    ));

    await flushHookEffects();

    expect(global.fetch).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(AUTO_RESUME_STORAGE_KEY)).toBe('true');
  });

  test('does not auto-resume a user-cancelled failed job', async () => {
    const cancelledProgress = {
      ...checkpointProgress(),
      cancelled_by_user: true,
      dashboard_status: 'cancelled',
    };

    renderHook(() => useFailedJobRecovery(
      'job-auto-resume-1',
      'failed',
      cancelledProgress,
    ));

    await flushHookEffects();

    expect(global.fetch).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(AUTO_RESUME_STORAGE_KEY)).toBeNull();
  });
});
