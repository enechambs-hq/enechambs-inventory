# Promotional combo administration (storefront M1b)

Admin-only screens for the backend in `enechambs-api` (`docs/PROMOTIONS_API.md`).
They live inside the authenticated inventory app and use the **staff** session
and the existing admin proxy (`/api/v1/...`). They never touch the customer BFF
(`/api/store`), and nothing here is public.

| URL | Purpose |
|---|---|
| `/promotions/combos` | list: search (name or slug), status filter, pagination, thumbnail, price, total / remaining / allocated, status |
| `/promotions/combos/new` | create a draft |
| `/promotions/combos/[id]` | edit details, manage images, publish / unpublish |

The customer-facing `/combos` route is a later milestone and does not exist yet.

## Access
"Promotions" appears in the sidebar for `admin` only (`src/lib/nav-config.ts`).
Each page is wrapped in `AdminOnly`, which uses the existing `useAuthGuard`
redirect and also withholds the page, so a staff user never triggers its API
calls. The backend independently answers 403 to non-admins and 404 while
`STOREFRONT_ENABLED` is off.

## What the client never sends
`remainingQuantity`, `allocatedQuantity`, `status` and ids. Edits send only the
fields that changed (so a frozen slug is never resent). A published combo's slug
is read-only; reducing the total below allocated units shows the backend's 409.
There is no delete-combo action because the backend has none.

## Image upload (exactly the backend contract)
1. `POST /:id/images/presign` with the declared `contentType` and `sizeBytes`.
2. `PUT` the file directly to the returned `uploadUrl` with the returned headers,
   using plain `fetch`: no staff `Authorization` header, not through Next.js.
   `Content-Length` is set by the browser from the file (scripts may not set it).
3. `POST /:id/images/confirm` with the `uploadId`.
4. The image shown is the one the API returned. Nothing is shown as uploaded
   before confirm succeeds; reorder and alt-text changes likewise update the
   screen only from server responses.

A failed upload can be retried; if only confirm failed, the retry re-confirms
(idempotent on the server) without uploading again. A 503 means image storage is
not configured or unavailable: a banner explains it and the combo's other
details can still be saved. Eight images at most; JPEG, PNG, WebP only.

**The storage bucket must allow browser PUTs from the admin origin (CORS).** See
the backend `docs/R2_SETUP.md`; this has not been verified against a real bucket.

## Known limitation: the admin proxy and `204 No Content`
`DELETE /:id/images/:imageId` answers 204. The existing proxy
(`src/app/api/v1/[...path]/route.ts`) builds its response from the upstream body,
and the Fetch API refuses a body on a 204, so the proxy answers **500** even though the
backend deleted the image (reproduced against a stub). This milestone does not
change the proxy, so after a 5xx or a missing response the UI re-reads the combo
and treats the image as removed only if it is really gone; a definite 4xx
(e.g. 409, a published combo must keep one image) is shown as is. The proper fix
is a small proxy change (return a null body for 204/205/304), which needs approval.

## Tests
`npm test` covers the API service, validation, upload flow, error mapping, image
ordering/removal logic and nav visibility (`tests/combos-*.test.mts`). The
repository has no DOM test tooling, so component behaviour was verified in a
browser against a fake backend and fake storage (see the PR description).
