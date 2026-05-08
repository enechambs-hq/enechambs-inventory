'use client';

import { Supplier } from '@/types';
import { useEffect, useState } from 'react';

interface ModalState {
  open: boolean;
  mode: 'add' | 'edit';
  supplier: Supplier | null;
}

export interface SupplierFormData {
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

const DEFAULT_FORM: SupplierFormData = {
  name: '',
  contactName: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
};

function SupplierModal({
  modal,
  onClose,
  onSave,
  isSaving,
}: {
  modal: ModalState;
  onClose: () => void;
  onSave: (data: SupplierFormData) => Promise<void>;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<SupplierFormData>(DEFAULT_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof SupplierFormData, string>>>({});

  useEffect(() => {
    if (modal.open) {
      if (modal.mode === 'edit' && modal.supplier) {
        setForm({
          name: modal.supplier.name,
          contactName: modal.supplier.contactName ?? '',
          phone: modal.supplier.phone ?? '',
          email: modal.supplier.email ?? '',
          address: modal.supplier.address ?? '',
          notes: modal.supplier.notes ?? '',
        });
      } else {
        setForm(DEFAULT_FORM);
      }
      setErrors({});
    }
  }, [modal]);

  const validate = (): boolean => {
    const e: Partial<Record<keyof SupplierFormData, string>> = {};
    if (!form.name.trim()) e.name = 'Supplier name is required';
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
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {modal.mode === 'add' ? 'Add Supplier' : 'Edit Supplier'}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {modal.mode === 'add' ? 'Add a new product supplier' : 'Update supplier details'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[72vh] overflow-y-auto">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Supplier name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Lagos Fresh Farms"
              className={`w-full px-3.5 py-2.5 text-sm border rounded-lg outline-none transition-colors ${
                errors.name
                  ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-200'
                  : 'border-gray-200 focus:border-[#1a7a4a] focus:ring-1 focus:ring-[#1a7a4a]/20'
              }`}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          {/* Contact Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Contact name <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={form.contactName}
              onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
              placeholder="e.g. Emeka Okafor"
              className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#1a7a4a] focus:ring-1 focus:ring-[#1a7a4a]/20 transition-colors"
            />
          </div>

          {/* Phone & Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Phone <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="e.g. 08012345678"
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#1a7a4a] focus:ring-1 focus:ring-[#1a7a4a]/20 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="supplier@email.com"
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#1a7a4a] focus:ring-1 focus:ring-[#1a7a4a]/20 transition-colors"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Address <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="e.g. 12 Market Road, Lagos"
              className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#1a7a4a] focus:ring-1 focus:ring-[#1a7a4a]/20 transition-colors"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Any additional notes about this supplier..."
              rows={3}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg outline-none resize-none focus:border-[#1a7a4a] focus:ring-1 focus:ring-[#1a7a4a]/20 transition-colors"
            />
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
              {isSaving ? 'Saving...' : modal.mode === 'add' ? 'Add Supplier' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SupplierModal;
