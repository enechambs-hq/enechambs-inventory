import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ACTIVITY_ADMIN_ONLY_MESSAGE, canViewActivity } from '../src/lib/admin/activity-access.ts';
import { createLatest } from '../src/lib/admin/latest.ts';
import { LOGOUT_BOTH_FAILED, LOGOUT_OK, LOGOUT_REMOTE_FAILED, LOGOUT_STORAGE_FAILED, performLogout } from '../src/lib/admin/logout.ts';
import { searchView } from '../src/lib/admin/search-view.ts';
import { appErrorFromStaff } from '../src/lib/errors/staff-adapter.ts';
import { normalizeError } from '../src/lib/errors/normalize.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const axiosFail = (status: number, method: string, data: unknown = { message: 'x' }) =>
  Object.assign(new Error('failed'), { isAxiosError: true, config: { method }, response: { status, data } });

const USERS = 'src/app/(inventory)/users/page.tsx';
const ACTIVITY = 'src/app/(inventory)/activity/page.tsx';
const PANEL = 'src/components/layout/ActivityPanel.tsx';
const SHELL = 'src/components/layout/InventoryShell.tsx';
const SEARCH = 'src/components/layout/GlobalSearch.tsx';
const SIDEBAR = 'src/components/layout/Sidebar.tsx';

// ── Users ────────────────────────────────────────────────────────────────────

test('Users: no load failure is swallowed, and an error replaces (never becomes) the empty state', () => {
  const src = read(USERS);
  assert.doesNotMatch(src, /fail silently/);
  assert.doesNotMatch(src, /catch \{\s*\n/, 'no bare catch blocks');
  for (const call of ['usersError', 'perfError', 'activityError']) assert.match(src, new RegExp(`set${call[0].toUpperCase()}${call.slice(1)}\\(appErrorFromStaff\\(err, \\{ method: 'GET'`), call);
  // the error branch comes before the "nothing found" branch in each list
  assert.ok(src.indexOf('usersError ? (') < src.indexOf('No users found'));
  assert.ok(src.indexOf('perfError ? (') < src.indexOf('No performance data available'));
  assert.ok(src.indexOf('activityError ? (') < src.indexOf('>No activity found<'));
  // a failed per-user activity request never leaves the previous page's events on screen
  assert.match(src, /setActivityLogs\(\[\]\);\s*\n\s*setActivityError\(appErrorFromStaff/);
});

test('Users: loads are retried only by the person, and only through the shared panel', () => {
  const src = read(USERS);
  for (const [fn, title] of [['fetchUsers', 'Could not load users'], ['fetchPerformance', 'Could not load performance'], ['fetchActivityForUser', 'Could not load activity']]) {
    assert.match(src, new RegExp(`onRetry=\\{[^}]*${fn}[^}]*\\}[^>]*title="${title}"`), fn);
  }
  assert.doesNotMatch(src, /setInterval|setTimeout\([^)]*fetch/);
});

test('Users: a failed Save or Delete keeps its dialog open, keeps the entered values and shows the error inside it', () => {
  const src = read(USERS);
  const update = src.slice(src.indexOf('const handleUpdate'), src.indexOf('const handleDelete'));
  const updateCatch = update.slice(update.indexOf('} catch'), update.indexOf('} finally'));
  assert.match(updateCatch, /setEditError\(appErrorFromStaff/);
  assert.doesNotMatch(updateCatch, /setEditUser\(null\)|reset\(|toast\.success/);
  const del = src.slice(src.indexOf('const handleDelete'), src.indexOf('const lastLogin'));
  const delCatch = del.slice(del.indexOf('} catch'), del.indexOf('} finally'));
  assert.match(delCatch, /setDeleteError\(appErrorFromStaff/);
  assert.doesNotMatch(delCatch, /setDeleteUser\(null\)|toast\.success/);
  // success is the only path that closes them
  assert.match(update.slice(0, update.indexOf('} catch')), /setEditUser\(null\)/);
  assert.match(del.slice(0, del.indexOf('} catch')), /setDeleteUser\(null\)/);
  // and both dialogs render their error
  assert.match(src, /\{editError && <ErrorNotice error=\{editError\} \/>\}/);
  assert.match(src, /\{deleteError && <div className="mb-4"><ErrorNotice error=\{deleteError\} \/><\/div>\}/);
  // opening a dialog clears any earlier failure
  assert.match(src, /setEditError\(null\);\s*\n\s*setEditUser\(user\)/);
  assert.match(src, /setDeleteError\(null\); setDeleteUser\(user\)/);
});

test('Users: writes are declared as writes (never retryable); backend text is not shown raw', () => {
  const src = read(USERS);
  assert.doesNotMatch(src, /response\?\.data\?\.message/, 'no raw backend message is read');
  const e = appErrorFromStaff(axiosFail(503, 'delete'), { action: 'change', one: 'user' });
  assert.equal(e.retryable, false);
  assert.equal(appErrorFromStaff(axiosFail(409, 'patch', { message: 'password=hunter2 is reused' }), { action: 'change' }).message, 'This could not be completed because something has changed. Please review and try again.');
  assert.equal(appErrorFromStaff(axiosFail(403, 'patch'), { action: 'change' }).message, 'You do not have permission to make this change.');
});

// ── Activity page ────────────────────────────────────────────────────────────

test('Activity page: a failed request shows an error, not an empty history or a stale count', () => {
  const src = read(ACTIVITY);
  assert.doesNotMatch(src, /fail silently/);
  assert.match(src, /setError\(appErrorFromStaff\(err, \{ method: 'GET'/);
  assert.ok(src.indexOf('error ? (') < src.indexOf('No activity found'));
  assert.match(src, /\{!error && <p[^>]*>\{total\} total events<\/p>\}/);
  assert.match(src, /totalPages > 1 && !error/);
  assert.match(src, /onRetry=\{\(\) => void fetchLogs\(\)\}/);
});

// ── Activity panel and its access ────────────────────────────────────────────

test('only administrators may read activity (this mirrors the API, it is not the security boundary)', () => {
  assert.equal(canViewActivity('admin'), true);
  for (const role of ['staff', 'customer', '', null, undefined, 'ADMIN']) assert.equal(canViewActivity(role as string | null | undefined), false, String(role));
  assert.match(ACTIVITY_ADMIN_ONLY_MESSAGE, /administrators only/);
  // the API really is admin-only for these routes (read from the sibling repository when present)
  try {
    const api = readFileSync(new URL('../../enechambs-api-pr57/src/activity-logs/activity-logs.controller.ts', import.meta.url), 'utf8');
    assert.match(api, /@Roles\(UserRole\.ADMIN\)\s*\n@Controller\('activity-logs'\)/);
  } catch {
    /* the API repository is not checked out next to this one: nothing to compare */
  }
});

test('Activity panel: no request for non-admins, an explanation instead of "No recent activity", an error for failures', () => {
  const src = read(PANEL);
  assert.doesNotMatch(src, /\.catch\(\(\) => \{\}\)/);
  assert.match(src, /if \(open && canView\) load\(\)/, 'the request is gated');
  assert.match(src, /!canView \? \(\s*\n\s*<p role="status"[^>]*>\{ACTIVITY_ADMIN_ONLY_MESSAGE\}/);
  assert.ok(src.indexOf('!canView ?') < src.indexOf('No recent activity'));
  assert.ok(src.indexOf('error ? (') < src.indexOf('No recent activity'));
  assert.match(src, /onRetry=\{load\}/);
  assert.match(src, /\{canView && \(\s*\n\s*<div className="border-t[^>]*>\s*\n\s*<Link\s*\n\s*href="\/activity"/, 'the link to the admin-only page is hidden too');
  // a superseded or failed request cannot leave an older list on screen
  assert.match(src, /setActivities\(\[\]\);\s*\n\s*setError\(appErrorFromStaff/);
  assert.match(src, /latest\.current\.isCurrent\(ticket\)/);
});

test('the shell shows the Activity control and panel only to administrators, from the same rule', () => {
  const src = read(SHELL);
  assert.match(src, /const showActivity = canViewActivity\(user\?\.role\)/);
  assert.match(src, /\{showActivity && \(\s*\n\s*<button\s*\n\s*ref=\{activityButton\}/);
  assert.match(src, /open=\{activityOpen && showActivity\}/);
  assert.match(src, /canView=\{showActivity\}/);
});

// ── Global Search ────────────────────────────────────────────────────────────

test('search views: failed is never empty, a short query is idle, and old results never answer a failed query', () => {
  const base = { query: 'rice', loading: false, error: null, resultCount: 0 };
  assert.equal(searchView({ ...base, query: 'r' }), 'idle');
  assert.equal(searchView({ ...base, loading: true }), 'loading');
  assert.equal(searchView(base), 'empty');
  assert.equal(searchView({ ...base, resultCount: 3 }), 'results');
  const error = normalizeError(axiosFail(503, 'get'), { method: 'GET' });
  assert.equal(searchView({ ...base, error }), 'error');
  assert.equal(searchView({ ...base, error, resultCount: 3 }), 'error', 'stale results are not shown for a failed query');
});

test('latest-request guard: only the newest request may update the screen', () => {
  const latest = createLatest();
  const first = latest.next();
  const second = latest.next();
  assert.equal(latest.isCurrent(first), false);
  assert.equal(latest.isCurrent(second), true);
  latest.cancel();
  assert.equal(latest.isCurrent(second), false, 'cancelling invalidates what is in flight');
  assert.equal(latest.isCurrent(latest.next()), true);
});

test('Global Search: failure is a state of its own, the debounce stays, and stale responses are ignored', () => {
  const src = read(SEARCH);
  assert.doesNotMatch(src, /catch \{\s*\n\s*setResults\(\[\]\);\s*\n\s*\}/, 'the old swallow is gone');
  assert.match(src, /setResults\(\[\]\);\s*\n\s*setError\(appErrorFromStaff\(err, \{ method: 'GET'/);
  assert.match(src, /setTimeout\(\(\) => void runSearch\(val\), 150\)/, 'the 150ms debounce is unchanged');
  assert.match(src, /if \(!latest\.current\.isCurrent\(ticket\)\) return;/);
  assert.match(src, /view === 'error' && error/);
  assert.ok(src.indexOf("view === 'error'") < src.indexOf('No results for'));
  assert.match(src, /error\.retryable &&/, 'retry only when the error says it is safe');
  assert.match(src, /dashboardService\.globalSearch\(val, 12\)/, 'the request is unchanged');
});

// ── Sidebar logout ───────────────────────────────────────────────────────────

type Steps = Parameters<typeof performLogout>[0];
function logoutRun(over: Partial<Steps> = {}) {
  const log: string[] = [];
  const steps: Steps = {
    remote: async () => { log.push('remote'); },
    clearLocal: () => { log.push('clear'); return true; },
    leave: () => { log.push('leave'); },
    notify: (kind, message) => { log.push(`${kind}:${message}`); },
    ...over,
  };
  return { log, run: () => performLogout(steps) };
}

test('logout: everything works -> cleared, left, "Logged out successfully"', async () => {
  const { log, run } = logoutRun();
  assert.deepEqual(await run(), { remoteOk: true, localOk: true });
  assert.deepEqual(log, ['remote', 'clear', 'leave', `success:${LOGOUT_OK}`]);
});

test('logout: remote fails, local cleanup works -> still cleared and left, told honestly, no success message', async () => {
  for (const remote of [async () => { throw new Error('down'); }, () => { throw new Error('sync boom'); }]) {
    const { log, run } = logoutRun({ remote: remote as () => Promise<unknown> });
    assert.deepEqual(await run(), { remoteOk: false, localOk: true });
    assert.deepEqual(log, ['clear', 'leave', `warning:${LOGOUT_REMOTE_FAILED}`]);
    assert.doesNotMatch(log.join(' '), /success|Logged out successfully/);
  }
});

test('logout: remote works, local cleanup fails (returns false or throws) -> still left, warned about the saved sign-in', async () => {
  for (const clearLocal of [() => false, () => { throw new Error('SecurityError'); }]) {
    const { log, run } = logoutRun({ clearLocal });
    assert.deepEqual(await run(), { remoteOk: true, localOk: false });
    assert.deepEqual(log, ['remote', 'leave', `warning:${LOGOUT_STORAGE_FAILED}`]);
    assert.doesNotMatch(log.join(' '), /success/);
  }
});

test('logout: both fail -> still left, one clear warning that says both, nothing thrown', async () => {
  const { log, run } = logoutRun({ remote: async () => { throw new Error('down'); }, clearLocal: () => { throw new Error('SecurityError'); } });
  assert.deepEqual(await run(), { remoteOk: false, localOk: false });
  assert.deepEqual(log, ['leave', `warning:${LOGOUT_BOTH_FAILED}`]);
  assert.match(LOGOUT_BOTH_FAILED, /server.*browser would not let us remove/);
});

test('Sidebar logout uses the sequence and no longer swallows or claims success on failure', () => {
  const src = read(SIDEBAR);
  const logout = src.slice(src.indexOf('const handleLogout'), src.indexOf('return (\n    <>'));
  assert.match(logout, /performLogout\(/);
  assert.doesNotMatch(logout, /fail silently|catch \{|toast\.success\("Logged out successfully"\)/);
  assert.match(logout, /remote: \(\) => authService\.logout\(\)/);
  assert.match(logout, /clearLocal: clearAuth/);
  assert.match(logout, /router\.push\("\/login"\)/);
});

// ── scope guard ──────────────────────────────────────────────────────────────

test('the staff API proxy is still the bounded fetch (the interceptor is covered by session-access.test.mts)', () => {
  assert.match(read('src/app/api/v1/[...path]/route.ts'), /fetchBounded\(/);
});

// ── Activity layout (the narrow-screen defects found while verifying) ────────

test('Activity layout: long unbroken text can never widen a row, a table cell or the per-user dialog', () => {
  const users = read(USERS);
  const row = users.slice(users.indexOf('{activityLogs.map((log) => ('), users.indexOf('{activityTotalPages > 1'));
  assert.match(row, /grid min-w-0 grid-cols-\[minmax\(0,1fr\)\]/, 'a phone row is a shrinkable single column, not an auto-width track');
  assert.match(row, /sm:grid-cols-\[9rem_minmax\(0,11rem\)_minmax\(0,1fr\)\]/);
  assert.match(row, /\[overflow-wrap:anywhere\]/);
  assert.match(users, /min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden/);

  const page = read(ACTIVITY);
  const table = page.slice(page.indexOf('<tbody>'), page.indexOf('</tbody>'));
  assert.equal((table.match(/\[overflow-wrap:anywhere\]/g) ?? []).length, 2, 'the actor and description cells wrap anywhere (break-words does not shrink a table cell)');
  assert.match(read('src/components/activity/ActivityParts.tsx'), /\[overflow-wrap:anywhere\]/);
  // nothing in these views is ellipsised or hidden to make it fit
  for (const file of [ACTIVITY, PANEL, USERS]) assert.doesNotMatch(read(file), /\btruncate\b|text-ellipsis|line-clamp/, file);
});
