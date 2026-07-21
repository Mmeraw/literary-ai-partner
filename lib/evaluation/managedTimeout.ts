/**
 * Races an operation against a timeout while retaining explicit ownership of
 * the timeout handle.
 *
 * Native `Promise.race()` does not cancel its losing promise. A timeout built
 * with `setTimeout()` therefore remains live after the protected operation has
 * already settled, which can keep workers and Jest processes alive until the
 * full timeout expires. This helper preserves the existing race semantics but
 * always clears the timer as soon as either outcome wins.
 *
 * The protected operation is intentionally not cancelled when the timeout
 * wins. Callers retain their existing late-settlement/idempotency policy.
 */
export async function withManagedTimeout<TResult, TTimeout = never>(
  operation: PromiseLike<TResult>,
  timeoutMs: number,
  onTimeout: () => TTimeout | PromiseLike<TTimeout>,
): Promise<TResult | TTimeout> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<TTimeout>((resolve, reject) => {
    timer = setTimeout(() => {
      try {
        resolve(onTimeout());
      } catch (error) {
        reject(error);
      }
    }, timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(operation), timeout]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}
