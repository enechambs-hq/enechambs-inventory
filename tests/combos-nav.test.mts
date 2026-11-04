import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ADMIN_LINKS, canDecideStorefrontPayments, canManageOnlineOrders, canManagePromotions, canViewStorefrontReports, isLinkActive, linksForRole, STAFF_LINKS,
} from '../src/lib/nav-config.ts';

const hrefs = (role: string | null | undefined) => linksForRole(role).map((l) => l.href);

test('Promotions is shown to admins', () => {
  assert.ok(hrefs('admin').includes('/promotions/combos'));
  assert.ok(canManagePromotions('admin'));
});

test('Promotions is hidden from staff, signed-out and unknown roles', () => {
  for (const role of ['staff', undefined, null, '', 'ADMIN', 'superuser']) {
    assert.ok(!hrefs(role).includes('/promotions/combos'), String(role));
    assert.equal(canManagePromotions(role), false, String(role));
  }
});

test('the existing links are unchanged in order and membership', () => {
  assert.deepEqual(
    STAFF_LINKS.map((l) => l.href),
    ['/inventory', '/sales', '/storefront-orders', '/expenses', '/categories', '/suppliers', '/stock-alerts', '/reports'],
  );
  assert.deepEqual(
    ADMIN_LINKS.map((l) => l.href).filter((h) => h !== '/promotions/combos' && h !== '/storefront-reports'),
    ['/dashboard', '/inventory', '/sales', '/storefront-orders', '/expenses', '/categories', '/suppliers', '/stock-alerts', '/reports', '/purchases', '/customers', '/users'],
  );
});

test('the only difference between the staff and admin sets is admin-only links', () => {
  const staff = new Set(STAFF_LINKS.map((l) => l.href));
  assert.ok(STAFF_LINKS.every((l) => ADMIN_LINKS.some((a) => a.href === l.href)));
  assert.deepEqual(
    ADMIN_LINKS.filter((l) => !staff.has(l.href)).map((l) => l.href),
    ['/dashboard', '/purchases', '/customers', '/promotions/combos', '/storefront-reports', '/users'],
  );
});

test('nested promotion routes keep the Promotions link active', () => {
  for (const path of ['/promotions/combos', '/promotions/combos/new', '/promotions/combos/abc']) {
    assert.ok(isLinkActive(path, '/promotions/combos'), path);
  }
  assert.ok(!isLinkActive('/promotions/combosX', '/promotions/combos'));
  assert.ok(!isLinkActive('/sales', '/promotions/combos'));
});

// ── M4.1: Online Orders (staff + admin) and Online Reports (admin only) ───────
test('Online Orders is visible to staff and admins and sits right after in-store Sales', () => {
  for (const role of ['staff', 'admin']) {
    const list = hrefs(role);
    assert.ok(list.includes('/storefront-orders'), role);
    assert.equal(list.indexOf('/storefront-orders'), list.indexOf('/sales') + 1, role);
  }
  assert.equal(linksForRole('staff').find((l) => l.href === '/storefront-orders')?.label, 'Online Orders');
});

test('Online Reports is admin-only: hidden from staff, signed-out and unknown roles', () => {
  assert.ok(hrefs('admin').includes('/storefront-reports'));
  for (const role of ['staff', undefined, null, '', 'ADMIN', 'superuser']) {
    assert.ok(!hrefs(role).includes('/storefront-reports'), String(role));
    assert.equal(canViewStorefrontReports(role), false, String(role));
    assert.equal(canDecideStorefrontPayments(role), false, String(role));
  }
  assert.equal(canViewStorefrontReports('admin'), true);
  assert.equal(canDecideStorefrontPayments('admin'), true);
});

test('only the literal roles staff and admin may manage online orders', () => {
  assert.equal(canManageOnlineOrders('staff'), true);
  assert.equal(canManageOnlineOrders('admin'), true);
  for (const role of [undefined, null, '', 'ADMIN', 'customer', 'superuser']) assert.equal(canManageOnlineOrders(role), false, String(role));
});

test('the online channel does not displace the in-store links and nested routes keep the section active', () => {
  assert.ok(hrefs('staff').includes('/sales'));
  assert.ok(isLinkActive('/storefront-orders/ENE-ABCD2345', '/storefront-orders'));
  assert.ok(!isLinkActive('/storefront-orders', '/sales'));
  assert.ok(!isLinkActive('/storefront-ordersx', '/storefront-orders'));
});
