/**
 * Process-wide mutex for all txs signed by OWNER_PRIVATE_KEY / ECLAIM_PRIVATE_KEY.
 * Prevents nonce races when claim submit + citizen/provider register run concurrently
 * (e.g. many seed workers hitting one backend).
 *
 * Important: Apeiro RPC often ignores "pending" nonces. After broadcast, hold the lock
 * until the tx is mined (see extendChainWriteLock) so the next send never reuses a nonce.
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

/**
 * Keep the mutex busy until `hold` settles (typically tx.wait()), without blocking the
 * current request's return value. Next withChainWriteLock callers wait for this.
 */
export function extendChainWriteLock(hold: Promise<unknown>): void {
  chainWriteLock = chainWriteLock.then(
    () => hold.then(() => undefined, () => undefined),
    () => hold.then(() => undefined, () => undefined),
  );
}
