'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, Info } from 'lucide-react';
import { toast } from 'sonner';
import AdminOnly from '@/components/promotions/AdminOnly';
import ComboForm from '@/components/promotions/ComboForm';
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
    <div className="min-h-screen bg-[#f0f2f0] p-6">
      <Link
        href="/promotions/combos"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4"
      >
        <ArrowLeft size={14} />
        All combos
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">New combo</h1>
        <p className="text-sm text-gray-500 mt-0.5">It starts as a draft. Nothing is visible to customers until you publish it.</p>
      </div>

      <form onSubmit={onSubmit} noValidate className="max-w-3xl space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <ComboForm
            mode="create"
            values={values}
            errors={errors}
            disabled={saving}
            onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
          />
        </div>

        <div className="flex gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3.5 py-3 text-sm text-blue-800">
          <Info size={16} className="shrink-0 mt-0.5" />
          <span>You can add images once the draft is created, on the next screen.</span>
        </div>

        {submitError && (
          <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-[#1a7a4a] text-white text-sm font-medium rounded-lg hover:bg-[#145c37] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Creating…' : 'Create combo'}
          </button>
          <Link
            href="/promotions/combos"
            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
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
