import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ERROR_KINDS } from '../src/lib/errors/app-error.ts';
import { normalizeError } from '../src/lib/errors/normalize.ts';
import { appErrorFromStaff } from '../src/lib/errors/staff-adapter.ts';
import { appErrorFromStore } from '../src/lib/errors/store-adapter.ts';
import { httpError } from './combos-support.mts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const ADMIN = {
  'src/components/storefront-orders/OrdersList.tsx': { what: 'online orders', one: 'order' },
  'src/components/storefront-orders/OrderDetail.tsx': { what: 'this order', one: 'order' },
  'src/components/storefront-orders/StorefrontReport.tsx': { what: 'the online report' },
  'src/components/storefront-orders/OnlineCustomers.tsx': { what: 'online customers' },
} as const;

const STOREFRONT = [
  'src/components/storefront/useQuote.ts', // Cart and Checkout
  'src/components/storefront/useAddresses.ts', // Address Book and the checkout picker
  'src/components/storefront/AddressBookView.tsx',
  'src/components/storefront/MyOrdersView.tsx',
  'src/components/storefront/OrderDetailView.tsx',
  'src/components/storefront/PaymentReturnView.tsx',
  'src/components/storefront/CheckoutView.tsx',
  'src/components/storefront/StatePanels.tsx', // combo list and detail
];

// ── the four admin pages no longer borrow the combo wording ───────────────────

for (const [file, ctx] of Object.entries(ADMIN)) {
  test(`${file.split('/').pop()}: no promotional-combo error helper, and area-appropriate messages`, () => {
    const source = read(file);
    assert.doesNotMatch(source, /lib\/combos\/errors/, 'must not import the combo error helper');
    assert.match(source, /staff-adapter/, 'uses the shared staff adapter');
    for (const [status, body] of [[403, 'Forbidden resource'], [404, 'Combo not found'], [500, 'boom'], [503, 'x']] as const) {
      const e = appErrorFromStaff(httpError(status, body), { method: 'GET', action: 'load', ...ctx });
      assert.doesNotMatch(e.message, /combo|promotion/i, `${status}: ${e.message}`);
    }
    // The wording names the right thing.
    assert.match(appErrorFromStaff(httpError(403, 'Forbidden resource'), { method: 'GET', action: 'load', ...ctx }).message, /permission/);
    if ('one' in ctx) assert.match(appErrorFromStaff(httpError(404, 'x'), { method: 'GET', ...ctx }).message, new RegExp(`that ${ctx.one}`));
  });
}

test('the Promotions pages keep their combo-specific messages (they still use the combo helper)', () => {
  for (const file of ['src/app/(inventory)/promotions/combos/page.tsx', 'src/app/(inventory)/promotions/combos/new/page.tsx', 'src/app/(inventory)/promotions/combos/[id]/page.tsx']) {
    assert.match(read(file), /lib\/combos\/errors/, file);
  }
});

test('403 on the admin pages explains it is a permission matter, not a combo one, and offers no retry', () => {
  const e = appErrorFromStaff(httpError(403, 'Forbidden resource'), { method: 'GET', action: 'load', what: 'online customers' });
  assert.deepEqual([e.kind, e.retryable, e.message], ['forbidden', false, 'You do not have permission to view online customers.']);
});

// ── failed mutations keep their dialogs open ─────────────────────────────────

test('a failed status change or order action only shows the error: it does not close the dialog or clear the choice', () => {
  const list = read('src/components/storefront-orders/OrdersList.tsx');
  const failedList = list.slice(list.indexOf('const applyStatus'), list.indexOf('const appliedSearch'));
  const listCatch = failedList.slice(failedList.indexOf('} catch'), failedList.indexOf('} finally'));
  assert.match(listCatch, /setSaveError/);
  assert.doesNotMatch(listCatch, /setPending\(null\)/);

  const detail = read('src/components/storefront-orders/OrderDetail.tsx');
  const run = detail.slice(detail.indexOf('async function run'), detail.indexOf('const phone'));
  const detailCatch = run.slice(run.indexOf('} catch'), run.indexOf('} finally'));
  assert.match(detailCatch, /setActionError/);
  assert.doesNotMatch(detailCatch, /close\(\)|setDecision\(null\)|setPendingTarget\(null\)/);
});

// ── the storefront consumers use the shared model for their failures ─────────

for (const file of STOREFRONT) {
  test(`${file.split('/').pop()}: failures go through the shared model`, () => {
    const source = read(file);
    assert.match(source, /errors\/(store-adapter|normalize|staff-adapter)/, 'imports the shared adapter');
  });
}

test('the storefront load hooks keep their existing fields and add the common error', () => {
  for (const file of ['src/components/storefront/useQuote.ts', 'src/components/storefront/useAddresses.ts']) {
    const source = read(file);
    assert.match(source, /message: string; error: AppError/, `${file}: old message kept, new error added`);
    assert.match(source, /friendlyMessage/, 'the existing helper is still used for the old field');
  }
});

test('writes in the storefront are declared as writes, so they can never be offered a retry', () => {
  assert.match(read('src/components/storefront/OrderActions.tsx'), /method: 'POST', action: 'change'/);
  assert.match(read('src/components/storefront/CheckoutView.tsx'), /method: 'POST', action: 'change'/);
  const book = read('src/components/storefront/AddressBookView.tsx');
  for (const method of ['POST', 'PATCH', 'DELETE']) assert.match(book, new RegExp(`'${method}'`));
  const e = appErrorFromStore({ ok: false, kind: 'unavailable', status: 503, message: 'x' }, { method: 'POST', action: 'change' });
  assert.equal(e.retryable, false);
});

test('a price quote and a payment re-check are the only POSTs marked safe to repeat', () => {
  assert.match(read('src/components/storefront/useQuote.ts'), /method: 'POST', idempotent: true/);
  assert.match(read('src/components/storefront/PaymentReturnView.tsx'), /method: 'POST', idempotent: true/);
  assert.match(read('src/components/storefront/OrderDetailView.tsx'), /method: 'POST', idempotent: true/);
  for (const file of ['CheckoutView', 'OrderActions', 'AddressBookView']) assert.doesNotMatch(read(`src/components/storefront/${file}.tsx`), /idempotent: true/, file);
});

// ── the panel cannot leak or retry unsafely (source-level, since the unit setup has no DOM) ──

test('LoadErrorPanel shows only the safe model, never status/stack, and gates retry through the model', () => {
  const source = read('src/components/errors/LoadErrorPanel.tsx');
  assert.doesNotMatch(source, /error\.status|\.stack|\.code\b|JSON\.stringify|fetch\(|axios|storeRequest/);
  assert.match(source, /panelModel\(/);
  assert.match(source, /model\.showRetry/);
  assert.match(source, /min-h-11/);
  assert.match(source, /role="alert"/);
});

test('unknown failures always normalise to the safe unexpected message', () => {
  for (const kind of ERROR_KINDS) assert.ok(kind);
  const e = normalizeError(new Error('password=hunter2 at /srv/x.ts:1:1'));
  assert.equal(e.kind, 'unexpected');
  assert.doesNotMatch(e.message, /hunter2|srv/);
});
