'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Pencil, Trash2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { suppliersService } from '@/lib/services/suppliers.service';
import { Supplier } from '@/types';
import SkeletonRow from '@/components/shared/SkeletonRow';
import EmptyState from '@/components/suppliers/EmptyState';
import SupplierModal, { SupplierFormData } from '@/components/suppliers/SupplierModal';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModalState {
  open: boolean;
  mode: 'add' | 'edit';
  supplier: Supplier | null;
}

interface DeleteState {
  open: boolean;
  supplier: Supplier | null;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<ModalState>({ open: false, mode: 'add', supplier: null });
  const [deleteState, setDeleteState] = useState<DeleteState>({ open: false, supplier: null });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchSuppliers = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await suppliersService.getAll();
      setSuppliers(data);
    } catch {
      // fail silently
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const filtered = suppliers.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  const openAdd = () => setModal({ open: true, mode: 'add', supplier: null });
  const openEdit = (s: Supplier) => setModal({ open: true, mode: 'edit', supplier: s });
  const closeModal = () => setModal({ open: false, mode: 'add', supplier: null });
  const openDelete = (s: Supplier) => setDeleteState({ open: true, supplier: s });
  const closeDelete = () => setDeleteState({ open: false, supplier: null });

  const handleSave = async (form: SupplierFormData) => {
    setIsSaving(true);
    try {
      if (modal.mode === 'add') {
        await suppliersService.create({
          name: form.name.trim(),
          contactName: form.contactName.trim() || undefined,
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          address: form.address.trim() || undefined,
          notes: form.notes.trim() || undefined,
        });
        toast.success('Supplier added successfully');
      } else if (modal.supplier) {
        await suppliersService.update(modal.supplier.id, {
          name: form.name.trim(),
          contactName: form.contactName.trim() || undefined,
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          address: form.address.trim() || undefined,
          notes: form.notes.trim() || undefined,
        });
        toast.success('Supplier updated successfully');
      }
      closeModal();
      await fetchSuppliers();
    } catch {
      toast.error(modal.mode === 'add' ? 'Failed to add supplier' : 'Failed to update supplier');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteState.supplier) return;
    setIsDeleting(true);
    try {
      await suppliersService.remove(deleteState.supplier.id);
      toast.success('Supplier deleted');
      closeDelete();
      await fetchSuppliers();
    } catch {
      toast.error('Failed to delete supplier');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-[#f0f2f0] p-6">
        {/* Page Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage your product suppliers</p>
          </div>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1a7a4a] text-white text-sm font-medium rounded-lg hover:bg-[#145c37] transition-colors shadow-sm"
          >
            <Plus size={16} />
            Add Supplier
          </button>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Search bar */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="relative max-w-sm">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search suppliers..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#1a7a4a] focus:ring-1 focus:ring-[#1a7a4a]/20 transition-colors"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {['Supplier Name', 'Contact Name', 'Phone', 'Email', 'Address', 'Actions'].map(
                    (h, i) => (
                      <th
                        key={h}
                        className={`px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide ${
                          i === 5 ? 'text-right' : 'text-left'
                        }`}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} widths={[200, 160, 120, 200, 220, 80]} />)
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      {search ? (
                        <div className="py-16 text-center">
                          <p className="text-sm text-gray-500">
                            No suppliers match &ldquo;
                            <span className="font-medium">{search}</span>&rdquo;
                          </p>
                          <button
                            onClick={() => setSearch('')}
                            className="text-sm text-[#1a7a4a] mt-1 hover:underline"
                          >
                            Clear search
                          </button>
                        </div>
                      ) : (
                        <EmptyState onAdd={openAdd} />
                      )}
                    </td>
                  </tr>
                ) : (
                  filtered.map((supplier) => (
                    <tr
                      key={supplier.id}
                      className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-[#e8f5ee] flex items-center justify-center shrink-0">
                            <Truck size={13} className="text-[#1a7a4a]" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{supplier.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">
                          {supplier.contactName ?? (
                            <span className="text-gray-300 italic">—</span>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">
                          {supplier.phone ?? <span className="text-gray-300 italic">—</span>}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">
                          {supplier.email ?? <span className="text-gray-300 italic">—</span>}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">
                          {supplier.address ?? <span className="text-gray-300 italic">—</span>}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(supplier)}
                            className="p-2 text-gray-400 hover:text-[#1a7a4a] hover:bg-[#e8f5ee] rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => openDelete(supplier)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer count */}
          {!isLoading && filtered.length > 0 && (
            <div className="px-6 py-3.5 border-t border-gray-100 bg-gray-50/40">
              <p className="text-xs text-gray-400">
                Showing <span className="font-medium text-gray-600">{filtered.length}</span> of{' '}
                <span className="font-medium text-gray-600">{suppliers.length}</span> suppliers
              </p>
            </div>
          )}
        </div>
      </div>

      <SupplierModal modal={modal} onClose={closeModal} onSave={handleSave} isSaving={isSaving} />
      <ConfirmDialog
        open={deleteState.open}
        itemName={deleteState.supplier?.name ?? null}
        entityLabel="supplier"
        onClose={closeDelete}
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />
    </>
  );
}
