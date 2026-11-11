/**
 * Request / correlation ids at the Next.js edge (the staff proxy and the customer BFF).
 *
 * Same rule as the API: an incoming `X-Request-ID` is honoured only when it is a UUID (a fixed, opaque shape that cannot
 * carry a query string, an email or a token); anything else is replaced. The id is forwarded to the API, returned to the
 * browser in `X-Request-ID`, and put in the body of any error the edge itself produces, so one id follows a request from
 * the browser to the API logs. Pure: no Next imports (node:test loads it).
 */
export const REQUEST_ID_HEADER = 'x-request-id';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isValidRequestId = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

export const newRequestId = (): string => globalThis.crypto.randomUUID();

/** The incoming id if it is valid (lower-cased), otherwise a new one. */
export function resolveRequestId(incoming: string | null | undefined): string {
  return isValidRequestId(incoming) ? incoming.toLowerCase() : newRequestId();
}

/** The id the API reported if valid, otherwise the one we sent it. */
export function responseRequestId(upstream: Pick<Headers, 'get'> | undefined, sent: string): string {
  const reported = upstream?.get(REQUEST_ID_HEADER);
  return isValidRequestId(reported) ? reported.toLowerCase() : sent;
}
