'use client';

import { useRef, useState } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, ImageIcon, Loader2, RefreshCw, Trash2, UploadCloud, X } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { combosService } from '@/lib/services/combos.service';
import {
  ALLOWED_IMAGE_TYPES,
  MAX_ALT_TEXT_LENGTH,
  MAX_IMAGES_PER_COMBO,
} from '@/lib/combos/constants';
import { describeApiError, explainProblem, IMAGE_STORAGE_UNAVAILABLE } from '@/lib/combos/errors';
import { formatBytes } from '@/lib/combos/format';
import { moveImage, sortImages } from '@/lib/combos/images';
import {
  checkImageFile,
  confirmUpload,
  ImageUploadError,
  uploadComboImage,
  type UploadDeps,
  type UploadStage,
} from '@/lib/combos/upload';
import type { Combo, ComboImage } from '@/types/combos';

interface ComboImagesProps {
  combo: Combo;
  /** Called with server-confirmed state only. */
  onImagesChange: (images: ComboImage[]) => void;
}

type QueueStatus = 'working' | 'failed';

interface QueueItem {
  key: string;
  file: File;
  stage: UploadStage;
  status: QueueStatus;
  error?: string;
  /** Set when the file reached storage and only confirm failed: retry confirms without re-uploading. */
  uploadId?: string;
}

const deps: UploadDeps = {
  api: combosService,
  // Plain fetch, never the axios client: the staff token must not be sent to storage,
  // and the file must not pass through the Next.js proxy.
  fetchFn: (url, init) => fetch(url, init as RequestInit),
};

const STAGE_LABEL: Record<UploadStage, string> = {
  validate: 'Checking',
  presign: 'Preparing upload',
  upload: 'Uploading',
  confirm: 'Verifying',
};

export default function ComboImages({ combo, onImagesChange }: ComboImagesProps) {
  const images = sortImages(combo.images);
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [storageDown, setStorageDown] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null); // image id with a pending server call
  const [reordering, setReordering] = useState(false);
  const [alts, setAlts] = useState<Record<string, string>>({});
  const [removeTarget, setRemoveTarget] = useState<ComboImage | null>(null);
  const [removing, setRemoving] = useState(false);

  // Refs so the sequential upload loop always sees the latest server-confirmed list.
  const latest = useRef<ComboImage[]>(combo.images);
  latest.current = combo.images;

  const patchItem = (key: string, patch: Partial<QueueItem>) =>
    setQueue((q) => q.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const dropItem = (key: string) => setQueue((q) => q.filter((i) => i.key !== key));

  const handleFailure = (key: string, error: unknown) => {
    if (error instanceof ImageUploadError) {
      if (error.storageUnavailable) setStorageDown(true);
      patchItem(key, { status: 'failed', error: error.message, uploadId: error.uploadId });
    } else {
      patchItem(key, { status: 'failed', error: describeApiError(error).message });
    }
  };

  const runUpload = async (item: QueueItem) => {
    patchItem(item.key, { status: 'working', error: undefined, stage: 'presign' });
    try {
      const image = item.uploadId
        ? await confirmUpload(deps, combo.id, item.uploadId)
        : await uploadComboImage(deps, combo.id, item.file, {
            existingImageCount: latest.current.length,
            onStage: (stage) => patchItem(item.key, { stage }),
          });
      // Only now, with the server's confirmation, does the image exist in the UI.
      latest.current = [...latest.current, image];
      onImagesChange(latest.current);
      dropItem(item.key);
      setStorageDown(false);
      toast.success('Image added');
    } catch (error) {
      handleFailure(item.key, error);
    }
  };

  const onFilesChosen = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    if (inputRef.current) inputRef.current.value = '';

    const items: QueueItem[] = [];
    let slots = MAX_IMAGES_PER_COMBO - latest.current.length - queue.filter((q) => q.status === 'working').length;
    for (const file of files) {
      const problem = checkImageFile(file, MAX_IMAGES_PER_COMBO - slots);
      if (problem || slots <= 0) {
        toast.error(`${file.name}: ${problem ?? `A combo can have at most ${MAX_IMAGES_PER_COMBO} images.`}`);
        continue;
      }
      slots -= 1;
      items.push({ key: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file, stage: 'presign', status: 'working' });
    }
    if (items.length === 0) return;
    setQueue((q) => [...q, ...items]);
    // One at a time: each confirmed image counts toward the server's limit of eight.
    for (const item of items) await runUpload(item);
  };

  const saveAlt = async (image: ComboImage) => {
    const text = (alts[image.id] ?? image.altText).trim();
    if (text === image.altText) return;
    setBusyId(image.id);
    try {
      const updated = await combosService.updateImageAlt(combo.id, image.id, text);
      onImagesChange(combo.images.map((i) => (i.id === updated.id ? updated : i)));
      setAlts((a) => {
        const next = { ...a };
        delete next[image.id];
        return next;
      });
      toast.success('Alt text saved');
    } catch (error) {
      toast.error(explainProblem(describeApiError(error), 'image'));
    } finally {
      setBusyId(null);
    }
  };

  const move = async (index: number, delta: -1 | 1) => {
    const ids = moveImage(images.map((i) => i.id), index, delta);
    if (!ids) return;
    setReordering(true);
    try {
      // The list on screen changes only after the server returns the new order.
      const ordered = await combosService.reorderImages(combo.id, ids);
      onImagesChange(ordered);
    } catch (error) {
      toast.error(explainProblem(describeApiError(error), 'image'));
    } finally {
      setReordering(false);
    }
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    const target = removeTarget;
    setRemoving(true);
    try {
      await combosService.removeImage(combo.id, target.id);
      onImagesChange(combo.images.filter((i) => i.id !== target.id));
      toast.success('Image removed');
      setRemoveTarget(null);
    } catch (error) {
      // 4xx (e.g. 409: a published combo must keep one image) and 5xx alike: the
      // image is still on screen because the server did not confirm the removal.
      toast.error(explainProblem(describeApiError(error), 'remove'));
      setRemoveTarget(null);
    } finally {
      setRemoving(false);
    }
  };

  const uploading = queue.some((q) => q.status === 'working');
  const full = images.length >= MAX_IMAGES_PER_COMBO;

  const imgBtn =
    'inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-1 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:px-4';
  const grayBtn = `${imgBtn} border-gray-300 bg-white text-gray-700 hover:bg-gray-50`;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6" aria-labelledby="images-heading">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="images-heading" className="text-lg font-semibold text-[#0f4f2d]">
            Images
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {images.length} of {MAX_IMAGES_PER_COMBO} · JPEG, PNG or WebP. The first image is the main one. A combo needs
            at least one image to be published.
          </p>
        </div>
        <div className="shrink-0">
          <input
            ref={inputRef}
            id="combo-image-input"
            type="file"
            multiple
            accept={ALLOWED_IMAGE_TYPES.join(',')}
            className="peer sr-only"
            onChange={(e) => onFilesChosen(e.target.files)}
            disabled={full}
          />
          <label
            htmlFor="combo-image-input"
            className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#1a7a4a] sm:w-auto ${
              full
                ? 'cursor-not-allowed bg-gray-100 text-gray-500'
                : 'cursor-pointer bg-[#1a7a4a] text-white hover:bg-[#145c37]'
            }`}
          >
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
            {full ? 'Image limit reached' : 'Add images'}
          </label>
        </div>
      </div>

      <div className="space-y-4">
        {storageDown && (
          <div role="alert" className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-3 text-base text-amber-900">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{IMAGE_STORAGE_UNAVAILABLE}</span>
          </div>
        )}

        {queue.length > 0 && (
          <ul className="space-y-2" aria-label="Uploads in progress">
            {queue.map((item) => (
              <li key={item.key} className="rounded-xl border border-gray-200 p-3 text-base">
                <div className="flex items-start gap-3">
                  {item.status === 'working' ? (
                    <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin text-[#1a7a4a]" />
                  ) : (
                    <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-semibold text-gray-900">
                      {item.file.name} <span className="font-normal text-gray-600">· {formatBytes(item.file.size)}</span>
                    </p>
                    <p
                      className={`text-sm ${item.status === 'failed' ? 'font-medium text-red-700' : 'text-gray-600'}`}
                      role={item.status === 'failed' ? 'alert' : undefined}
                    >
                      {item.status === 'working' ? `${STAGE_LABEL[item.stage]}…` : item.error}
                    </p>
                  </div>
                </div>
                {item.status === 'failed' && (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => runUpload(item)}
                      className={`${imgBtn} w-full border-[#b9e0c9] bg-white text-[#1a7a4a] hover:bg-[#e8f5ee] sm:w-auto`}
                    >
                      <RefreshCw size={16} />
                      {item.uploadId ? 'Retry verification' : 'Retry'}
                    </button>
                    <button
                      type="button"
                      onClick={() => dropItem(item.key)}
                      aria-label={`Dismiss ${item.file.name}`}
                      className={`${grayBtn} w-full sm:w-auto`}
                    >
                      <X size={16} aria-hidden="true" />
                      Dismiss
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {images.length === 0 && queue.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8f5ee]">
              <ImageIcon size={24} className="text-[#1a7a4a]" />
            </div>
            <p className="text-base font-semibold text-gray-900">No images yet</p>
            <p className="mt-1 max-w-xs text-sm text-gray-600">
              Add at least one image to publish this combo. Images are checked by the server before they are attached.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {images.map((image, index) => {
              const altValue = alts[image.id] ?? image.altText;
              const dirty = altValue.trim() !== image.altText;
              const pending = busyId === image.id;
              return (
                <li
                  key={image.id}
                  className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-3 rounded-xl border border-gray-200 p-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-x-4 sm:p-4"
                >
                  <div className="flex h-24 w-24 items-center justify-center self-start overflow-hidden rounded-lg border border-gray-200 bg-gray-50 sm:row-span-3 sm:h-28 sm:w-28">
                    {image.url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- URL is the server-provided public media URL; next/image would need per-host config
                      <img src={image.url} alt={image.altText} className="h-full w-full object-cover" />
                    ) : (
                      <div className="px-1 text-center">
                        <ImageIcon size={20} className="mx-auto text-gray-400" />
                        <p className="mt-1 text-sm leading-tight text-gray-600">No preview</p>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 self-center sm:self-start">
                    {index === 0 && (
                      <p className="mb-1">
                        <span className="rounded-full bg-[#e8f5ee] px-2.5 py-0.5 text-sm font-semibold text-[#14693f]">Main image</span>
                      </p>
                    )}
                    <p className="text-sm text-gray-700">
                      {image.contentType.replace('image/', '').toUpperCase()} · {formatBytes(image.sizeBytes)}
                    </p>
                  </div>
                  <form
                    className="col-span-2 sm:col-span-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void saveAlt(image);
                    }}
                  >
                    <label htmlFor={`alt-${image.id}`} className="mb-1 block text-sm font-semibold text-gray-800">
                      Alt text <span className="font-normal text-gray-600">(describes the image for screen readers)</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        id={`alt-${image.id}`}
                        type="text"
                        value={altValue}
                        maxLength={MAX_ALT_TEXT_LENGTH}
                        onChange={(e) => setAlts((a) => ({ ...a, [image.id]: e.target.value }))}
                        placeholder="Alt text: describe the image for screen readers"
                        className="block min-h-11 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 outline-none focus:border-[#1a7a4a] focus:ring-2 focus:ring-[#1a7a4a]/20"
                      />
                      <button
                        type="submit"
                        disabled={!dirty || pending}
                        className={`${imgBtn} border-[#b9e0c9] bg-white px-4 text-[#1a7a4a] hover:bg-[#e8f5ee]`}
                      >
                        {pending ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </form>
                  <div className="col-span-2 grid grid-cols-3 gap-2 sm:col-span-1 sm:flex">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0 || reordering || pending}
                      aria-label={`Move image ${index + 1} up`}
                      className={grayBtn}
                    >
                      <ArrowUp size={16} className="hidden sm:block" aria-hidden="true" />
                      Move up
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === images.length - 1 || reordering || pending}
                      aria-label={`Move image ${index + 1} down`}
                      className={grayBtn}
                    >
                      <ArrowDown size={16} className="hidden sm:block" aria-hidden="true" />
                      Move down
                    </button>
                    <button
                      type="button"
                      onClick={() => setRemoveTarget(image)}
                      disabled={reordering || pending}
                      aria-label={`Remove image ${index + 1}`}
                      className={`${imgBtn} border-red-200 bg-white text-red-700 hover:bg-red-50`}
                    >
                      <Trash2 size={16} className="hidden sm:block" aria-hidden="true" />
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={!!removeTarget}
        itemName={removeTarget ? removeTarget.altText || `Image ${images.findIndex((i) => i.id === removeTarget.id) + 1}` : null}
        entityLabel="image"
        onClose={() => !removing && setRemoveTarget(null)}
        onConfirm={confirmRemove}
        isLoading={removing}
      />
    </section>
  );
}
