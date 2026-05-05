'use client';
import { Category } from '@/types';
import { useEffect, useState } from 'react';
interface ModalState {
  open: boolean;
  mode: 'add' | 'edit';
  category: Category | null;
}

interface FormData {
  name: string;
  description: string;
  isActive: boolean;
}

const DEFAULT_FORM: FormData = { name: '', description: '', isActive: true };

function CategoryModal({
  modal,
  onClose,
  onSave,
  isSaving,
}: {
  modal: ModalState;
  onClose: () => void;
  onSave: (data: FormData) => Promise<void>;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  useEffect(() => {
    if (modal.open) {
      if (modal.mode === 'edit' && modal.category) {
        setForm({
          name: modal.category.name,
          description: modal.category.description ?? '',
          isActive: modal.category.isActive,
        });
      } else {
        setForm(DEFAULT_FORM);
      }
      setErrors({});
    }
  }, [modal]);

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.name.trim()) e.name = 'Category name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSave(form);
  };

  if (!modal.open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {modal.mode === 'add' ? 'Add Category' : 'Edit Category'}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {modal.mode === 'add' ? 'Create a new product category' : 'Update category details'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Category name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Grains & Cereals"
              className={`w-full px-3.5 py-2.5 text-sm border rounded-lg outline-none transition-colors ${
                errors.name
                  ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-200'
                  : 'border-gray-200 focus:border-[#1a7a4a] focus:ring-1 focus:ring-[#1a7a4a]/20'
              }`}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Brief description of this category..."
              rows={3}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg outline-none resize-none focus:border-[#1a7a4a] focus:ring-1 focus:ring-[#1a7a4a]/20 transition-colors"
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium text-gray-700">Active</p>
              <p className="text-xs text-gray-500">
                Inactive categories won&apos;t appear in product forms
              </p>
            </div>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                form.isActive ? 'bg-[#1a7a4a]' : 'bg-gray-200'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                  form.isActive ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-[#1a7a4a] rounded-lg hover:bg-[#145c37] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? 'Saving...' : modal.mode === 'add' ? 'Add Category' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CategoryModal;
