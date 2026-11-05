import assert from 'node:assert/strict';
import { test } from 'node:test';
import { staffRoleFromToken } from '../src/lib/server/viewer-role.ts';

const NOW = 1_800_000_000;
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = (payload: unknown) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.signature`;

test('an admin or staff token yields that role', () => {
  assert.equal(staffRoleFromToken(token({ role: 'admin', exp: NOW + 60 }), NOW), 'admin');
  assert.equal(staffRoleFromToken(token({ role: 'staff', exp: NOW + 60 }), NOW), 'staff');
});

test('a token without an expiry still yields its role (the API decides validity)', () => {
  assert.equal(staffRoleFromToken(token({ role: 'admin' }), NOW), 'admin');
});

test('an expired token yields nothing', () => {
  assert.equal(staffRoleFromToken(token({ role: 'admin', exp: NOW - 1 }), NOW), null);
  assert.equal(staffRoleFromToken(token({ role: 'admin', exp: NOW }), NOW), null);
});

test('an unknown or missing role yields nothing', () => {
  assert.equal(staffRoleFromToken(token({ role: 'customer', exp: NOW + 60 }), NOW), null);
  assert.equal(staffRoleFromToken(token({ role: 7, exp: NOW + 60 }), NOW), null);
  assert.equal(staffRoleFromToken(token({ exp: NOW + 60 }), NOW), null);
});

test('malformed input yields nothing and never throws', () => {
  for (const bad of [undefined, '', 'abc', 'a.b', 'a.b.c.d', 'a.!!!.c', `a.${b64('x')}.c`, `a.${b64(null)}.c`, 'x'.repeat(5000)]) {
    assert.equal(staffRoleFromToken(bad as string | undefined, NOW), null, String(bad).slice(0, 20));
  }
});
