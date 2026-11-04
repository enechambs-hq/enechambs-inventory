# Browser end-to-end tests (Playwright)

`e2e/customer.spec.ts` (20 tests) and `e2e/staff.spec.ts` (24 tests) drive the **production build** of this
app in Chromium against the **real API and PostgreSQL**. Payment is **scripted**: the hosted Flutterwave page is
stubbed in the browser and the API's provider is a test double. They never contact Flutterwave or Resend, never
move money and send no mail. Do not point them at a real provider or a real database.

| Spec | Covers |
|---|---|
| `customer.spec.ts` | browse, add to cart, guest cart persistence across register / sign-out / sign-in, registration and sign-in, HttpOnly session, checkout, order creation and stock, payment return that **ignores** URL claims, verified confirmation, webhook-first and repeated webhooks, failed / mismatched payment, cancel and expiry (stock returns once), sold-out and limits, My Orders, customer isolation, staff/customer separation, mobile cart, notification emails |
| `staff.spec.ts` | role-based navigation, Online Orders list (search, filters, Lagos date range, pagination, loading and error states), order detail, fulfilment, staff 403s on every financial route, admin-only honour and refund decisions with audit, duplicate-charge reconciliation, Online Reports (KPIs from payment records, periods, error state), emails, customer session cannot reach staff pages, customer view of the same orders |

## How it fits together
`playwright.config.ts` starts two servers (and reuses them locally if already running):

1. **The API**: `npm run e2e:server` in the **enechambs-api** checkout (`E2E_BACKEND_DIR`, default `../enechambs-api`).
   It rebuilds the schema of `TEST_DATABASE_URL` from the committed migrations and **refuses any database that is not
   local with "test" in its name**. It also serves a loopback-only control surface the tests use to seed orders, play the
   customer finishing or failing a payment, run the notification worker, and read database facts (`e2e/support/control.ts`).
2. **This app**: `npm run build && next start` on port 4312 with `STOREFRONT_ENABLED=true`, pointed at that API.

## Running
```bash
# once
npm ci && npm run test:e2e:install                # downloads Chromium
(cd ../enechambs-api && npm ci)
createdb enechambs_e2e_test                       # any LOCAL database whose name contains "test"

# every run
TEST_DATABASE_URL=postgres://<user>:<password>@127.0.0.1:5432/enechambs_e2e_test npm run test:e2e
npx playwright test e2e/staff.spec.ts             # one spec
npx playwright show-report                        # after a CI-style run
```
Ports: `E2E_WEB_PORT` (4312), `E2E_API_PORT` (4310), `E2E_CONTROL_PORT` (4311). Failures keep a trace and screenshot in
`test-results/`. The specs run **serially** on one database; each starts by resetting its data.

## CI
The job lives in the **backend** repository's workflow (`browser-e2e`): the backend is private and this repository is
public, so the backend job can check this repository out with no secret. It checks out the ref named by
`E2E_FRONTEND_REF` (the feature branch until this work is merged; change it to `dev` afterwards). This repository's own CI
does not run the browser suite. Running it here would need a token that can read the private backend repository.

## Writing tests
Use `ctl()` for setup and facts, `customerContext` / `staffContext` for sessions, and prefer `expect.poll` over fixed waits.
Never put credentials in a test: the only shared value is the fake `BFF_SHARED_SECRET` in `playwright.config.ts`, used by
two throwaway test processes.
