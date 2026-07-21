/**
 * Process-wide mutex for all txs signed by OWNER_PRIVATE_KEY / ECLAIM_PRIVATE_KEY.
 * Prevents nonce races when claim submit + citizen/provider register run concurrently
 * (e.g. many seed workers hitting one backend).
 */
let chainWriteLock: Promise<void> = Promise.resolve();

export function withChainWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chainWriteLock.then(() => fn());
  chainWriteLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
