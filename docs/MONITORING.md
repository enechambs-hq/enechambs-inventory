# Error monitoring, request ids and admin alerts

## Request ids (Phase 6)

The staff proxy (`/api/v1/*`) and the customer BFF (`/api/store/*`) accept an incoming `X-Request-ID` only if it is a UUID,
otherwise generate one. The id is forwarded to the API, returned to the browser in `X-Request-ID`, and included in the body of
any error these layers produce themselves (the proxy's 502/504, the BFF's refusals). When the API reports its own id it wins,
so one id follows a request from the browser to the API logs. `AppError.correlationId` reads it from the header or the body
(staff axios errors and customer `StoreFailure.requestId`). The API's error body now also has `status`, `details` (validation)
and a default `code`; the normalizer's kinds, messages and retry rules are unchanged (covered in `tests/request-id.test.mts`).

## Production monitoring (Phase 7): Sentry

`@sentry/nextjs` 11.x (declares support for Next 16). Hosting: **Vercel** (see README). Everything is inert unless a DSN is set.

| Piece | File |
|---|---|
| Browser init | `src/instrumentation-client.ts` |
| Server / edge init | `src/sentry.server.config.ts`, `src/sentry.edge.config.ts`, `src/instrumentation.ts` (`onRequestError`) |
| Options, scrubbing | `src/lib/monitoring/config.ts` |
| What counts as an incident | `src/lib/monitoring/report.ts` |
| Source maps | `next.config.ts` (only when `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` are all set at build) |

**Captured:** unhandled server-render and route-handler errors (`onRequestError`), client crashes and unhandled browser errors,
every exception that reaches an error boundary (`ErrorPanel`, `global-error`), and API answers with status **>= 500** seen by the
staff client or the customer client (tags: method, route without ids or query, status, code, `requestId`).
**Not captured:** 400/422, 401/403, 404, 409, 429 and failed requests with no answer. An identical repeating failure is sent at
most once a minute; the same request id is never sent twice.

**Sentry v11 collects user info, cookies, headers, bodies, URL query parameters, database/queue payloads, local variables and source
context by default when `dataCollection` is unset.** `RESTRICTIVE_DATA_COLLECTION` (`src/lib/monitoring/config.ts`) turns every
category off in all three initialisations (browser, Node server, edge: they share `buildMonitoringOptions`), plus
`sendDefaultPii: false`, `maxBreadcrumbs: 0` and a fixed `serverName`. Proven with the real SDKs and a recording transport in
`tests/monitoring-privacy-{browser,server,edge}.test.mts` (including Next's `onRequestError` path, and a control run with v11
defaults that does leak).

**Never sent:** user, cookies, headers, request bodies, query strings, breadcrumbs, session replay. Free text is scrubbed of
emails, phone numbers, tokens, ids and order numbers. Sampling: 5% default, capped at 20%.

Source maps are uploaded at build and then **deleted from the build output** (`deleteSourcemapsAfterUpload`), so they are not served.

### Variables (Vercel > Project Settings > Environment Variables)

`SENTRY_DSN` (server), `NEXT_PUBLIC_SENTRY_DSN` (browser; build-time), optional `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`
(default to `VERCEL_ENV` and `VERCEL_GIT_COMMIT_SHA`), `SENTRY_TRACES_SAMPLE_RATE`, `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`;
build-time only: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`. After adding a `NEXT_PUBLIC_*` value, redeploy.

### Alerts to create in Sentry (not created by code)

1. New issue, environment `production`, level `error`: notify the team.
2. **Frontend crash**: issue alert, filter `boundary:*` or `handled:no`, "new issue" and "seen more than 5 times in 10 minutes".
3. **API faults seen by users**: metric alert, filter `source:staff OR source:storefront`, `> 10` events in 5 minutes.
4. Do not alert on 4xx: they are not sent.

## Admin operational alerts

Header and Online Orders show "N new paid orders" and (administrators only) "N payments to review", from
`GET /admin/storefront-orders/alerts` (derived from the order rows, no extra table). One shared poller refreshes every 60 s while
the tab is visible and on focus (not within 15 s of the last answer), stops when hidden or when the admin interface unmounts,
and stops for good on 401/403/404.
