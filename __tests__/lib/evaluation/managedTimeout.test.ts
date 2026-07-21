import { withManagedTimeout } from '@/lib/evaluation/managedTimeout';

describe('withManagedTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('returns the protected result and clears the losing timeout', async () => {
    const result = withManagedTimeout(
      Promise.resolve('complete'),
      60_000,
      () => {
        throw new Error('SHOULD_NOT_FIRE');
      },
    );

    await expect(result).resolves.toBe('complete');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('preserves a protected rejection and clears the losing timeout', async () => {
    const result = withManagedTimeout(
      Promise.reject(new Error('PROTECTED_FAILURE')),
      60_000,
      () => {
        throw new Error('SHOULD_NOT_FIRE');
      },
    );

    await expect(result).rejects.toThrow('PROTECTED_FAILURE');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('preserves a rejecting timeout outcome', async () => {
    const protectedOperation = new Promise<string>(() => undefined);
    const result = withManagedTimeout(
      protectedOperation,
      60_000,
      () => {
        throw new Error('OPERATION_TIMEOUT');
      },
    );
    const rejection = expect(result).rejects.toThrow('OPERATION_TIMEOUT');

    await jest.advanceTimersByTimeAsync(60_000);

    await rejection;
    expect(jest.getTimerCount()).toBe(0);
  });

  it('preserves a resolved fallback timeout outcome', async () => {
    const protectedOperation = new Promise<string>(() => undefined);
    const fallback = { timedOut: true } as const;
    const result = withManagedTimeout(
      protectedOperation,
      30_000,
      () => fallback,
    );

    await jest.advanceTimersByTimeAsync(30_000);

    await expect(result).resolves.toBe(fallback);
    expect(jest.getTimerCount()).toBe(0);
  });
});
