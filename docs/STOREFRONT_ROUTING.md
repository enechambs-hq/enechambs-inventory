# Storefront routing, sessions and feature flag

Status: M0 foundations. No storefront pages exist yet; this document fixes the
rules that M2 (pages) and M3 (customer sessions) build on, and records what M0
already put in place. Backend counterpart: `enechambs-api/docs/STOREFRONT_FOUNDATIONS.md`.

## 1. Two audiences, two boundaries

| | Customers (public) | Staff and admins (internal) |
|---|---|---|
| Pages | `(storefront)` route group (M2) | `(inventory)` and `(auth)` groups, unchanged |
| Login | `/account/login`, `/account/register` (M3) | `/login`, `/setup-password`, unchanged |
| Session token | **HttpOnly cookie `ene_cust`**, set only by Route Handlers | `localStorage` + the existing JS cookie `token`, unchanged |
| Reaches the API through | `/api/store/*` (customer BFF, this milestone) | `/api/v1/*` (existing proxy, untouched) |
| Backend namespace | `storefront/*` only | everything else |
| Enforcement | backend customer guard + ownership in every query | backend `JwtAuthGuard` + `@Roles` |

The two never share a cookie, token, secret, route handler or backend guard.
`src/proxy.ts` inspects only the admin `token` cookie and does not know the
customer cookie exists.

**Route groups do not change URLs.** A public `/combos` and an admin `/combos`
would collide at build time. Admin pages for the promotion therefore live under
`/promotions/*` (inside `(inventory)`), public pages under `/`, `/combos`,
`/cart`, `/checkout`, `/my-orders`, `/account/*`.

## 2. Feature flag: production is unchanged until launch

`STOREFRONT_ENABLED` is a **server-side** environment variable (not
`NEXT_PUBLIC_`, which is inlined into the browser bundle at build time and would
need a rebuild to change). `src/lib/server/flags.ts` reads it per request.

- Unset or anything other than the exact string `true`: the customer BFF
  returns 404, and (from M2) `/` keeps redirecting to `/login` exactly as today.
- M0 changes **no** existing page, layout, `proxy.ts` or admin proxy behaviour.
  Verified: with the flag off, `/login` serves, protected pages still redirect
  to `/login` without a token, and `/api/v1/*` still reaches the backend.

Planned for M2 (not done in M0): replace `src/app/page.tsx` with the storefront
landing page (checks the flag, redirects to `/login` when off); move
`AuthProvider` from the root layout into the `(auth)` and `(inventory)` layouts
so public pages run no admin session code; extend `proxy.ts` with an **exact**
match for `/` and prefix matches for storefront paths while keeping its
fail-closed default.

## 3. The customer BFF (`src/app/api/store/[...path]/route.ts`)

`route.ts` is a thin wrapper. The behaviour lives in
`src/lib/server/store-bff.ts` (`handleStoreRequest`, web-standard `Request` and
`Response` only, `fetch` and environment injected) so it is unit-tested without
Next.js: `tests/store-bff.test.mts`.

`browser → /api/store/storefront/<...> → <BACKEND_URL>/api/v1/storefront/<...>`

Rules enforced in the handler (Route Handlers are public endpoints; Next.js
docs warn a Proxy matcher cannot be relied on to cover them):

1. Flag off → 404. `BFF_SHARED_SECRET` missing → 503.
2. Path allowlist: segments must be `storefront/<...>`, characters `A-Za-z0-9._~-`
   only, no `.`/`..`, 2 to 6 segments. Staff routes and the payment webhook are
   unreachable through it. (The webhook goes from Flutterwave straight to the
   API, never through Next.)
3. Methods: GET, POST, PATCH, DELETE.
4. Auth: the handler reads the `ene_cust` cookie, checks it looks like a JWT
   and sets `Authorization` itself. A browser `Authorization` header is dropped.
5. Header allowlist upstream: `accept`, `content-type` (JSON), a validated
   `Idempotency-Key`, the cookie-derived `Authorization`, and the signed-IP
   headers. Everything else the browser sent is dropped, so `x-bff-*` cannot be
   injected.
6. CSRF: state-changing requests need an `Origin` equal to the request's own
   origin (rebuilt from `Host`) or `STOREFRONT_PUBLIC_URL`. Body must be JSON.
   These checks run before any body is read.
   **Body size** (`MAX_BODY_BYTES`, 64 KB) is enforced while *streaming* the
   body (`readBodyWithLimit` in `src/lib/server/bff.ts`): bytes are counted per
   chunk (not string characters), and the first chunk that crosses the limit
   stops the read, cancels the stream and returns 413 without contacting the
   API. `Content-Length` is used only as an early refusal when it declares an
   oversized body; a missing, false or non-numeric value changes nothing,
   because the stream count is the enforcement. Nothing is retained beyond the
   limit. What is forwarded are the exact bytes received. (Whether the
   underlying socket keeps draining after the cancel is up to the runtime; the
   application neither buffers nor forwards the excess.)
7. `Set-Cookie` from the API is never forwarded. Session cookies are set by
   dedicated handlers (M3), e.g. `src/app/api/store/auth/login/route.ts`, which
   take precedence over this catch-all because specific segments beat `[...path]`.
8. Responses are `Cache-Control: no-store`; 15 s upstream timeout.

### Signed client IP
So the API can rate-limit per visitor instead of per proxy, the handler adds
`x-bff-client-ip`, `x-bff-timestamp`, `x-bff-signature` (HMAC-SHA256 with
`BFF_SHARED_SECRET`). The algorithm and golden vectors are identical in both
repositories (`tests/bff.test.mts` here,
`src/common/client-ip/client-ip-signature.spec.ts` in the API).

Where the address comes from: Vercel overwrites `x-forwarded-for` and does not
forward a client-supplied one, and `x-vercel-forwarded-for` is identical
(Vercel docs, "Request headers"). That guarantee exists only on Vercel, so the
handler honours those headers **only when `VERCEL=1`**. Elsewhere (local dev) a
browser could set them, so they are ignored and the API uses its socket bucket.
The value selects a rate-limit bucket only; it is never used for authorisation.
To be confirmed once on the first real deployment: send a request with a forged
`X-Forwarded-For` and check the API logs/limits treat it as the real address.

## 4. Next.js 16 conventions confirmed (bundled docs, `node_modules/next/dist/docs/01-app`)

- `03-api-reference/03-file-conventions/route.md`: handlers take
  `(request: NextRequest, { params }: { params: Promise<...> })`; `params` is a
  Promise and must be awaited; `request.cookies` is available.
- `03-api-reference/04-functions/cookies.md`: `cookies()` is async; cookies can
  only be **set** in Route Handlers or Server Functions, never while rendering a
  Server Component (so the M3 login/logout handlers must be Route Handlers).
- `03-api-reference/03-file-conventions/proxy.md`: `proxy.ts` runs for every
  route unless a `matcher` excludes it; **Server Functions are not separate
  routes**, so a matcher change can silently drop their coverage. Verify auth
  inside each handler and Server Function; never rely on the proxy alone.
- `02-guides/backend-for-frontend.md`: Route Handlers are public HTTP endpoints.
- `03-api-reference/03-file-conventions/route-groups.md`: groups do not affect
  the URL path (collision rule above).
- `03-api-reference/05-config/01-next-config-js/images.md`: remote images need
  `images.remotePatterns` (M1, for the R2 media domain).

## 5. Environment variables (frontend, server-side; names only)

| Variable | Purpose |
|---|---|
| `BACKEND_URL` | API origin used by both proxies (existing; defaults to the Render URL) |
| `NEXT_PUBLIC_API_URL` | existing browser base URL for the admin axios client |
| `STOREFRONT_ENABLED` | feature flag, default off |
| `BFF_SHARED_SECRET` | signs forwarded client IPs; **same value as the API's**; at least 32 chars |
| `STOREFRONT_PUBLIC_URL` | optional customer-facing origin, an extra allowed `Origin` |

## 6. Tests
`npm test` runs `tests/*.test.mts` with Node's built-in runner (no new
dependency): golden signature vectors shared with the API, client-IP source
rules, path allowlist (traversal, encoding, staff and webhook paths), origin
rules, header sanitising and the flag. `tsconfig.json` sets
`allowImportingTsExtensions` solely so those tests can import `.ts` files.
