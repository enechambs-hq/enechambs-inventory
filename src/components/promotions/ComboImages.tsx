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

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100" aria-labelledby="images-heading">
      <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="images-heading" className="text-base font-semibold text-gray-900">
            Images
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {images.length} of {MAX_IMAGES_PER_COMBO} · JPEG, PNG or WebP. The first image is the main one. A combo needs
            at least one image to be published.
          </p>
        </div>
        <div>
          <input
            ref={inputRef}
            id="combo-image-input"
            type="file"
            multiple
            accept={ALLOWED_IMAGE_TYPES.join(',')}
            className="sr-only"
            onChange={(e) => onFilesChosen(e.target.files)}
            disabled={full}
          />
          <label
            htmlFor="combo-image-input"
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors focus-within:ring-2 focus-within:ring-[#1a7a4a]/40 ${
              full
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-[#1a7a4a] text-white hover:bg-[#145c37] cursor-pointer'
            }`}
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
            {full ? 'Image limit reached' : 'Add images'}
          </label>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {storageDown && (
          <div role="alert" className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{IMAGE_STORAGE_UNAVAILABLE}</span>
          </div>
        )}

        {queue.length > 0 && (
          <ul className="space-y-2" aria-label="Uploads in progress">
            {queue.map((item) => (
              <li key={item.key} className="flex items-center gap-3 rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm">
                {item.status === 'working' ? (
                  <Loader2 size={16} className="animate-spin text-[#1a7a4a] shrink-0" />
                ) : (
                  <AlertCircle size={16} className="text-red-500 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-800 truncate">
                    {item.file.name} <span className="text-gray-400 font-normal">· {formatBytes(item.file.size)}</span>
                  </p>
                  <p className={`text-xs ${item.status === 'failed' ? 'text-red-600' : 'text-gray-500'}`} role={item.status === 'failed' ? 'alert' : undefined}>
                    {item.status === 'working' ? `${STAGE_LABEL[item.stage]}…` : item.error}
                  </p>
                </div>
                {item.status === 'failed' && (
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => runUpload(item)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#1a7a4a] rounded-md hover:bg-[#e8f5ee]"
                    >
                      <RefreshCw size={13} />
                      {item.uploadId ? 'Retry verification' : 'Retry'}
                    </button>
                    <button
                      type="button"
                      onClick={() => dropItem(item.key)}
                      aria-label={`Dismiss ${item.file.name}`}
                      className="p-1.5 text-gray-400 rounded-md hover:bg-gray-100"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {images.length === 0 && queue.length === 0 ? (
          <div className="flex flex-col items-center text-center py-10">
            <div className="w-14 h-14 rounded-2xl bg-[#e8f5ee] flex items-center justify-center mb-3">
              <ImageIcon size={24} className="text-[#1a7a4a]" />
            </div>
            <p className="text-sm font-medium text-gray-800">No images yet</p>
            <p className="text-xs text-gray-500 mt-1 max-w-xs">
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
                <li key={image.id} className="flex flex-col sm:flex-row gap-4 rounded-xl border border-gray-200 p-3">
                  <div className="w-full sm:w-32 h-32 shrink-0 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden flex items-center justify-center">
                    {image.url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- URL is the server-provided public media URL; next/image would need per-host config
                      <img src={image.url} alt={image.altText} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center px-2">
                        <ImageIcon size={20} className="text-gray-300 mx-auto" />
                        <p className="text-[11px] text-gray-400 mt-1">Preview unavailable: no public media URL is configured</p>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-gray-500">
                        {index === 0 && <span className="font-medium text-[#1a7a4a] mr-2">Main image</span>}
                        {image.contentType.replace('image/', '').toUpperCase()} · {formatBytes(image.sizeBytes)}
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => move(index, -1)}
                          disabled={index === 0 || reordering || pending}
                          aria-label={`Move image ${index + 1} up`}
                          className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowUp size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(index, 1)}
                          disabled={index === images.length - 1 || reordering || pending}
                          aria-label={`Move image ${index + 1} down`}
                          className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowDown size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemoveTarget(image)}
                          disabled={reordering || pending}
                          aria-label={`Remove image ${index + 1}`}
                          className="p-1.5 rounded-md text-red-500 hover:bg-red-50 disabled:opacity-30"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void saveAlt(image);
                      }}
                    >
                      <div className="flex-1">
                        <label htmlFor={`alt-${image.id}`} className="sr-only">
                          Alt text for image {index + 1}
                        </label>
                        <input
                          id={`alt-${image.id}`}
                          type="text"
                          value={altValue}
                          maxLength={MAX_ALT_TEXT_LENGTH}
                          onChange={(e) => setAlts((a) => ({ ...a, [image.id]: e.target.value }))}
                          placeholder="Alt text: describe the image for screen readers"
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#1a7a4a] focus:ring-1 focus:ring-[#1a7a4a]/20"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={!dirty || pending}
                        className="px-3.5 py-2 text-sm font-medium text-[#1a7a4a] border border-[#b9e0c9] rounded-lg hover:bg-[#e8f5ee] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {pending ? 'Saving…' : 'Save'}
                      </button>
                    </form>
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
