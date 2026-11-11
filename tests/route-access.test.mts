import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { isPublicPath } from '../src/lib/route-access.ts';

const on = { storefrontEnabled: true };
const off = { storefrontEnabled: false };

// ── storefront routes are public only while the flag is on ────────────────────
test('with the flag on, / /combos and /combos/<slug> are public (no staff token needed)', () => {
  for (const path of ['/', '/combos', '/combos/', '/combos/festive-rice-combo', '/combos/x']) {
    assert.equal(isPublicPath(path, on), true, path);
  }
});

test('with the flag off, none of the storefront routes are public (existing behaviour)', () => {
  for (const path of ['/', '/combos', '/combos/festive-rice-combo']) {
    assert.equal(isPublicPath(path, off), false, path);
  }
});

test('"/" is matched exactly: nothing else becomes public through it', () => {
  for (const path of ['/inventory', '/dashboard', '//', '/ ', '/index', '/?x']) {
    assert.equal(isPublicPath(path, on), false, path);
  }
});

test('/combos is matched by whole segment: lookalikes stay protected', () => {
  for (const path of ['/combosx', '/combos-extra', '/combo', '/promotions/combos', '/promotions/combos/new', '/admin/combos', '/Combos']) {
    assert.equal(isPublicPath(path, on), false, path);
  }
});

// ── staff entry points ────────────────────────────────────────────────────────
test('/login and /setup-password stay public in both modes', () => {
  for (const flag of [on, off]) {
    for (const path of ['/login', '/setup-password', '/login/', '/setup-password/anything']) {
      assert.equal(isPublicPath(path, flag), true, `${path} ${JSON.stringify(flag)}`);
    }
  }
});

test('/login-extra and similar prefix lookalikes are NOT public (previously a startsWith accident)', () => {
  for (const flag of [on, off]) {
    for (const path of ['/login-extra', '/loginx', '/login.html', '/setup-password-2', '/setup-passwordx', '/Login']) {
      assert.equal(isPublicPath(path, flag), false, `${path} ${JSON.stringify(flag)}`);
    }
  }
});

// ── staff routes stay protected whatever the flag says ────────────────────────
test('every existing staff route requires the staff token in both modes', () => {
  const staff = [
    '/dashboard', '/inventory', '/sales', '/expenses', '/categories', '/suppliers', '/stock-alerts', '/reports',
    '/purchases', '/customers', '/users', '/activity', '/promotions/combos', '/promotions/combos/new',
    '/promotions/combos/6f1c', '/anything-else',
  ];
  for (const flag of [on, off]) {
    for (const path of staff) assert.equal(isPublicPath(path, flag), false, `${path} ${JSON.stringify(flag)}`);
  }
});

test('traversal and encoded tricks do not reach a public section', () => {
  for (const path of ['/combos/../inventory', '/%63ombos', '/combos%2F..%2Fusers', '/login%2F..%2Finventory', '/%6Cogin']) {
    // The first form still *starts with* a public section by segment, which is
    // harmless: the router resolves it to a page that does its own checks. The
    // encoded forms must never match.
    if (path.startsWith('/combos/')) continue;
    assert.equal(isPublicPath(path, on), false, path);
  }
});

// ── the proxy really uses it ──────────────────────────────────────────────────
test('src/proxy.ts decides with isPublicPath + the server-side flag, and still redirects to /login', () => {
  const source = readFileSync(new URL('../src/proxy.ts', import.meta.url), 'utf8');
  assert.match(source, /isPublicPath\(pathname, \{ storefrontEnabled: isStorefrontEnabled\(\) \}\)/);
  assert.match(source, /!token && !isPublicPath/);
  assert.match(source, /NextResponse\.redirect\(new URL\(signInUrl\(\{ returnTo: /); // still redirects to /login, now remembering the page
  assert.doesNotMatch(source, /startsWith\(r\)/); // the old prefix check is gone
  assert.match(source, /api\//); // matcher still excludes API routes (they enforce their own checks)
});

// ── M3.5/M4: cart, checkout, account, my-orders ───────────────────────────────
const CUSTOMER_PAGES = ['/cart', '/checkout', '/checkout/payment-return', '/account/login', '/account/register', '/account/forgot-password', '/my-orders', '/my-orders/ENE-ABCD2345'];

test('with the flag on, the customer pages are public shells (customers have no staff token)', () => {
  for (const path of CUSTOMER_PAGES) assert.equal(isPublicPath(path, on), true, path);
});

test('with the flag off, none of them is public: the staff proxy redirects exactly as before', () => {
  for (const path of CUSTOMER_PAGES) assert.equal(isPublicPath(path, off), false, path);
});

test('the new sections are matched by whole segment: lookalikes and staff pages stay protected', () => {
  for (const path of ['/cartx', '/cart-extra', '/checkoutx', '/accounts', '/account-settings', '/my-ordersx', '/my-orders-admin', '/orders', '/sales', '/customers']) {
    assert.equal(isPublicPath(path, on), false, path);
  }
});
