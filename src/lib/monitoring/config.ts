/**
 * Production error monitoring (Sentry) for the Next.js app: configuration and scrubbing. Pure (no SDK import), so it is
 * unit tested and safe to load anywhere. The SDK is initialised in `instrumentation-client.ts` (browser),
 * `sentry.server.config.ts` and `sentry.edge.config.ts`; each is a no-op unless a DSN is configured.
 *
 * Privacy rules enforced here (a second line of defence on top of what the app chooses to send): no user, cookies,
 * headers, request bodies, query strings, breadcrumbs or session replay. Free text that does reach an event is scrubbed
 * of emails, phone numbers, tokens and ids.
 */

/**
 * Sentry v11 collects user info, cookies, headers, HTTP bodies, URL query parameters, database/queue payloads, local
 * variables and source context BY DEFAULT when `dataCollection` is unset. Every category is disabled explicitly, in every
 * runtime (browser, Node server, edge: all three initialisations use `buildMonitoringOptions`), so the SDK's automatic
 * instrumentation does not gather it in the first place; `scrubEvent` is only a second line of defence. The request id
 * is attached as an explicit tag, not through header collection.
 */
export const RESTRICTIVE_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: false, response: false },
  httpBodies: [] as Array<'incomingRequest' | 'outgoingRequest' | 'incomingResponse' | 'outgoingResponse'>,
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  mcp: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
  frameContextLines: 0,
};

export interface MonitoringEnv {
  dsn?: string;
  environment?: string;
  release?: string;
  tracesSampleRate?: string;
  nodeEnv?: string;
}

export const DEFAULT_TRACES_SAMPLE_RATE = 0.05;
export const MAX_TRACES_SAMPLE_RATE = 0.2;

export function tracesSampleRate(raw: string | undefined): number {
  const n = raw === undefined || raw.trim() === '' ? NaN : Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_TRACES_SAMPLE_RATE;
  return Math.min(n, MAX_TRACES_SAMPLE_RATE);
}

const DSN = /^https:\/\/[A-Za-z0-9]+(?::[A-Za-z0-9]+)?@[A-Za-z0-9.-]+(?::\d+)?\/\d+$/;

/** Browser noise that is not an application fault. */
const IGNORED_ERRORS = [
  'ResizeObserver loop limit exceeded',
  'ResizeObserver loop completed with undelivered notifications',
  /^AbortError/,
];
const DENIED_URLS = [/^chrome-extension:\/\//i, /^moz-extension:\/\//i, /^safari-(web-)?extension:\/\//i];

/** The SDK options, or null when monitoring is not configured (no DSN, or a malformed one). */
export function buildMonitoringOptions(env: MonitoringEnv) {
  const dsn = env.dsn?.trim();
  if (!dsn || !DSN.test(dsn)) return null;
  return {
    dsn,
    // Distinguishes production from preview/development events (Vercel's VERCEL_ENV is mapped by next.config.ts).
    environment: env.environment?.trim() || env.nodeEnv || 'development',
    // Ties an event to the deployed commit (VERCEL_GIT_COMMIT_SHA, mapped by next.config.ts).
    release: env.release?.trim() || undefined,
    tracesSampleRate: tracesSampleRate(env.tracesSampleRate),
    sendDefaultPii: false,
    // A fixed name instead of the machine's host name.
    serverName: 'enechambs-frontend',
    dataCollection: {
      ...RESTRICTIVE_DATA_COLLECTION,
      httpHeaders: { ...RESTRICTIVE_DATA_COLLECTION.httpHeaders },
      httpBodies: [...RESTRICTIVE_DATA_COLLECTION.httpBodies],
      graphQL: { ...RESTRICTIVE_DATA_COLLECTION.graphQL },
      genAI: { ...RESTRICTIVE_DATA_COLLECTION.genAI },
      mcp: { ...RESTRICTIVE_DATA_COLLECTION.mcp },
    },
    maxBreadcrumbs: 0,
    beforeBreadcrumb: () => null,
    beforeSend: scrubEvent,
    ignoreErrors: IGNORED_ERRORS,
    denyUrls: DENIED_URLS,
  };
}

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const JWT = /\beyJ[\w-]{8,}\.[\w-]{8,}(?:\.[\w-]*)?/g;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const LONG_TOKEN = /[A-Za-z0-9_-]{32,}/g;
const PHONE = /\+\d{8,}|\b0\d{9,10}\b|\b\d{11,}\b/g;
const ORDER_NUMBER = /\bENE-[A-Z0-9]{8}\b/g;

/** Free text safe to send: emails, tokens, ids, phone numbers and order numbers are replaced. */
export function scrubText(text: string): string {
  return text
    .replace(JWT, '[token]')
    .replace(EMAIL, '[email]')
    .replace(UUID, '[id]')
    .replace(ORDER_NUMBER, '[order]')
    .replace(PHONE, '[number]')
    .replace(LONG_TOKEN, '[token]')
    .slice(0, 500);
}

const pathOnly = (url: unknown): string | undefined => {
  if (typeof url !== 'string') return undefined;
  const path = url.replace(/^[a-z]+:\/\/[^/]+/i, '').split('?')[0].split('#')[0];
  return path.startsWith('/') ? scrubText(path).slice(0, 300) : undefined;
};

/** Removes everything personal the SDK attached on its own and scrubs free text. Never returns null. */
type Obj = Record<string, unknown>;

export function scrubEvent<T extends object>(event: T): T {
  const out = { ...event } as Obj & { message?: unknown; exception?: { values?: Obj[] }; request?: Obj; contexts?: Obj };
  delete out.user;
  delete out.extra;
  delete out.breadcrumbs;
  delete out.server_name;
  if (typeof out.message === 'string') out.message = scrubText(out.message);
  if (out.exception?.values) {
    out.exception = {
      ...out.exception,
      values: out.exception.values.map((v) => ({ ...v, ...(typeof v.value === 'string' ? { value: scrubText(v.value as string) } : {}) })),
    };
  }
  if (out.request) {
    const url = pathOnly(out.request.url);
    out.request = { ...(typeof out.request.method === 'string' ? { method: out.request.method } : {}), ...(url ? { url } : {}) };
  }
  if (out.contexts) {
    const { runtime, os, browser, trace } = out.contexts as Obj;
    out.contexts = { ...(runtime ? { runtime } : {}), ...(os ? { os } : {}), ...(browser ? { browser } : {}), ...(trace ? { trace } : {}) };
  }
  return out as T;
}
