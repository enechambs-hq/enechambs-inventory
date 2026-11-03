import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CLIENT_IP_HEADER,
  CLIENT_IP_SIGNATURE_HEADER,
  CLIENT_IP_TIMESTAMP_HEADER,
  backendPathFromSegments,
  isAllowedOrigin,
  requestOrigin,
  resolveClientIp,
  sanitizeBearerToken,
  sanitizeIdempotencyKey,
  signClientIp,
  signedClientIpHeaders,
} from '../src/lib/server/bff.ts';
import { isStorefrontEnabled } from '../src/lib/server/flags.ts';

const headers = (map: Record<string, string>) => ({
  get: (name: string) => map[name.toLowerCase()] ?? null,
});

// ── contract with the backend ───────────────────────────────────────────────
// The backend asserts the SAME vectors in
// src/common/client-ip/client-ip-signature.spec.ts. If either side changes the
// algorithm, one repository's tests fail.
const SECRET = 'test-secret-0123456789abcdef0123456789';
const NOW = 1790000000000;
const GOLDEN = [
  {
    ip: '203.0.113.7',
    method: 'GET',
    path: '/api/v1/storefront/combos',
    sig: 'de44d1eca11c7a410c2fcb4f4ef15e0eead48cd5ebc9a9e876bb836b4c4433c2',
  },
  {
    ip: '2001:db8::1',
    method: 'POST',
    path: '/api/v1/storefront/orders',
    sig: 'a6ab11a225fcf0a1432ed30392c6b00c94dbf4c3c73cee9b659c6e0633c2bf65',
  },
];

for (const g of GOLDEN) {
  test(`signature matches the backend golden vector: ${g.method} ${g.path}`, () => {
    assert.equal(
      signClientIp({ ip: g.ip, method: g.method, path: g.path, timestampMs: NOW, secret: SECRET }),
      g.sig,
    );
  });
}

test('signedClientIpHeaders emits the three headers the API reads', () => {
  const h = signedClientIpHeaders({
    ip: '203.0.113.7',
    method: 'get',
    path: '/api/v1/storefront/combos',
    secret: SECRET,
    nowMs: NOW,
  });
  assert.equal(h[CLIENT_IP_HEADER], '203.0.113.7');
  assert.equal(h[CLIENT_IP_TIMESTAMP_HEADER], String(NOW));
  assert.equal(h[CLIENT_IP_SIGNATURE_HEADER], GOLDEN[0].sig);
});

// ── where the visitor address comes from ────────────────────────────────────
test('client IP: ignored entirely when not running on Vercel (browser-settable)', () => {
  const h = headers({ 'x-forwarded-for': '203.0.113.7', 'x-vercel-forwarded-for': '203.0.113.7' });
  assert.equal(resolveClientIp(h, {}), null);
  assert.equal(resolveClientIp(h, { VERCEL: '0' }), null);
});

test('client IP: on Vercel, prefers x-vercel-forwarded-for, then x-forwarded-for', () => {
  const vercel = { VERCEL: '1' };
  assert.equal(
    resolveClientIp(headers({ 'x-vercel-forwarded-for': '203.0.113.7', 'x-forwarded-for': '198.51.100.1' }), vercel),
    '203.0.113.7',
  );
  assert.equal(resolveClientIp(headers({ 'x-forwarded-for': '198.51.100.1' }), vercel), '198.51.100.1');
  assert.equal(resolveClientIp(headers({ 'x-forwarded-for': '198.51.100.1, 10.0.0.1' }), vercel), '198.51.100.1');
  assert.equal(resolveClientIp(headers({ 'x-forwarded-for': '2001:db8::1' }), vercel), '2001:db8::1');
});

test('client IP: rejects missing and malformed values', () => {
  const vercel = { VERCEL: '1' };
  assert.equal(resolveClientIp(headers({}), vercel), null);
  assert.equal(resolveClientIp(headers({ 'x-forwarded-for': 'not-an-ip' }), vercel), null);
  assert.equal(resolveClientIp(headers({ 'x-forwarded-for': "1.2.3.4'; DROP" }), vercel), null);
});

// ── path whitelist ──────────────────────────────────────────────────────────
test('path: only storefront/* is reachable', () => {
  assert.equal(backendPathFromSegments(['storefront', 'combos']), 'storefront/combos');
  assert.equal(backendPathFromSegments(['storefront', 'combos', 'festive-rice-combo']), 'storefront/combos/festive-rice-combo');
  assert.equal(backendPathFromSegments(['storefront', 'orders', 'ENE-260101-AB12', 'pay']), 'storefront/orders/ENE-260101-AB12/pay');
});

test('path: staff routes, webhooks and the root are refused', () => {
  for (const segs of [
    ['users', 'me'],
    ['inventory', 'abc'],
    ['auth', 'login'],
    ['webhooks', 'flutterwave'],
    ['admin', 'combos'],
    ['storefront'],
    [],
  ]) {
    assert.equal(backendPathFromSegments(segs), null, JSON.stringify(segs));
  }
});

test('path: traversal, encoding tricks and odd characters are refused', () => {
  for (const segs of [
    ['storefront', '..', 'users'],
    ['storefront', '.', 'combos'],
    ['storefront', '%2e%2e', 'users'],
    ['storefront', 'a/b'],
    ['storefront', 'a\\b'],
    ['storefront', 'a b'],
    ['storefront', 'combos?x=1'],
    ['storefront', 'combos\u0000'],
    ['storefront', ''],
    ['storefront', 'x'.repeat(101)],
    ['storefront', 'a', 'b', 'c', 'd', 'e', 'f'],
  ]) {
    assert.equal(backendPathFromSegments(segs), null, JSON.stringify(segs));
  }
});

// ── CSRF / input hygiene ────────────────────────────────────────────────────
test('requestOrigin: rebuilt from Host and the reported protocol', () => {
  assert.equal(requestOrigin(headers({ host: 'shop.example.test' }), 'https'), 'https://shop.example.test');
  assert.equal(requestOrigin(headers({ host: '127.0.0.1:3100' }), 'http'), 'http://127.0.0.1:3100');
  assert.equal(requestOrigin(headers({ host: 'shop.example.test', 'x-forwarded-proto': 'https' }), 'http'), 'https://shop.example.test');
  assert.equal(requestOrigin(headers({ host: '[::1]:3000' }), 'http'), 'http://[::1]:3000');
  assert.equal(requestOrigin(headers({}), 'https'), null);
  assert.equal(requestOrigin(headers({ host: 'evil.test/path' }), 'https'), null);
  assert.equal(requestOrigin(headers({ host: 'a b' }), 'https'), null);
  assert.equal(requestOrigin(headers({ host: 'shop.example.test' }), 'ftp'), null);
});

test('requestOrigin + isAllowedOrigin: same-site browser passes, cross-site page does not', () => {
  const own = requestOrigin(headers({ host: 'shop.example.test' }), 'https') ?? undefined;
  assert.equal(isAllowedOrigin('https://shop.example.test', [own]), true);
  assert.equal(isAllowedOrigin('https://evil.example.test', [own]), false);
});

test('origin: must be present and allowed', () => {
  const allowed = ['https://shop.example.test', 'https://www.example.test/ignored-path', undefined];
  assert.equal(isAllowedOrigin('https://shop.example.test', allowed), true);
  assert.equal(isAllowedOrigin('https://www.example.test', allowed), true);
  assert.equal(isAllowedOrigin(null, allowed), false);
  assert.equal(isAllowedOrigin('https://evil.example.test', allowed), false);
  assert.equal(isAllowedOrigin('http://shop.example.test', allowed), false);
  assert.equal(isAllowedOrigin('null', allowed), false);
  assert.equal(isAllowedOrigin('https://shop.example.test', []), false);
});

test('idempotency key: opaque id of safe characters and sensible length', () => {
  assert.equal(sanitizeIdempotencyKey(null), null);
  assert.equal(sanitizeIdempotencyKey('3f1c2a9e-5b7d-4c1e-9a2b-0d4e6f8a1b2c'), '3f1c2a9e-5b7d-4c1e-9a2b-0d4e6f8a1b2c');
  assert.equal(sanitizeIdempotencyKey('short'), null);
  assert.equal(sanitizeIdempotencyKey('has spaces in it, not allowed ok'), null);
  assert.equal(sanitizeIdempotencyKey('x'.repeat(129)), null);
});

test('bearer token: must look like a JWT before it is forwarded', () => {
  assert.equal(sanitizeBearerToken(undefined), null);
  assert.equal(sanitizeBearerToken('abc'), null);
  assert.equal(sanitizeBearerToken('a.b'), null);
  assert.equal(sanitizeBearerToken('eyJhbGciOi.eyJzdWIiOiIx.c2ln_-Z'), 'eyJhbGciOi.eyJzdWIiOiIx.c2ln_-Z');
  assert.equal(sanitizeBearerToken('a.b.c\r\nX-Evil: 1'), null);
  assert.equal(sanitizeBearerToken(`${'a'.repeat(4097)}.b.c`), null);
});

// ── feature flag ────────────────────────────────────────────────────────────
test('flag: storefront is off unless explicitly "true"', () => {
  assert.equal(isStorefrontEnabled({}), false);
  assert.equal(isStorefrontEnabled({ STOREFRONT_ENABLED: 'false' }), false);
  assert.equal(isStorefrontEnabled({ STOREFRONT_ENABLED: '1' }), false);
  assert.equal(isStorefrontEnabled({ STOREFRONT_ENABLED: 'TRUE' }), false);
  assert.equal(isStorefrontEnabled({ STOREFRONT_ENABLED: 'true' }), true);
});
