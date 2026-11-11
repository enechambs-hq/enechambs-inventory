'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertCircle, ArrowLeft, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import ActionDialog from '@/components/promotions/ActionDialog';
import AdminOnly from '@/components/promotions/AdminOnly';
import ComboForm, { FormActionBar, ValidationSummary, focusFirstInvalid, hasFieldErrors } from '@/components/promotions/ComboForm';
import ComboImages from '@/components/promotions/ComboImages';
import ComboStatusBadge from '@/components/promotions/ComboStatusBadge';
import { combosService } from '@/lib/services/combos.service';
import { describeApiError, explainProblem } from '@/lib/combos/errors';
import {
  formFromCombo,
  hasChanges,
  isSlugFrozen,
  validateUpdate,
  type ComboFieldErrors,
  type ComboFormValues,
} from '@/lib/combos/form';
import type { Combo, ComboImage } from '@/types/combos';

type StatusAction = 'publish' | 'unpublish';

function EditCombo({ id }: { id: string }) {
  const [combo, setCombo] = useState<Combo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [values, setValues] = useState<ComboFormValues | null>(null);
  const [errors, setErrors] = useState<ComboFieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [action, setAction] = useState<StatusAction | null>(null);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const adopt = useCallback((next: Combo) => {
    setCombo(next);
    setValues(formFromCombo(next));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      adopt(await combosService.get(id));
    } catch (error) {
      setLoadError(explainProblem(describeApiError(error), 'load'));
    } finally {
      setLoading(false);
    }
  }, [id, adopt]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[45rem]" aria-busy="true">
        <div className="space-y-4">
          <div className="h-8 w-64 animate-pulse rounded-md bg-gray-200" />
          <div className="h-80 animate-pulse rounded-2xl bg-gray-200/70" />
        </div>
      </div>
    );
  }

  if (loadError || !combo || !values) {
    return (
      <div className="mx-auto w-full max-w-[45rem]">
        <Link href="/promotions/combos" className="mb-2 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-gray-700 hover:text-[#1a7a4a]">
          <ArrowLeft size={16} aria-hidden="true" />
          All combos
        </Link>
        <div role="alert" className="flex flex-col items-center rounded-2xl border border-gray-200 bg-white px-6 py-14 text-center">
          <AlertCircle size={28} className="mb-3 text-red-500" />
          <p className="text-base font-semibold text-gray-900">Could not load this combo</p>
          <p className="mt-1 max-w-md text-base text-gray-600">{loadError}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#b9e0c9] bg-white px-4 text-sm font-semibold text-[#1a7a4a] hover:bg-[#e8f5ee]"
          >
            <RefreshCw size={16} />
            Try again
          </button>
        </div>
      </div>
    );
  }

  const slugFrozen = isSlugFrozen(combo);
  const dirty = (() => {
    const r = validateUpdate(values, combo);
    return r.ok ? hasChanges(r.payload) : true;
  })();

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    const result = validateUpdate(values, combo);
    if (!result.ok) {
      setErrors(result.errors);
      focusFirstInvalid(result.errors, values);
      return;
    }
    setErrors({});
    if (!hasChanges(result.payload)) {
      toast.info('There are no changes to save.');
      return;
    }
    setSaving(true);
    try {
      // Only server-confirmed state replaces what is on screen.
      adopt(await combosService.update(combo.id, result.payload));
      toast.success('Combo saved');
    } catch (error) {
      setSaveError(explainProblem(describeApiError(error), 'save'));
    } finally {
      setSaving(false);
    }
  };

  const closeAction = () => {
    if (acting) return;
    setAction(null);
    setActionError(null);
  };

  const runAction = async () => {
    if (!action) return;
    setActing(true);
    setActionError(null);
    try {
      const next = action === 'publish' ? await combosService.publish(combo.id) : await combosService.unpublish(combo.id);
      // Keep unsaved edits in the form; only the server-managed parts change.
      setCombo(next);
      setValues((v) => (v && dirty ? { ...v, slug: isSlugFrozen(next) ? next.slug : v.slug } : formFromCombo(next)));
      toast.success(action === 'publish' ? 'Combo published' : 'Combo unpublished');
      setAction(null);
    } catch (error) {
      const message = explainProblem(describeApiError(error), action);
      setActionError(message);
      toast.error(message);
    } finally {
      setActing(false);
    }
  };

  const onImagesChange = (images: ComboImage[]) => setCombo((c) => (c ? { ...c, images } : c));

  const published = combo.status === 'published';

  return (
    <div className="mx-auto w-full max-w-[45rem]">
      <Link href="/promotions/combos" className="mb-2 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-gray-700 hover:text-[#1a7a4a]">
        <ArrowLeft size={16} aria-hidden="true" />
        All combos
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-[1.75rem] font-bold leading-8 text-[#0f4f2d] md:text-[2rem] md:leading-10">{combo.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <ComboStatusBadge status={combo.status} />
            <span className="break-all text-sm text-gray-600">/{combo.slug}</span>
          </p>
        </div>
        {published ? (
          <button
            type="button"
            onClick={() => setAction('unpublish')}
            className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-5 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-50 sm:w-auto"
          >
            <EyeOff size={18} aria-hidden="true" />
            Unpublish
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setAction('publish')}
            className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-[#1a7a4a] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#145c37] sm:w-auto"
          >
            <Eye size={18} aria-hidden="true" />
            Publish
          </button>
        )}
      </div>

      <div className="space-y-4">
        <form onSubmit={onSave} noValidate className="space-y-4">
          <ComboForm
            mode="edit"
            values={values}
            errors={errors}
            slugFrozen={slugFrozen}
            allocatedQuantity={combo.allocatedQuantity}
            remainingQuantity={combo.remainingQuantity}
            disabled={saving}
            onChange={(patch) => setValues((v) => (v ? { ...v, ...patch } : v))}
          />
          {(hasFieldErrors(errors) || saveError) && (
            <div className="space-y-3">
              <ValidationSummary errors={errors} />
              {saveError && (
                <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-base text-red-800">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{saveError}</span>
                </div>
              )}
            </div>
          )}
          <FormActionBar>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
              <button
                type="submit"
                disabled={saving || !dirty}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-[#1a7a4a] px-5 text-base font-semibold text-white transition-colors hover:bg-[#145c37] disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              {dirty && !saving && <span className="text-center text-sm text-gray-700 md:text-left">You have unsaved changes.</span>}
            </div>
          </FormActionBar>
        </form>

        <ComboImages combo={combo} onImagesChange={onImagesChange} />
      </div>

      <ActionDialog
        open={action === 'publish'}
        title="Publish this combo?"
        description={
          <>
            <span className="font-medium text-gray-700">&ldquo;{combo.name}&rdquo;</span> will become available to
            customers wherever the storefront shows combos, and its slug will be locked. It needs at least one item in &ldquo;What&rsquo;s included&rdquo; and at least one image.
            {dirty && (
              <span className="block mt-2 text-amber-700">
                You have unsaved changes. Publishing does not save them; save first if they should go live.
              </span>
            )}
          </>
        }
        large
        confirmLabel="Publish"
        busyLabel="Publishing…"
        isLoading={acting}
        error={action === 'publish' ? actionError : null}
        onClose={closeAction}
        onConfirm={runAction}
      />
      <ActionDialog
        open={action === 'unpublish'}
        title="Unpublish this combo?"
        description={
          <>
            <span className="font-medium text-gray-700">&ldquo;{combo.name}&rdquo;</span> will stop being available to
            customers. Its stock and images are kept, and you can publish it again at any time.
          </>
        }
        large
        confirmLabel="Unpublish"
        busyLabel="Unpublishing…"
        tone="warning"
        isLoading={acting}
        error={action === 'unpublish' ? actionError : null}
        onClose={closeAction}
        onConfirm={runAction}
      />
    </div>
  );
}

export default function EditComboPage() {
  const params = useParams<{ id: string }>();
  return (
    <AdminOnly>
      <EditCombo id={params.id} />
    </AdminOnly>
  );
}
