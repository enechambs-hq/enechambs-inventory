'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertCircle, ArrowLeft, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import ActionDialog from '@/components/promotions/ActionDialog';
import AdminOnly from '@/components/promotions/AdminOnly';
import ComboForm from '@/components/promotions/ComboForm';
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
      <div className="min-h-screen bg-[#f0f2f0] p-6" aria-busy="true">
        <div className="max-w-3xl space-y-4">
          <div className="h-8 w-64 rounded-md bg-gray-200 animate-pulse" />
          <div className="h-80 rounded-2xl bg-gray-200/70 animate-pulse" />
        </div>
      </div>
    );
  }

  if (loadError || !combo || !values) {
    return (
      <div className="min-h-screen bg-[#f0f2f0] p-6">
        <Link href="/promotions/combos" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4">
          <ArrowLeft size={14} />
          All combos
        </Link>
        <div role="alert" className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center py-16 px-6">
          <AlertCircle size={28} className="text-red-400 mb-3" />
          <p className="text-sm font-medium text-gray-800">Could not load this combo</p>
          <p className="text-sm text-gray-500 mt-1 max-w-md">{loadError}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#1a7a4a] border border-[#b9e0c9] rounded-lg hover:bg-[#e8f5ee]"
          >
            <RefreshCw size={14} />
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
    <div className="min-h-screen bg-[#f0f2f0] p-6">
      <Link href="/promotions/combos" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4">
        <ArrowLeft size={14} />
        All combos
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6 max-w-5xl">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{combo.name}</h1>
            <ComboStatusBadge status={combo.status} />
          </div>
          <p className="text-sm text-gray-500 mt-0.5">/{combo.slug}</p>
        </div>
        <div className="flex items-center gap-2">
          {published ? (
            <button
              type="button"
              onClick={() => setAction('unpublish')}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-amber-700 bg-white border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors"
            >
              <EyeOff size={16} />
              Unpublish
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setAction('publish')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1a7a4a] text-white text-sm font-medium rounded-lg hover:bg-[#145c37] transition-colors shadow-sm"
            >
              <Eye size={16} />
              Publish
            </button>
          )}
        </div>
      </div>

      <div className="max-w-5xl space-y-6">
        <form onSubmit={onSave} noValidate className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Details</h2>
          </div>
          <div className="p-6">
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
            {saveError && (
              <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 mt-5">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{saveError}</span>
              </div>
            )}
          </div>
          <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving || !dirty}
              className="px-5 py-2.5 bg-[#1a7a4a] text-white text-sm font-medium rounded-lg hover:bg-[#145c37] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {dirty && !saving && <span className="text-xs text-gray-500">You have unsaved changes.</span>}
          </div>
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
