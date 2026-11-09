import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
/** Source without comments, so prose that explains a rule cannot trip the rule. */
const code = (path: string) => read(path).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(ROOT, dir))) {
    const full = join(dir, name);
    if (statSync(join(ROOT, full)).isDirectory()) out.push(...files(full));
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

const STOREFRONT_DIRS = ['src/app/(storefront)', 'src/components/storefront', 'src/lib/storefront'];
const STOREFRONT_FILES = STOREFRONT_DIRS.flatMap(files);

// ── the staff provider is mounted exactly where staff pages live ──────────────
test('the root layout no longer wraps the app in the staff AuthProvider (it keeps styles and the Toaster)', () => {
  const root = read('src/app/layout.tsx');
  assert.doesNotMatch(root, /AuthProvider/);
  assert.match(root, /globals\.css/);
  assert.match(root, /<Toaster/);
});

test('the (auth) and (inventory) layouts provide the staff AuthProvider', () => {
  for (const layout of ['src/app/(auth)/layout.tsx', 'src/app/(inventory)/layout.tsx']) {
    const source = read(layout);
    assert.match(source, /import AuthProvider from '@\/components\/providers\/AuthProvider'/, layout);
    assert.match(source, /<AuthProvider>/, layout);
    assert.doesNotMatch(source, /'use client'/, `${layout} is a server boundary`);
  }
});

test('the client shell that calls useAuthGuard() is rendered INSIDE the provider', () => {
  const layout = read('src/app/(inventory)/layout.tsx');
  assert.match(layout, /<AuthProvider>\s*<InventoryShell>\{children\}<\/InventoryShell>\s*<\/AuthProvider>/);
  const shell = read('src/components/layout/InventoryShell.tsx');
  assert.match(shell, /^'use client'/);
  assert.match(shell, /useAuthGuard\(\)/);
});

test('the staff auth guard still sends unauthenticated users to /login and judges the role (non-admins now see a forbidden state)', () => {
  const guard = read('src/hooks/useAuthGuard.ts');
  assert.match(guard, /status === 'unauthenticated'/);
  assert.match(guard, /router\.replace\(signOutIntent\.isActive\(\) \? '\/login' : signInUrl\(/);
  assert.match(guard, /resolveAccess\(\{ hydrated, isAuthenticated, role: user\?\.role, requiredRole \}\)/);
});

test('every staff page still sits inside a group that has the provider', () => {
  for (const dir of ['src/app/(auth)', 'src/app/(inventory)']) {
    assert.ok(existsSync(join(ROOT, dir, 'layout.tsx')), dir);
  }
  // Staff pages that read the auth store live only in those two groups (or in components they render).
  for (const file of files('src/app')) {
    const source = read(file);
    if (/useAuthStore|useAuthGuard/.test(source)) {
      assert.match(file, /\(auth\)|\(inventory\)/, `${file} uses staff auth outside the staff groups`);
    }
  }
});

// ── the storefront does not depend on staff auth ──────────────────────────────
test('there are storefront files to check', () => {
  assert.ok(STOREFRONT_FILES.length >= 15, `found ${STOREFRONT_FILES.length}`);
});

test('no storefront file imports staff auth, the staff store, the staff axios client or staff services', () => {
  const forbidden = [
    /auth\.store/, /useAuthGuard/, /AuthProvider/, /useAuthStore/, /from '@\/lib\/api'/, /from 'axios'/, /@\/lib\/services/,
    /@\/store\//, /@\/hooks\/useAuth/, /InventoryShell/, /components\/layout\/(Sidebar|ActivityPanel|GlobalSearch)/, /components\/promotions/,
  ];
  for (const file of STOREFRONT_FILES) {
    const source = code(file);
    for (const pattern of forbidden) assert.doesNotMatch(source, pattern, `${relative(ROOT, join(ROOT, file))} matches ${pattern}`);
  }
});

/**
 * M3.5/M4: browser storage holds exactly two things, both non-secret and both
 * unrelated to the customer session: the guest cart (localStorage) and the
 * checkout idempotency key (sessionStorage). Only these files may touch it.
 */
const STORAGE_FILES = new Map<string, RegExp>([
  ['src/lib/storefront/cart-store.ts', /localStorage/],
  ['src/components/storefront/CheckoutView.tsx', /sessionStorage/],
]);

test('storage, cookies and Authorization: only the cart and the checkout key use browser storage, and nothing reads cookies or sets Authorization', () => {
  for (const file of STOREFRONT_FILES) {
    const source = code(file);
    // Never allowed anywhere in the storefront:
    assert.doesNotMatch(source, /cookies\(\)|document\.cookie/, file);
    assert.doesNotMatch(source, /[Aa]uthorization/, file);
    if (STORAGE_FILES.has(file)) {
      assert.match(source, STORAGE_FILES.get(file) as RegExp, file);
      // ...and a file that may use storage must have nothing to do with credentials.
      assert.doesNotMatch(source, /ene_cust|token|password|bearer|jwt/i, `${file} must not mention credentials`);
    } else {
      assert.doesNotMatch(source, /localStorage|sessionStorage/, file);
    }
  }
  for (const file of STORAGE_FILES.keys()) assert.ok(existsSync(join(ROOT, file)), `${file} exists`);
});

test('the customer token never reaches page script: no storefront code reads or writes the session cookie or a token field', () => {
  for (const file of STOREFRONT_FILES) {
    const source = code(file);
    assert.doesNotMatch(source, /ene_cust/, file);
    assert.doesNotMatch(source, /accessToken/, file);
  }
});

test('pages read data only through the BFF client, never the backend URL directly', () => {
  for (const file of STOREFRONT_FILES) {
    const source = code(file);
    assert.doesNotMatch(source, /BACKEND_URL|onrender\.com|NEXT_PUBLIC_API_URL/, file);
  }
  const server = read('src/lib/storefront/catalogue.server.ts');
  assert.match(server, /handleStoreRequest/);
  assert.match(server, /\/api\/store\//);
  // Only the two visitor-address headers are carried over: never cookie or authorization.
  assert.match(server, /\['x-vercel-forwarded-for', 'x-forwarded-for'\]/);
});

test('every storefront page checks the feature flag itself', () => {
  for (const page of ['src/app/(storefront)/page.tsx', 'src/app/(storefront)/combos/(list)/page.tsx', 'src/app/(storefront)/combos/[slug]/page.tsx']) {
    assert.match(read(page), /isStorefrontEnabled\(\)/, page);
  }
  assert.match(read('src/app/(storefront)/page.tsx'), /redirect\('\/login'\)/); // flag off: "/" behaves as before
  assert.match(read('src/app/(storefront)/combos/(list)/page.tsx'), /notFound\(\)/);
  // And the segment layout 404s everything under /combos when the flag is off.
  assert.match(read('src/app/(storefront)/combos/layout.tsx'), /if \(!isStorefrontEnabled\(\)\) notFound\(\)/);
});

test('still out of scope: order customisation, and the server payments flag is never read by the browser (availability comes from the API)', () => {
  const text = STOREFRONT_FILES.map(code).join('\n');
  for (const word of [/customi[sz]e/i, /PAYMENTS_ENABLED/, /FLUTTERWAVE_(SECRET|WEBHOOK)/, /<button[^>]*>\s*Buy/i]) {
    assert.doesNotMatch(text, word, String(word));
  }
});

test('there is exactly one public "/" and "/combos": no admin page collides with them', () => {
  assert.ok(!existsSync(join(ROOT, 'src/app/page.tsx')), 'root page.tsx moved into (storefront)');
  assert.ok(existsSync(join(ROOT, 'src/app/(storefront)/page.tsx')));
  assert.ok(!existsSync(join(ROOT, 'src/app/(inventory)/combos')));
  assert.ok(existsSync(join(ROOT, 'src/app/(inventory)/promotions/combos/page.tsx'))); // admin stays under /promotions
});

test('the proxy matcher and the admin proxy and BFF files are not weakened by this milestone', () => {
  const proxy = read('src/proxy.ts');
  assert.match(proxy, /_next\/static\|_next\/image\|favicon\.ico\|icon\.svg\|api\//);
  assert.match(read('src/app/api/store/[...path]/route.ts'), /handleStoreRequest\(req, path, \{ env: process\.env, fetch \}\)/);
});
