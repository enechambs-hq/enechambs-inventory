import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCombosApi } from '../src/lib/combos/combos-api.ts';
import { moveImage, sortImages } from '../src/lib/combos/images.ts';
import {
  checkImageFile,
  confirmUpload,
  headersForPut,
  ImageUploadError,
  uploadComboImage,
  type UploadDeps,
} from '../src/lib/combos/upload.ts';
import { fakeHttp, httpError, image } from './combos-support.mts';

const ID = '11111111-1111-4111-8111-111111111111';
const UPLOAD_ID = '22222222-2222-4222-8222-222222222222';
const PRESIGN = {
  uploadId: UPLOAD_ID,
  uploadUrl: 'https://staging.r2.example.test/bucket/uploads/abc?X-Amz-Signature=sig',
  method: 'PUT' as const,
  headers: { 'Content-Type': 'image/png', 'Content-Length': '5000', 'x-extra': 'kept' },
  expiresAt: '2026-11-03T10:05:00.000Z',
  maxBytes: 5242880,
};
const FILE = { name: 'rice.png', type: 'image/png', size: 5000 };

interface PutCall {
  url: string;
  init: { method: string; headers: Record<string, string>; body: unknown };
}

function setup(responses: Array<unknown | Error>, putResult: { ok: boolean; status: number } | Error = { ok: true, status: 200 }) {
  const { http, calls } = fakeHttp(responses);
  const puts: PutCall[] = [];
  const deps: UploadDeps = {
    api: createCombosApi(http),
    fetchFn: async (url, init) => {
      puts.push({ url, init });
      if (putResult instanceof Error) throw putResult;
      return putResult;
    },
  };
  return { deps, calls, puts };
}

// ── presign → direct PUT → confirm ────────────────────────────────────────────
test('presign, then PUT straight to the returned URL, then confirm, in that order', async () => {
  const confirmed = image(1);
  const { deps, calls, puts } = setup([PRESIGN, confirmed]);
  const stages: string[] = [];
  const result = await uploadComboImage(deps, ID, FILE, { existingImageCount: 0, onStage: (s) => stages.push(s) });

  assert.deepEqual(stages, ['presign', 'upload', 'confirm']);
  assert.deepEqual(
    calls.map((c) => `${c.method} ${c.url}`),
    [`POST /admin/combos/${ID}/images/presign`, `POST /admin/combos/${ID}/images/confirm`],
  );
  assert.deepEqual(calls[0].body, { contentType: 'image/png', sizeBytes: 5000 });
  assert.deepEqual(calls[1].body, { uploadId: UPLOAD_ID });

  assert.equal(puts.length, 1);
  assert.equal(puts[0].url, PRESIGN.uploadUrl); // exactly the URL the API returned
  assert.equal(puts[0].init.method, 'PUT');
  assert.equal(puts[0].init.body, FILE); // the file itself, not routed through any API client
  assert.deepEqual(result, confirmed); // the image the API returned, not one built locally
});

test('the PUT carries exactly the returned headers and never the staff token', async () => {
  const { deps, puts } = setup([PRESIGN, image(1)]);
  await uploadComboImage(deps, ID, FILE, { existingImageCount: 0 });
  const sent = puts[0].init.headers;
  assert.equal(sent['Content-Type'], 'image/png');
  assert.equal(sent['x-extra'], 'kept');
  assert.ok(!Object.keys(sent).some((h) => h.toLowerCase() === 'authorization'));
});

test('browser-managed headers (Content-Length) are not set by script; everything else passes through', () => {
  assert.deepEqual(headersForPut({ 'Content-Type': 'image/png', 'content-length': '10', Host: 'x', 'X-A': '1' }), {
    'Content-Type': 'image/png',
    'X-A': '1',
  });
});

test('confirm carries trimmed alt text when given', async () => {
  const { deps, calls } = setup([PRESIGN, image(1)]);
  await uploadComboImage(deps, ID, FILE, { existingImageCount: 0, altText: '  Rice  ' });
  assert.deepEqual(calls[1].body, { uploadId: UPLOAD_ID, altText: 'Rice' });
});

// ── nothing counts as uploaded until confirm succeeds ─────────────────────────
test('if the PUT fails, confirm is never called', async () => {
  const { deps, calls } = setup([PRESIGN], { ok: false, status: 403 });
  await assert.rejects(uploadComboImage(deps, ID, FILE, { existingImageCount: 0 }), (e) => {
    assert.ok(e instanceof ImageUploadError);
    assert.equal(e.stage, 'upload');
    assert.equal(e.status, 403);
    assert.equal(e.uploadId, undefined);
    return true;
  });
  assert.deepEqual(calls.map((c) => c.url), [`/admin/combos/${ID}/images/presign`]);
});

test('a network failure during the PUT is an upload-stage error (no confirm)', async () => {
  const { deps, calls } = setup([PRESIGN], new TypeError('Failed to fetch'));
  await assert.rejects(uploadComboImage(deps, ID, FILE, { existingImageCount: 0 }), (e) => {
    assert.ok(e instanceof ImageUploadError);
    assert.equal(e.stage, 'upload');
    assert.match(e.message, /could not reach image storage/);
    return true;
  });
  assert.equal(calls.length, 1);
});

test('if confirm fails the error keeps the uploadId so the retry confirms without re-uploading', async () => {
  const { deps, calls, puts } = setup([PRESIGN, httpError(415, 'The uploaded file is not a valid JPEG, PNG or WebP image')]);
  let uploadId: string | undefined;
  await assert.rejects(uploadComboImage(deps, ID, FILE, { existingImageCount: 0 }), (e) => {
    assert.ok(e instanceof ImageUploadError);
    assert.equal(e.stage, 'confirm');
    assert.equal(e.status, 415);
    assert.match(e.message, /not a valid JPEG, PNG or WebP/);
    uploadId = e.uploadId;
    return true;
  });
  assert.equal(uploadId, UPLOAD_ID);

  // Retry: confirm only (idempotent on the server). No second presign, no second PUT.
  const retry = setup([image(1)]);
  const again = await confirmUpload(retry.deps, ID, uploadId as string);
  assert.deepEqual(again, image(1));
  assert.equal(retry.calls.length, 1);
  assert.equal(retry.calls[0].url, `/admin/combos/${ID}/images/confirm`);
  assert.equal(retry.puts.length, 0);
  assert.equal(puts.length, 1);
  assert.equal(calls.length, 2);
});

test('oversize at presign (413) is reported with the backend message', async () => {
  const { deps, puts } = setup([httpError(413, 'Images may be at most 5 MB')]);
  await assert.rejects(uploadComboImage(deps, ID, FILE, { existingImageCount: 0 }), (e) => {
    assert.ok(e instanceof ImageUploadError);
    assert.equal(e.stage, 'presign');
    assert.equal(e.status, 413);
    assert.match(e.message, /at most 5 MB/);
    return true;
  });
  assert.equal(puts.length, 0);
});

// ── 503: storage not configured ───────────────────────────────────────────────
test('503 on presign means storage is unavailable: clear message, no PUT, flagged for the UI', async () => {
  const { deps, puts } = setup([httpError(503, 'Image storage is not configured')]);
  await assert.rejects(uploadComboImage(deps, ID, FILE, { existingImageCount: 0 }), (e) => {
    assert.ok(e instanceof ImageUploadError);
    assert.equal(e.storageUnavailable, true);
    assert.equal(e.stage, 'presign');
    assert.match(e.message, /not configured or is unavailable/);
    assert.match(e.message, /still save this combo/);
    return true;
  });
  assert.equal(puts.length, 0);
});

test('503 on confirm also flags storage as unavailable', async () => {
  const { deps } = setup([PRESIGN, httpError(503, 'Image storage is not configured')]);
  await assert.rejects(uploadComboImage(deps, ID, FILE, { existingImageCount: 0 }), (e) => {
    assert.ok(e instanceof ImageUploadError);
    assert.equal(e.storageUnavailable, true);
    return true;
  });
});

test('other failures are not mistaken for storage being down', async () => {
  const { deps } = setup([httpError(409, 'A combo can have at most 8 images')]);
  await assert.rejects(uploadComboImage(deps, ID, FILE, { existingImageCount: 0 }), (e) => {
    assert.ok(e instanceof ImageUploadError);
    assert.equal(e.storageUnavailable, false);
    return true;
  });
});

// ── client-side checks (the backend repeats them) ─────────────────────────────
test('only JPEG, PNG and WebP are accepted', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    assert.equal(checkImageFile({ name: 'a', type, size: 1 }, 0), null, type);
  }
  for (const type of ['image/svg+xml', 'image/gif', 'application/pdf', 'text/html', '']) {
    assert.match(String(checkImageFile({ name: 'a', type, size: 1 }, 0)), /JPEG, PNG and WebP/, type);
  }
});

test('an empty file and a ninth image are refused before any request', async () => {
  assert.match(String(checkImageFile({ name: 'a', type: 'image/png', size: 0 }, 0)), /empty/);
  assert.equal(checkImageFile({ name: 'a', type: 'image/png', size: 1 }, 7), null);
  assert.match(String(checkImageFile({ name: 'a', type: 'image/png', size: 1 }, 8)), /at most 8/);

  const { deps, calls } = setup([]);
  await assert.rejects(uploadComboImage(deps, ID, FILE, { existingImageCount: 8 }), (e) => {
    assert.ok(e instanceof ImageUploadError);
    assert.equal(e.stage, 'validate');
    return true;
  });
  assert.equal(calls.length, 0);
});

// ── alt text, ordering, removal ───────────────────────────────────────────────
test('alt text edits go to PATCH images/:imageId and return the server image', async () => {
  const updated = image(1, { altText: 'Jollof rice' });
  const { http, calls } = fakeHttp([updated]);
  const result = await createCombosApi(http).updateImageAlt(ID, updated.id, 'Jollof rice');
  assert.equal(calls[0].method, 'PATCH');
  assert.deepEqual(calls[0].body, { altText: 'Jollof rice' });
  assert.equal(result.altText, 'Jollof rice');
});

test('a rejected alt-text edit propagates (the UI keeps the old value)', async () => {
  const { http } = fakeHttp([httpError(400, ['altText must be shorter than or equal to 200 characters'])]);
  await assert.rejects(createCombosApi(http).updateImageAlt(ID, 'x', 'a'.repeat(201)));
});

test('moveImage swaps neighbours and refuses to move past either end', () => {
  const ids = ['a', 'b', 'c'];
  assert.deepEqual(moveImage(ids, 1, -1), ['b', 'a', 'c']);
  assert.deepEqual(moveImage(ids, 1, 1), ['a', 'c', 'b']);
  assert.equal(moveImage(ids, 0, -1), null);
  assert.equal(moveImage(ids, 2, 1), null);
  assert.equal(moveImage(ids, 9, 1), null);
  assert.deepEqual(ids, ['a', 'b', 'c']); // input untouched
});

test('reorder sends every image id in the new order and returns the server order', async () => {
  const [a, b, c] = [image(1), image(2), image(3)];
  const serverOrder = [b, a, c].map((img, i) => ({ ...img, displayOrder: i }));
  const { http, calls } = fakeHttp([serverOrder]);
  const ids = moveImage([a.id, b.id, c.id], 1, -1) as string[];
  const result = await createCombosApi(http).reorderImages(ID, ids);
  assert.deepEqual(calls[0].body, { imageIds: [b.id, a.id, c.id] });
  assert.deepEqual(result.map((i) => i.id), [b.id, a.id, c.id]);
});

test('sortImages orders by the server displayOrder without mutating', () => {
  const list = [image(3, { displayOrder: 2 }), image(1, { displayOrder: 0 }), image(2, { displayOrder: 1 })];
  assert.deepEqual(sortImages(list).map((i) => i.displayOrder), [0, 1, 2]);
  assert.equal(list[0].displayOrder, 2);
});

test('a failed reorder propagates so the list is not reordered locally', async () => {
  const { http } = fakeHttp([httpError(400, 'imageIds must contain every image of the combo')]);
  await assert.rejects(createCombosApi(http).reorderImages(ID, ['x']));
});

test('removal: 204 resolves; 409 (last image of a published combo) and 500 reject with the backend status', async () => {
  const ok = fakeHttp([undefined]);
  await createCombosApi(ok.http).removeImage(ID, 'img');
  assert.equal(ok.calls[0].method, 'DELETE');

  const refused = fakeHttp([httpError(409, 'A published combo must keep at least one image')]);
  await assert.rejects(createCombosApi(refused.http).removeImage(ID, 'img'), (e: unknown) => {
    assert.equal((e as { response: { status: number } }).response.status, 409);
    return true;
  });

  const failed = fakeHttp([httpError(500, 'boom')]);
  await assert.rejects(createCombosApi(failed.http).removeImage(ID, 'img'));
  assert.equal(failed.calls.length, 1); // no follow-up GET to second-guess it
});
