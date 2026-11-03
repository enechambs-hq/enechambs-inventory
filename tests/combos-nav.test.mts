import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ADMIN_LINKS, canManagePromotions, isLinkActive, linksForRole, STAFF_LINKS } from '../src/lib/nav-config.ts';

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
    ['/inventory', '/sales', '/expenses', '/categories', '/suppliers', '/stock-alerts', '/reports'],
  );
  assert.deepEqual(
    ADMIN_LINKS.map((l) => l.href).filter((h) => h !== '/promotions/combos'),
    ['/dashboard', '/inventory', '/sales', '/expenses', '/categories', '/suppliers', '/stock-alerts', '/reports', '/purchases', '/customers', '/users'],
  );
});

test('the only difference between the staff and admin sets is admin-only links', () => {
  const staff = new Set(STAFF_LINKS.map((l) => l.href));
  assert.ok(STAFF_LINKS.every((l) => ADMIN_LINKS.some((a) => a.href === l.href)));
  assert.deepEqual(
    ADMIN_LINKS.filter((l) => !staff.has(l.href)).map((l) => l.href),
    ['/dashboard', '/purchases', '/customers', '/promotions/combos', '/users'],
  );
});

test('nested promotion routes keep the Promotions link active', () => {
  for (const path of ['/promotions/combos', '/promotions/combos/new', '/promotions/combos/abc']) {
    assert.ok(isLinkActive(path, '/promotions/combos'), path);
  }
  assert.ok(!isLinkActive('/promotions/combosX', '/promotions/combos'));
  assert.ok(!isLinkActive('/sales', '/promotions/combos'));
});
