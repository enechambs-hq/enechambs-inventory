'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import AdminOnly from '@/components/promotions/AdminOnly';
import ComboForm, { FormActionBar, ValidationSummary, focusFirstInvalid, hasFieldErrors } from '@/components/promotions/ComboForm';
import { combosService } from '@/lib/services/combos.service';
import { describeApiError, explainProblem } from '@/lib/combos/errors';
import { emptyComboForm, validateCreate, type ComboFieldErrors, type ComboFormValues } from '@/lib/combos/form';

function NewCombo() {
  const router = useRouter();
  const [values, setValues] = useState<ComboFormValues>(emptyComboForm());
  const [errors, setErrors] = useState<ComboFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const result = validateCreate(values);
    if (!result.ok) {
      setErrors(result.errors);
      focusFirstInvalid(result.errors, values);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const combo = await combosService.create(result.payload);
      toast.success('Combo created as a draft. Add images, then publish it.');
      router.push(`/promotions/combos/${combo.id}`);
    } catch (error) {
      setSubmitError(explainProblem(describeApiError(error), 'save'));
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[45rem]">
      <Link
        href="/promotions/combos"
        className="mb-2 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-gray-700 hover:text-[#1a7a4a]"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        All combos
      </Link>
      <div className="mb-6">
        <h1 className="text-[1.75rem] font-bold leading-8 text-[#0f4f2d] md:text-[2rem] md:leading-10">New combo</h1>
        <p className="mt-1 text-sm text-gray-600">It starts as a draft. Nothing is visible to customers until you publish it.</p>
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <ComboForm
          mode="create"
          values={values}
          errors={errors}
          disabled={saving}
          onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
        />

        <section aria-labelledby="section-images" className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
          <h2 id="section-images" className="mb-2 text-lg font-semibold text-[#0f4f2d]">
            Images
          </h2>
          <p className="text-base text-gray-700">You can add images once the draft is created, on the next screen.</p>
        </section>

        {(hasFieldErrors(errors) || submitError) && (
          <div className="space-y-3">
            <ValidationSummary errors={errors} />
            {submitError && (
              <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-base text-red-800">
                <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{submitError}</span>
              </div>
            )}
          </div>
        )}

        <FormActionBar>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-lg bg-[#1a7a4a] px-5 text-base font-semibold text-white transition-colors hover:bg-[#145c37] disabled:cursor-not-allowed disabled:opacity-60 md:flex-none"
            >
              {saving ? 'Creating…' : 'Create combo'}
            </button>
            <Link
              href="/promotions/combos"
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-gray-300 bg-white px-5 text-base font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Link>
          </div>
        </FormActionBar>
      </form>
    </div>
  );
}

export default function NewComboPage() {
  return (
    <AdminOnly>
      <NewCombo />
    </AdminOnly>
  );
}
