/**
 * Staff transport time limits, in one place so the layers stay in the right order:
 *
 *   upstream (proxy -> backend)  <  function budget (maxDuration)  <  browser (axios)
 *
 * so the browser always receives the proxy's structured 502/504 instead of giving up first, and the platform never
 * cuts the function off before it can answer.
 *
 * The customer BFF uses 15s for its upstream. Staff screens read heavier data (reports, long lists) and the API runs on
 * a host that can be slow to wake after idling, so the staff proxy allows a little longer: 25s.
 */
export const STAFF_PROXY_UPSTREAM_TIMEOUT_MS = 25_000;
/** The proxy route's `maxDuration` (30s) is declared as a literal in the route file, because Next reads it statically. */
/** The staff axios client gives up only after the proxy has had time to answer with its own 504. */
export const STAFF_API_CLIENT_TIMEOUT_MS = 35_000;
