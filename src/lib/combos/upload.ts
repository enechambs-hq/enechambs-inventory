/**
 * Direct-to-storage image upload, following the backend contract exactly:
 *
 *   1. POST /:id/images/presign  { contentType, sizeBytes }
 *   2. PUT the file straight to the returned uploadUrl, sending exactly the
 *      returned headers (the file never passes through the Next.js proxy and
 *      the staff Authorization header is never sent to storage)
 *   3. POST /:id/images/confirm  { uploadId, altText? }
 *   4. Use the image the API returns.
 *
 * Nothing is treated as uploaded until confirm succeeds. This module never
 * builds a storage URL: it uses only what the API returned.
 */
import type { ComboImage } from '../../types/combos.ts';
import type { CombosApi } from './combos-api.ts';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGES_PER_COMBO } from './constants.ts';
import { describeApiError, IMAGE_STORAGE_UNAVAILABLE } from './errors.ts';

export type UploadStage = 'validate' | 'presign' | 'upload' | 'confirm';

export class ImageUploadError extends Error {
  readonly stage: UploadStage;
  readonly status: number | null;
  /** True for 503: storage is not configured or is down. Other combo details can still be saved. */
  readonly storageUnavailable: boolean;
  /**
   * Set when the file reached storage but confirm failed. Confirm is
   * idempotent, so retrying with this id is safe and does not re-upload.
   */
  readonly uploadId?: string;

  constructor(
    stage: UploadStage,
    message: string,
    options: { status?: number | null; uploadId?: string } = {},
  ) {
    super(message);
    this.name = 'ImageUploadError';
    this.stage = stage;
    this.status = options.status ?? null;
    this.storageUnavailable = options.status === 503;
    this.uploadId = options.uploadId;
  }
}

export interface UploadFile {
  name: string;
  type: string;
  size: number;
}

/** Client-side pre-checks. The backend repeats all of them (and checks the real bytes). */
export function checkImageFile(file: UploadFile, existingImageCount: number): string | null {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return 'Only JPEG, PNG and WebP images are accepted.';
  }
  if (file.size <= 0) return 'This file is empty.';
  if (existingImageCount >= MAX_IMAGES_PER_COMBO) {
    return `A combo can have at most ${MAX_IMAGES_PER_COMBO} images.`;
  }
  return null;
}

/**
 * Header names a browser refuses to set from script. fetch drops them silently
 * (the browser derives Content-Length from the body, which is the same file
 * whose size was presigned), so they are not passed.
 */
const BROWSER_MANAGED_HEADERS = new Set(['content-length', 'host']);

export function headersForPut(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (!BROWSER_MANAGED_HEADERS.has(name.toLowerCase())) out[name] = value;
  }
  return out;
}

export interface UploadDeps {
  api: Pick<CombosApi, 'presignImage' | 'confirmImage'>;
  /** Plain fetch. Must NOT be the axios client: no Authorization header may reach storage. */
  fetchFn: (url: string, init: { method: string; headers: Record<string, string>; body: unknown }) => Promise<{ ok: boolean; status: number }>;
}

export async function confirmUpload(
  deps: UploadDeps,
  comboId: string,
  uploadId: string,
  altText?: string,
): Promise<ComboImage> {
  try {
    const body: { uploadId: string; altText?: string } = { uploadId };
    if (altText && altText.trim()) body.altText = altText.trim();
    return await deps.api.confirmImage(comboId, body);
  } catch (error) {
    const problem = describeApiError(error);
    throw new ImageUploadError('confirm', problem.message, { status: problem.status, uploadId });
  }
}

export async function uploadComboImage(
  deps: UploadDeps,
  comboId: string,
  /** The browser File; it is sent as the PUT body. */
  file: UploadFile,
  options: { existingImageCount: number; altText?: string; onStage?: (stage: UploadStage) => void },
): Promise<ComboImage> {
  const invalid = checkImageFile(file, options.existingImageCount);
  if (invalid) throw new ImageUploadError('validate', invalid);

  options.onStage?.('presign');
  let presign;
  try {
    presign = await deps.api.presignImage(comboId, { contentType: file.type, sizeBytes: file.size });
  } catch (error) {
    const problem = describeApiError(error);
    throw new ImageUploadError(
      'presign',
      problem.status === 503 ? IMAGE_STORAGE_UNAVAILABLE : problem.message,
      { status: problem.status },
    );
  }

  options.onStage?.('upload');
  let response;
  try {
    response = await deps.fetchFn(presign.uploadUrl, {
      method: presign.method,
      headers: headersForPut(presign.headers),
      body: file,
    });
  } catch {
    throw new ImageUploadError(
      'upload',
      'The upload could not reach image storage. Check your connection and try again. If this keeps happening, the storage bucket may not allow uploads from this site.',
    );
  }
  if (!response.ok) {
    throw new ImageUploadError(
      'upload',
      `Image storage rejected the upload (${response.status}). Try again; the upload link may have expired.`,
      { status: response.status },
    );
  }

  options.onStage?.('confirm');
  return confirmUpload(deps, comboId, presign.uploadId, options.altText);
}
