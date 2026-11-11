/**
 * Turns whatever failed into an `AppError`.
 *
 * Inputs it understands: an AppError (returned as is), an axios error (staff client), a customer-API `StoreFailure`,
 * a catalogue `FailureKind` result, a fetch/DOM error, and anything else (safely, as "unexpected").
 *
 * Rules that matter:
 *  - The KIND comes from the transport facts (status, code, error name), never from message text.
 *  - Server text is shown only when it looks like a plain, short sentence the API wrote for a person, and only for
 *    statuses where the API writes such sentences (400, 409, 422). Everything else gets this app's own wording. 5xx,
 *    401, 403, 404 and 429 text is never shown: it is generic framework text or may describe the server's insides.
 *  - Retry is conservative: only a request that is safe to repeat (GET/HEAD/OPTIONS, or one the caller marked
 *    idempotent) AND failed in a transient way (network, timeout, 502/503/504, other 5xx). It is a flag for a person's
 *    "Try again" button. Nothing here retries anything.
 */
import { FALLBACK_MESSAGES, isAppError, makeAppError, type AppError, type ErrorKind } from './app-error.ts';

export interface NormalizeOptions {
  /** The HTTP method of the failed request, when known. Unknown is treated as "not safe to repeat". */
  method?: string;
  /** The caller knows repeating this (non-GET) request has the same effect as sending it once, e.g. a price quote. */
  idempotent?: boolean;
  /** `load` (default) or `change`: what the person was doing. Only affects wording. */
  action?: 'load' | 'change';
  /** Plural subject for wording, e.g. "online orders": "You do not have permission to view online orders." */
  what?: string;
  /** Singular subject for wording, e.g. "order": "We could not find that order." */
  one?: string;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// ── small helpers ────────────────────────────────────────────────────────────

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const asString = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** Generic framework answers say nothing a person can use; the app's own wording is better. */
const GENERIC_SERVER_TEXT =
  /^(bad request|unauthorized|forbidden( resource)?|not found|conflict|internal server error|service unavailable|bad gateway|gateway timeout|too many requests|unprocessable entity|validation failed|throttlerexception.*|cannot (get|post|put|patch|delete) .*)$/i;

/** Text that is about code or infrastructure, not for people. */
const TECHNICAL_TEXT =
  /(\bat\s+[\w$.<>]+\s*\(|\.(ts|tsx|js|mjs|cjs):\d+|node_modules|\bstack\b|traceback|exception\b|\bECONN\w*|\bENOTFOUND\b|\bETIMEDOUT\b|\bSELECT\s.+\sFROM\b|\bINSERT\s+INTO\b|\bUPDATE\s+\S+\s+SET\b|\bDELETE\s+FROM\b|violates .* constraint|relation ".*"|password authentication|\b(typeorm|postgres|prisma|nestjs|axios)\b|^\s*\w*Error:|<\/?[a-z!][^>]*>|[\r\n])/i;

/**
 * Text that could carry something private or internal: submitted values (email addresses, phone numbers, passwords,
 * tokens, long opaque ids), credentials, addresses and hosts of our infrastructure, file paths and raw JSON. A server
 * sentence that matches any of these is never shown (the app's own wording is used instead).
 */
const SENSITIVE_TEXT = new RegExp(
  [
    String.raw`[\w.+-]+@[\w-]+(?:\.[\w-]+)+`, // an email address
    String.raw`\beyJ[\w-]{8,}\.[\w-]{8,}`, // a JWT
    String.raw`\b(?:bearer|basic)\s+[\w.~+/=-]{8,}`, // an Authorization value
    String.raw`\b(?:password|passwd|pwd|token|secret|api[_ -]?key|authorization|cookie|session)\b\s*[:=]`, // key=value credentials
    String.raw`[A-Za-z0-9_-]{32,}`, // a long opaque string (token, hash, key)
    String.raw`\b(?:sk|pk|rk)_(?:live|test)_\w*|\bFLW(?:SECK|PUBK)\w*|\bgh[pousr]_\w+`, // a recognisable API key prefix
    String.raw`\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b`, // an internal UUID
    String.raw`\+\d{8,}|\b0\d{9,10}\b|\b\d{11,}\b`, // a phone number or other long number
    String.raw`\b\d{1,3}(?:\.\d{1,3}){3}\b`, // an IPv4 address
    String.raw`\blocalhost\b|\bhttps?://|\bfile://|\b[\w.-]+:\d{2,5}\b`, // a URL or host:port
    String.raw`\b[\w-]+\.(?:internal|local|onrender\.com|vercel\.app|neon\.tech|amazonaws\.com)\b`, // our hosting
    String.raw`(?:^|[\s("'])/(?:[\w.@-]+/)+[\w.@-]*|[A-Za-z]:\\|\.\./`, // a file path
    String.raw`[{\[]\s*"`, // raw JSON
    String.raw`\b[A-Z][A-Z0-9]*_(?:URL|KEY|SECRET|TOKEN|PASSWORD|HOST)\b|process\.env`, // environment variable names
  ].join('|'),
  'i',
);

/** The API's own plain sentence, or null when it must not be shown. */
export function safeServerMessage(raw: unknown): string | null {
  const text = asString(raw);
  if (!text || text.length > 300) return null;
  if (GENERIC_SERVER_TEXT.test(text) || TECHNICAL_TEXT.test(text) || SENSITIVE_TEXT.test(text)) return null;
  return text;
}

/** Statuses where this API writes sentences meant for the person who made the request. */
const AUTHORED_MESSAGE_STATUSES = new Set([400, 409, 422]);

/** Codes are upper-snake identifiers. Anything else (free text, paths) is dropped. */
export function safeCode(raw: unknown): string | undefined {
  const text = asString(raw);
  return text && /^[A-Z][A-Z0-9_]{2,63}$/.test(text) ? text : undefined;
}

const ID_HEADERS = ['x-request-id', 'x-correlation-id'];
const ID_BODY_KEYS = ['requestId', 'correlationId'];

/** Looks for a request/correlation id in the response headers or body. None of the current APIs send one yet. */
function findCorrelationId(headers: unknown, body: unknown): string | undefined {
  const pick = (v: unknown) => {
    const text = asString(v);
    return text && /^[A-Za-z0-9._:-]{6,80}$/.test(text) ? text : undefined;
  };
  if (isObject(headers)) {
    const getter = typeof (headers as { get?: unknown }).get === 'function' ? (headers as { get: (n: string) => unknown }) : null;
    for (const name of ID_HEADERS) {
      const value = getter ? getter.get(name) : Object.entries(headers).find(([k]) => k.toLowerCase() === name)?.[1];
      const id = pick(value);
      if (id) return id;
    }
  }
  if (isObject(body)) {
    for (const key of ID_BODY_KEYS) {
      const id = pick(body[key]);
      if (id) return id;
    }
  }
  return undefined;
}

// ── classification ───────────────────────────────────────────────────────────

/** HTTP status -> kind. 400 and 422 are "the request was rejected as invalid input" (see the inspection note in the docs). */
export function kindFromStatus(status: number): ErrorKind {
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 400 || status === 422) return 'validation';
  if (status === 429) return 'rate_limited';
  if (status === 504 || status === 408) return 'timeout';
  if (status === 502 || status === 503) return 'unavailable';
  return 'unexpected';
}

const TRANSIENT_KINDS = new Set<ErrorKind>(['network', 'timeout', 'unavailable']);

/**
 * Whether a person's "Try again" on the SAME request is reasonable. Writes are never retryable; non-transient failures
 * (401, 403, 404, 409, 422/400, 429) are not retryable because repeating them unchanged cannot succeed or needs the person
 * to act first. A plain 500 on a safe request may be a passing fault, so a manual retry is allowed; other statuses with no
 * kind of their own (501, 505, ...) are not transient and are not retryable.
 */
export function isRetryable(kind: ErrorKind, status: number | undefined, options: Pick<NormalizeOptions, 'method' | 'idempotent'> = {}): boolean {
  const safe = options.idempotent === true || SAFE_METHODS.has((options.method ?? '').toUpperCase());
  if (!safe) return false;
  if (TRANSIENT_KINDS.has(kind)) return true;
  return kind === 'unexpected' && status === 500;
}

/** The wording for a kind, with the subject filled in where the caller supplied one. */
export function messageForKind(kind: ErrorKind, options: Pick<NormalizeOptions, 'action' | 'what' | 'one'> = {}): string {
  if (kind === 'forbidden') {
    if (options.action === 'change') return 'You do not have permission to make this change.';
    return options.what ? `You do not have permission to view ${options.what}.` : FALLBACK_MESSAGES.forbidden;
  }
  if (kind === 'not_found' && options.one) return `We could not find that ${options.one}. It may have been removed.`;
  return FALLBACK_MESSAGES[kind];
}

interface Facts {
  kind: ErrorKind;
  status?: number;
  code?: string;
  /** The server's text, if any (judged for safety below). */
  serverText?: unknown;
  /** Validation messages when the API sent a list. */
  list?: unknown[];
  /** A message already approved by this app (e.g. the storefront's code table). Used as is. */
  trusted?: string;
  correlationId?: string;
}

function build(facts: Facts, options: NormalizeOptions): AppError {
  const { kind, status } = facts;
  let message = messageForKind(kind, options);
  let details: string[] | undefined;

  const mayShowServerText = status !== undefined && AUTHORED_MESSAGE_STATUSES.has(status);
  if (facts.trusted) {
    message = facts.trusted;
  } else if (mayShowServerText) {
    const list = (facts.list ?? []).map(safeServerMessage).filter((m): m is string => m !== null).slice(0, 5);
    const single = safeServerMessage(facts.serverText);
    if (list.length > 0) {
      details = list;
      message = list.slice(0, 3).join('. ');
    } else if (single) {
      message = single;
    }
  }

  return makeAppError({
    kind,
    ...(status !== undefined ? { status } : {}),
    ...(facts.code ? { code: facts.code } : {}),
    message,
    retryable: isRetryable(kind, status, options),
    ...(facts.correlationId ? { correlationId: facts.correlationId } : {}),
    ...(details ? { details } : {}),
  });
}

// ── adapters ─────────────────────────────────────────────────────────────────

/** Reads `{ message, code }` out of an API error body, whatever its exact shape. */
function readBody(body: unknown): { serverText?: unknown; list?: unknown[]; code?: string } {
  if (!isObject(body)) return { serverText: typeof body === 'string' && !/^\s*</.test(body) ? body : undefined };
  const message = body.message;
  return {
    serverText: Array.isArray(message) ? undefined : message,
    list: Array.isArray(message) ? message : undefined,
    code: safeCode(body.code),
  };
}

const TIMEOUT_CODES = new Set(['ECONNABORTED', 'ETIMEDOUT', 'ERR_TIMEOUT']);
const NETWORK_CODES = new Set(['ERR_NETWORK', 'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE']);

/** The staff axios client (or any axios-shaped error: `{ response?, config?, code?, message? }`). */
export function fromAxiosError(error: unknown, options: NormalizeOptions = {}): AppError {
  const e = (error ?? {}) as { response?: { status?: unknown; data?: unknown; headers?: unknown }; config?: { method?: unknown }; code?: unknown; name?: unknown; message?: unknown };
  const method = options.method ?? (typeof e.config?.method === 'string' ? e.config.method : undefined);
  const opts = { ...options, method };
  const status = typeof e.response?.status === 'number' ? e.response.status : undefined;

  if (status === undefined) {
    const code = typeof e.code === 'string' ? e.code : '';
    const text = typeof e.message === 'string' ? e.message : '';
    if (e.name === 'TimeoutError' || TIMEOUT_CODES.has(code) || /timeout/i.test(text)) return build({ kind: 'timeout' }, opts);
    if (e.name === 'AbortError' || code === 'ERR_CANCELED') return build({ kind: 'unexpected' }, opts);
    // Axios reports a failed connection as ERR_NETWORK. An error with no response and no network signal is NOT assumed to be
    // the network (that would offer a retry for a bug).
    if (NETWORK_CODES.has(code) || /network|failed to fetch|fetch failed/i.test(text)) return build({ kind: 'network' }, opts);
    return build({ kind: 'unexpected' }, opts);
  }

  const body = readBody(e.response?.data);
  const code = body.code;
  // The staff proxy's own answers: a timeout is a timeout even though it arrives as HTTP 504, and 502 is unavailable.
  const kind = code === 'UPSTREAM_TIMEOUT' ? 'timeout' : code === 'UPSTREAM_UNAVAILABLE' ? 'unavailable' : kindFromStatus(status);
  return build({ kind, status, code, ...body, correlationId: findCorrelationId(e.response?.headers, e.response?.data) }, opts);
}

/** Shape of the customer client's failure (see lib/storefront/store-client.ts); declared here so this module stays import-free. */
export interface StoreFailureLike {
  ok: false;
  kind: string;
  status: number;
  code?: string;
  message: string;
  requestId?: string;
}

/** The storefront's own friendly wording for API codes, passed in by the adapter so this module does not import it. */
export type CodeMessageLookup = (failure: StoreFailureLike) => string | undefined;

export function isStoreFailure(value: unknown): value is StoreFailureLike {
  return isObject(value) && value.ok === false && typeof value.kind === 'string' && typeof value.status === 'number' && typeof value.message === 'string';
}

/** A customer-API result (the existing `StoreFailure`). The original object is not changed. */
export function fromStoreFailure(failure: StoreFailureLike, options: NormalizeOptions = {}, codeMessage?: CodeMessageLookup): AppError {
  const status = failure.status;
  let kind: ErrorKind;
  if (status === 0) kind = 'network';
  else if (status > 0 && kindFromStatus(status) !== 'unexpected') kind = kindFromStatus(status);
  else if (failure.kind === 'unauthenticated') kind = 'unauthenticated';
  else if (failure.kind === 'validation') kind = 'validation';
  else if (failure.kind === 'conflict') kind = 'conflict';
  else if (failure.kind === 'not_found') kind = 'not_found';
  else if (failure.kind === 'rate_limited') kind = 'rate_limited';
  else if (failure.kind === 'unavailable') kind = 'unavailable';
  else kind = 'unexpected';

  const code = safeCode(failure.code);
  const trusted = code ? codeMessage?.(failure) : undefined;
  return build(
    { kind, status: status > 0 ? status : undefined, code, trusted, serverText: failure.message, correlationId: findCorrelationId(undefined, { requestId: failure.requestId }) },
    options,
  );
}

/** A catalogue read result (`FailureKind` from lib/storefront/catalogue-client.ts). It is always a GET. */
export function fromCatalogueFailure(failure: { kind: string; status: number }, options: NormalizeOptions = {}): AppError {
  const kind: ErrorKind =
    failure.status === 0
      ? 'network'
      : failure.status === 504
        ? 'timeout'
        : failure.kind === 'not_found'
          ? 'not_found'
          : failure.kind === 'rate_limited'
            ? 'rate_limited'
            : failure.kind === 'unavailable'
              ? 'unavailable'
              : 'unexpected';
  return build({ kind, status: failure.status > 0 ? failure.status : undefined }, { method: 'GET', ...options });
}

/** Any thrown value. Never throws itself and never returns raw exception text. */
export function normalizeError(error: unknown, options: NormalizeOptions = {}): AppError {
  if (isAppError(error)) return error;
  if (isStoreFailure(error)) return fromStoreFailure(error, options);
  if (isObject(error) && (isObject(error.response) || isObject(error.config) || error.isAxiosError === true || typeof error.code === 'string')) {
    return fromAxiosError(error, options);
  }
  if (error instanceof Error || isObject(error)) {
    const name = String((error as { name?: unknown }).name ?? '');
    const text = String((error as { message?: unknown }).message ?? '');
    if (name === 'TimeoutError') return build({ kind: 'timeout' }, options);
    if (/^network error$|failed to fetch|fetch failed|load failed|networkerror when attempting/i.test(text) && (name === 'TypeError' || name === 'Error' || name === 'AxiosError')) return build({ kind: 'network' }, options);
  }
  return build({ kind: 'unexpected' }, options);
}
