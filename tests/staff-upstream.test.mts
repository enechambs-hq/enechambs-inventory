import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { test } from 'node:test';
import { fetchBounded } from '../src/lib/server/staff-upstream.ts';

/** A real local server: `silent` never answers, `stall` sends headers then never finishes the body, `ok` answers. */
async function server(mode: 'silent' | 'stall' | 'ok') {
  const sockets = new Set<import('node:net').Socket>();
  const s: Server = createServer((req, res) => {
    if (mode === 'silent') return;
    res.writeHead(200, { 'content-type': 'text/plain', 'content-length': '100' });
    if (mode === 'stall') {
      res.write('partial');
      return;
    }
    res.end('x'.repeat(100));
  });
  s.on('connection', (sock) => {
    sockets.add(sock);
    sock.on('close', () => sockets.delete(sock));
  });
  await new Promise<void>((resolve) => s.listen(0, '127.0.0.1', resolve));
  const { port } = s.address() as { port: number };
  return { url: `http://127.0.0.1:${port}/`, close: async () => { for (const k of sockets) k.destroy(); await new Promise((r) => s.close(r)); } };
}

const timers = () => process.getActiveResourcesInfo().filter((n) => n === 'Timeout').length;

test('a backend that never answers is cut off at the deadline with a TimeoutError', async () => {
  const srv = await server('silent');
  try {
    const started = Date.now();
    await assert.rejects(fetchBounded(srv.url, { method: 'GET' }, { timeoutMs: 150 }), (e: Error) => e.name === 'TimeoutError');
    const took = Date.now() - started;
    assert.ok(took >= 140 && took < 1500, `took ${took}ms`);
  } finally {
    await srv.close();
  }
});

test('the deadline holds under memory pressure and garbage collection (the AbortSignal.any failure mode)', async () => {
  const srv = await server('silent');
  try {
    const attempts = Array.from({ length: 12 }, () =>
      Promise.race([
        fetchBounded(srv.url, { method: 'GET' }, { timeoutMs: 200, signal: new AbortController().signal }).then(() => 'responded', (e: Error) => e.name),
        new Promise<string>((resolve) => setTimeout(() => resolve('HUNG'), 3000)),
      ]),
    );
    // Churn memory and ask for collections while the requests are in flight.
    for (let i = 0; i < 6; i++) {
      Array.from({ length: 2000 }, () => new Array(500).fill(i));
      (globalThis as { gc?: () => void }).gc?.();
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.deepEqual(await Promise.all(attempts), Array(12).fill('TimeoutError'));
  } finally {
    await srv.close();
  }
});

test('a body that stalls after its headers is also cut off by the deadline', async () => {
  const srv = await server('stall');
  try {
    await assert.rejects(fetchBounded(srv.url, { method: 'GET' }, { timeoutMs: 200 }), (e: Error) => e.name === 'TimeoutError');
  } finally {
    await srv.close();
  }
});

test('a normal response returns its status and body, and leaves no timer behind', async () => {
  const srv = await server('ok');
  try {
    const before = timers();
    const { response, data } = await fetchBounded(srv.url, { method: 'GET' }, { timeoutMs: 5000 });
    assert.equal(response.status, 200);
    assert.equal(new TextDecoder().decode(data as ArrayBuffer), 'x'.repeat(100));
    assert.equal(timers(), before, 'the deadline timer was cleared');
  } finally {
    await srv.close();
  }
});

test('statuses that carry no body are not read', async () => {
  let read = false;
  const fake = async () => {
    const r = new Response(null, { status: 204 });
    r.arrayBuffer = async () => { read = true; return new ArrayBuffer(0); };
    return r;
  };
  const { data } = await fetchBounded('http://x.test/', { method: 'DELETE' }, { timeoutMs: 1000, noBodyStatuses: new Set([204]), fetchFn: fake });
  assert.equal(data, null);
  assert.equal(read, false);
});

test('when the browser goes away the backend request is cancelled, and nothing is retried', async () => {
  const srv = await server('silent');
  let calls = 0;
  const counting = (u: string, i: RequestInit) => { calls += 1; return fetch(u, i); };
  try {
    const browser = new AbortController();
    const pending = fetchBounded(srv.url, { method: 'POST', body: '{}' }, { timeoutMs: 5000, signal: browser.signal, fetchFn: counting });
    setTimeout(() => browser.abort(), 50);
    await assert.rejects(pending, (e: Error) => e.name !== 'TimeoutError');
    assert.equal(calls, 1);
    // An already-aborted browser signal never even reaches the backend long enough to matter.
    const early = new AbortController();
    early.abort();
    await assert.rejects(fetchBounded(srv.url, { method: 'GET' }, { timeoutMs: 5000, signal: early.signal, fetchFn: counting }));
  } finally {
    await srv.close();
  }
});

test('the proxy route uses the owned deadline, not AbortSignal.any', () => {
  const route = readFileSync(new URL('../src/app/api/v1/[...path]/route.ts', import.meta.url), 'utf8');
  assert.match(route, /fetchBounded\(/);
  assert.doesNotMatch(route, /AbortSignal\.any/);
});
