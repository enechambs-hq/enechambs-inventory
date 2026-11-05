# Storefront routing, sessions and feature flag

Status: M0 foundations, M2b (public pages, section 7), M3 (customer session handlers, sections 8 and 9), M3.5 and M4 (cart, accounts, checkout, orders; sections 10 and 11). This document fixes
the rules the storefront milestones build on. Backend counterpart: `enechambs-api/docs/STOREFRONT_FOUNDATIONS.md`.

## 1. Two audiences, two boundaries

| | Customers (public) | Staff and admins (internal) |
|---|---|---|
| Pages | `(storefront)` route group (M2) | `(inventory)` and `(auth)` groups, unchanged |
| Login | `/account/login`, `/account/register` (pages come with the cart milestone; handlers: M3) | `/login`, `/setup-password`, unchanged |
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
   dedicated handlers (M3, section 8), which take precedence over this
   catch-all because specific segments beat `[...path]`. The catch-all also
   **refuses** the three session routes (`storefront/auth/login`,
   `storefront/auth/verify-email`, `storefront/auth/logout`) with 404, and
   removes any `accessToken` key from every JSON response it relays, so it
   cannot be used to get a token past the dedicated handlers.
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

## 7. M2b: public storefront pages (as built)

| Route | Access | Notes |
|---|---|---|
| `/` | public while `STOREFRONT_ENABLED=true` | hero + featured combos; flag off: redirects to `/login` exactly as before |
| `/combos` | public while the flag is on | catalogue, URL-driven search (`?q=`) and paging (`?page=`, 12 per page) |
| `/combos/[slug]` | public while the flag is on | detail; invalid or unknown slug is a real 404 |
| `/login`, `/setup-password` | public | staff entry points, unchanged |
| everything else | staff token | including `/promotions/*` (admin) |

**Route files.** The storefront lives in the `(storefront)` group (server
components only). The old `src/app/page.tsx` redirect moved into it. Pages read
the flag themselves; `combos/layout.tsx` also 404s the whole segment when the
flag is off (above the list page's streaming boundary, so the status is a real
404; a `notFound()` thrown after streaming has started would be a 200).

**Proxy** (`src/proxy.ts` + `src/lib/route-access.ts`). Public paths are matched
by whole segment: `/login` and `/login/x` match, `/login-extra` does not (the
previous `startsWith` check made such lookalikes public by accident). `/` is
matched exactly. Storefront paths are public only while the flag is on. The
matcher is unchanged (it still skips `api/`: route handlers do their own checks).

**Providers.** The root layout keeps global styles and the Toaster only. The
staff `AuthProvider` is mounted by the `(auth)` layout and by the `(inventory)`
layout (a server boundary that renders the client `InventoryShell`, which calls
`useAuthGuard()` inside the provider). Storefront code imports no staff auth,
store, axios client or service (enforced by `tests/storefront-separation.test.mts`).

**Data access.** Pages call the BFF request handler in-process
(`src/lib/storefront/catalogue.server.ts` -> `handleStoreRequest`), so there is
no HTTP hop back into the same server and the same flag, allowlist, signed
visitor IP and `no-store` apply. Only the two visitor-address headers are
carried over; cookies and Authorization are never forwarded. Endpoints used:
`GET storefront/combos?page&limit&q` and `GET storefront/combos/:slug`. The
browser makes no data requests of its own (search and paging are plain links
and a GET form).

**Display rules.** Only the public fields are rendered (`name`, `slug`,
`description`, `items`, `price`, `referencePrice`, `images`, `availability`).
The detail page shows `items` as a **What's included** section above the
description (name, plus the quantity when there is one; nothing when the list
is empty). Responses
are parsed field by field: an exact count is shown only for `low_stock`, image
URLs must be https, unknown fields are dropped. Images are plain `<img>` with a
placeholder fallback (the media host is not known at build time).

**Hero.** CSS depth only (perspective scene, preserve-3d stage, layers at
different `translateZ`, a platter, tilted cards, a floating badge). Cards show
real published combos when the API has them, else a branded placeholder. Motion
(slow float, hover tilt) stops under `prefers-reduced-motion`.

**Out of scope here:** customer accounts, cart, checkout, payments, orders and
order customisation.

## 8. M3: customer session handlers (as built)

The API returns an `accessToken` from `storefront/auth/login` and
`storefront/auth/verify-email`. It is a bearer credential and **never reaches
browser JavaScript**. Dedicated Route Handlers (thin wrappers over
`src/lib/server/store-auth.ts`, unit-tested in `tests/store-auth.test.mts`):

| Browser calls (POST, JSON, same-origin) | Backend | Effect |
|---|---|---|
| `/api/store/auth/login` | `storefront/auth/login` | on success sets `ene_cust`, returns the body **without** `accessToken` |
| `/api/store/auth/verify-email` | `storefront/auth/verify-email` | same: this completes registration and signs in |
| `/api/store/auth/logout` | `storefront/auth/logout` | revokes the session on the API, clears `ene_cust` |

Everything else customer-facing (`register`, `resend-code`, `forgot-password`,
`reset-password`, `me`, the catalogue) goes through the generic
`/api/store/storefront/...` route. Those routes issue no session. Password
reset deliberately does **not** sign the customer in: after it, the customer
signs in normally.

**Registration is two calls.** `register` takes only an email and sends a code;
nothing about the customer is stored. `verify-email` takes the email, the code
**and** the name, phone and password, and creates the account. The page must
therefore collect the details on the verification step (a refresh just means
re-entering them with the same, still valid code). Do not send name, phone or
password to `register`: the API answers 400.

**Cookie** (`buildSessionCookie`): `ene_cust=<jwt>; Path=/; HttpOnly;
SameSite=Lax; Max-Age=<n>`, plus `Secure` when `NODE_ENV=production`. No
`Domain` attribute, so it is host-only. `Max-Age` is the token's own `exp`
(falling back to the `expiresIn` the API reports, i.e. the configured
`CUSTOMER_JWT_EXPIRES_IN`, then 7 days; capped at 30). Clearing
(`buildClearCookie`) uses the same name, Path and absent Domain with
`Max-Age=0` and a past `Expires`.

**Rules the handlers enforce**
1. The cookie is set only when the API answered 2xx **and** returned a
   well-formed JWT. Wrong code, bad credentials, validation errors, throttling
   and 5xx set no cookie; the API's status and message are relayed.
2. The response to the browser is built from scratch: only the cookie this
   module made is ever sent, an upstream `Set-Cookie` is dropped, and
   `accessToken`/`tokenType` are removed from the body.
3. All checks of the generic BFF run first (flag, path, Origin/CSRF, JSON-only,
   bounded body, signed client IP, header allowlist). A request refused by them
   never contacts the API and never changes the cookie, so a forged cross-site
   request cannot sign anyone out.
4. `Authorization` is derived from `ene_cust` only; a browser-supplied
   `Authorization` header is ignored. The staff `token` cookie is never read or
   forwarded, and the staff login and `/api/v1` proxy are untouched.
5. Logout clears the cookie whenever the API was contacted, whatever it
   answered (401 means the token was already dead; 5xx is relayed so the page
   can warn that revocation may not have happened).

Not in this milestone: the cart, checkout, and the `/account/*` pages. Until
the account pages exist the handlers are exercised by tests only.

## 9. BFF request signature (the API only accepts the BFF)

The API's token-issuing routes (login, verify-email) are reachable from a
browser, and CORS allows this site's origin. Without more, page script could
call the API directly and read the access token, bypassing section 8. **CORS is
not authentication**, so every request to `storefront/auth/*` carries a
signature that only this server can make (it holds `BFF_SHARED_SECRET`; the
browser never does). Unsigned requests get `403` from the API.

Added in `store-bff.ts` for every path under `storefront/auth/` (so login,
verify-email, logout, register, resend-code, forgot-password, reset-password
and `me`), from helpers in `src/lib/server/bff.ts`:

```
key       = HMAC-SHA256(BFF_SHARED_SECRET, "enechambs:bff-request-auth:v2")
canonical = "enechambs-bff-request-v2" LF timestampMs LF nonce LF METHOD LF path LF hex(SHA-256(body))
signature = hex(HMAC-SHA256(key, canonical))
headers   = x-bff-auth-version: v2, x-bff-auth-timestamp: <ms>,
            x-bff-auth-nonce: <22 base64url>, x-bff-auth-signature: <hex>
```

- **Protocol v2 adds a nonce (replay protection).** Every request gets a fresh
  128-bit random nonce (`generateBffNonce`, `crypto.randomBytes(16)`); it is part
  of the signed message and sent in `x-bff-auth-nonce`. The API records each
  nonce it accepts in PostgreSQL and refuses a second use, so a captured request
  cannot be replayed within its 60 s window, not even against a different API
  instance. Nothing is cached or reused here, and nothing retries a request with
  its old nonce: a retry is a new request with a new nonce. **v1 is no longer
  accepted by the API**, so this change and the API's must be deployed together.
- **Signed over the exact bytes forwarded.** The `Uint8Array` passed to `fetch`
  is the same one hashed; the body is never re-serialised in between
  (`tests/bff-auth.test.mts` sends non-canonical JSON with unicode and checks
  the digest against the bytes the API receives).
- `path` is the backend pathname (`/api/v1/storefront/auth/login`), without the
  query string. Valid for 60 s either side on the API.
- Browser-supplied `x-bff-auth-*` headers (including a nonce) are dropped by the
  header allowlist and replaced by the BFF's own.
- Separate from, and not a replacement for, the signed client-IP headers
  (section 3), which are unchanged and keep their own golden vectors. The key is
  derived, so the raw secret is never the key of this MAC.
- The secret, signatures and nonces are never returned to the browser; the secret is
  referenced only by server-side files (a test enforces it).
- Missing `BFF_SHARED_SECRET` is a 503 before anything is sent.
- The v2 golden vectors in `tests/bff-auth.test.mts` (with their fixed nonces) are
  the same table as the API's `src/common/bff-auth/bff-request-signature.spec.ts`. Change the
  algorithm in one repository and the other's suite fails.

The staff session, the `/api/v1` admin proxy and `proxy.ts` do not use or know
about any of this.

## 10. M3.5: cart and account pages (as built)

| Route | Notes |
|---|---|
| `/cart` | quantities, server re-pricing through `POST storefront/cart/quote` |
| `/account/login`, `/account/register`, `/account/forgot-password` | forms over the section 8 handlers; `?next=` is validated by `safeNextPath` (same-site customer paths only) |
| `/checkout`, `/checkout/payment-return`, `/my-orders`, `/my-orders/[orderNumber]` | see section 11 |

**The guest cart** is `{slug, quantity, name}` lines in `localStorage` (`ene_cart_v1`),
`src/lib/storefront/cart.ts` (pure) + `cart-store.ts` (browser). It is not tied to the
session: signing in, registering and signing out never read, merge or clear it. Only a
successfully created order empties it. Stored data is untrusted: it is parsed defensively,
and price, availability and limits always come from the server's quote.

**Public shells.** `/cart`, `/checkout`, `/account` and `/my-orders` are public in
`src/lib/route-access.ts` (flag on only, whole-segment match) because customers have no
staff token. What they show is protected where it matters: cookie -> BFF -> API
ownership checks. A signed-out visitor sees a sign-in prompt with `next` set.

**Header.** `HeaderActions` (client island) shows the cart count and Sign in / Orders /
Sign out. It asks `auth/me` again on every pathname change, because the header outlives
client-side navigation and would otherwise keep saying "Sign in" after a login.

**Browser storage** is allowed in exactly two files, enforced by
`tests/storefront-separation.test.mts`: `cart-store.ts` (localStorage, the cart) and
`CheckoutView.tsx` (sessionStorage, the checkout idempotency key). Neither may mention
credentials. No storefront file may read cookies or set `Authorization`.

## 11. M4: checkout, payment and orders (as built)

```
/cart -> /checkout -> POST storefront/orders {items:[{slug,quantity}], requestId, note?}
      -> POST storefront/orders/:n/pay -> {checkoutUrl}  -> Flutterwave hosted page
      -> /checkout/payment-return?order=ENE-... -> POST .../payment/refresh (polled ~60 s)
      -> /my-orders/:n
```

- The order body carries only slug and quantity (the API refuses price, total, status,
  customer id). `requestId` is one UUID per cart fingerprint (`checkout-attempt.ts`), so
  a double click or retry returns the same order.
- The browser navigates only to an **https Flutterwave** address
  (`isTrustedCheckoutUrl`); anything else from the API is refused.
- **`/checkout/payment-return` reads only `order`.** Flutterwave appends `status`,
  `tx_ref` and `transaction_id`; none is read. The page asks the API to check with the
  provider by *our* reference and shows what the API recorded, so editing the URL cannot
  make an order look paid. Outcomes: confirmed, under review (amount/currency mismatch or
  late payment), failed (retry opens a new attempt), cancelled/expired, still waiting.
- The cart is cleared once the order exists (it now holds the stock). If the payment page
  cannot be opened the customer lands on the order with a "Pay now" button.
- With payments off the API answers `503 PAYMENTS_DISABLED` to order creation; the page
  shows "Online payment is not available right now".

**BFF allowlist fix (M4).** `storefront/payments/*` is now refused by the BFF
(`backendPathFromSegments`). The Flutterwave webhook sits under `storefront/` in the API,
so the "storefront/* only" allowlist had quietly made it reachable from the browser path
(harmless, the `verif-hash` header is stripped so it 401s, but it broke the rule in
section 3). Tested in `tests/bff.test.mts` against the real route.

Tests: `tests/storefront-cart.test.mts`, `tests/storefront-orders-client.test.mts`
(drives the real BFF handler with a fake backend), plus the extended route-access and
separation tests.

## 12. M4.1: staff online orders and storefront reports

Staff-side screens for the online channel. They are part of the **staff** app: pages in
`(inventory)`, protected by the staff `token` cookie like every other staff page, calling the
backend through the staff axios client and the `/api/v1` proxy. They never use the customer
BFF, and the customer cookie opens none of them (a browser test checks it).

| Route | Who | Backend |
|---|---|---|
| `/storefront-orders` | staff, admin | `GET admin/storefront-orders` (search, status, payment status, needs review, Lagos date range, pagination) |
| `/storefront-orders/[order number]` | staff, admin | `GET .../:orderNumber`; `PATCH .../fulfilment` (staff, admin); `POST .../honour-late-payment` and `POST .../payments/:id/record-refund` (**admin only**, written reason required) |
| `/storefront-reports` | **admin only** | `GET admin/storefront-reports` |

Nav: "Online Orders" (after in-store "Sales") for staff and admin; "Online Reports" for admin
only (`src/lib/nav-config.ts`, tested). The pages also hide controls a role cannot use, but
that is a courtesy: the backend answers 403 to a staff token on every financial route, which
the browser tests call by hand.

Code: `src/lib/storefront-orders/` (typed API factory over an injected HTTP client, format and
state helpers, Lagos date bounds; unit tested), `src/lib/services/storefront-orders.service.ts`,
`src/components/storefront-orders/`. The UI reflects the backend's response after each action
(no optimistic updates). The staff app is not available below tablet width (existing behaviour).
Backend counterpart: `enechambs-api/docs/STOREFRONT_OPERATIONS.md`.
