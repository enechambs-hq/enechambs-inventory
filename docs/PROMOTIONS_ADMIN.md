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

The customer-facing pages (`/combos`, `/combos/[slug]`) are documented in `docs/STOREFRONT_ROUTING.md`.

## Access
"Promotions" appears in the sidebar for `admin` only (`src/lib/nav-config.ts`).
Each page is wrapped in `AdminOnly`, which uses the existing `useAuthGuard`
redirect and also withholds the page, so a staff user never triggers its API
calls. The backend independently answers 403 to non-admins and 404 while
`STOREFRONT_ENABLED` is off.

## "What's included in this combo?" (contents)
A combo is a package, so the form has a separate section for its contents,
between **Description** and **Promotional price**. Each row is an item name
(required, 1-100 characters) and a quantity / size (optional, up to 60
characters, free text such as "1 kg" or "1 derica"). Rows can be added (up to
50) and removed; the form opens with one blank row and needs at least one named
item to save. Values and order are preserved when other rows are added or
removed (each row has a client-side key that is never sent to the API).

* Create sends `items: [{ name, quantityLabel }]`, trimmed, in the order shown;
  a blank quantity is sent as `null`.
* Edit sends `items` (the whole list) only when it changed, including a pure
  reordering. Unchanged contents are not sent.
* A combo created before contents existed opens with one blank row; it must be
  filled in before any edit of that combo can be saved, and before it can be
  published (the API answers 409 without items).
* The list is descriptive text only. It is not linked to inventory products.

Validation lives in `src/lib/combos/form.ts` (`checkItems`, `addItemRow`,
`removeItemRow`, `updateItemRow`), alongside the other combo rules. This module
uses plain validation functions and component state rather than Zod and React
Hook Form, matching the rest of the combo screens.

### Customer display
The contents are shown to customers on the combo detail page
(`/combos/[slug]`) in a **What's included** section (`ComboContents`), directly
above the description, one item per row: the name, with the quantity beside it
when there is one (`Rice - 1 kg`) and only the name when there is not
(`Garri`). A combo with no items renders no empty heading. The public API
returns `items: [{ name, quantityLabel }]` on both `GET /storefront/combos` and
`/:slug`; the parser (`parseItems`) keeps only those two fields. The catalogue
cards do not list the contents.

## What the client never sends
`remainingQuantity`, `allocatedQuantity`, `status`, ids and the row keys used
to track item rows. Edits send only the
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

## Admin proxy and `204 No Content`
`DELETE /:id/images/:imageId` answers 204. The admin proxy
(`src/app/api/v1/[...path]/route.ts`) returns 204, 205 and 304 with a null body
(the Fetch API refuses a body on those statuses), forwarding only
Content-Type and cache validators; every other status is forwarded as before.
A successful delete is therefore a successful client call, and the image leaves
the screen only after it.

## Tests
`npm test` covers the API service, validation, upload flow, error mapping, image
ordering/removal and nav visibility (`tests/combos-*.test.mts`), and the real
admin proxy route (`tests/admin-proxy.test.mts`). The
repository has no DOM test tooling, so component behaviour was verified in a
browser against a fake backend and fake storage (see the PR description).
