/**
 * "Only the newest request counts." `next()` starts a request and returns its ticket; a response should be applied only if
 * `isCurrent(ticket)` is still true when it arrives. Superseded and cancelled requests are therefore ignored.
 */
export function createLatest() {
  let current = 0;
  return {
    next: () => ++current,
    isCurrent: (ticket: number) => ticket === current,
    /** Invalidates every request in flight (e.g. the query was cleared). */
    cancel: () => {
      current += 1;
    },
  };
}
