"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Search, Pencil, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";
import { categoriesService } from "@/lib/services/categories.service";
import { Category } from "@/types";
import SkeletonRow from "@/components/shared/SkeletonRow";
import EmptyState from "@/components/categories/EmptyState";
import CategoryModal from "@/components/categories/CategoryModal";
import ConfirmDialog from "@/components/shared/ConfirmDialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModalState {
  open: boolean;
  mode: "add" | "edit";
  category: Category | null;
}

interface DeleteState {
  open: boolean;
  category: Category | null;
}

interface FormData {
  name: string;
  description: string;
  isActive: boolean;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalState>({
    open: false,
    mode: "add",
    category: null,
  });
  const [deleteState, setDeleteState] = useState<DeleteState>({
    open: false,
    category: null,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await categoriesService.getAll();
      setCategories(data);
    } catch {
      // fail silently — empty state handles this
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );

  const openAdd = () => setModal({ open: true, mode: "add", category: null });
  const openEdit = (cat: Category) =>
    setModal({ open: true, mode: "edit", category: cat });
  const closeModal = () =>
    setModal({ open: false, mode: "add", category: null });
  const openDelete = (cat: Category) =>
    setDeleteState({ open: true, category: cat });
  const closeDelete = () => setDeleteState({ open: false, category: null });

  const handleSave = async (form: FormData) => {
    setIsSaving(true);
    try {
      if (modal.mode === "add") {
        await categoriesService.create({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          isActive: form.isActive,
        });
        toast.success("Category added successfully");
      } else if (modal.category) {
        await categoriesService.update(modal.category.id, {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          isActive: form.isActive,
        });
        toast.success("Category updated successfully");
      }
      closeModal();
      await fetchCategories();
    } catch {
      toast.error(
        modal.mode === "add"
          ? "Failed to add category"
          : "Failed to update category",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteState.category) return;
    setIsDeleting(true);
    try {
      await categoriesService.remove(deleteState.category.id);
      toast.success("Category deleted");
      closeDelete();
      await fetchCategories();
    } catch {
      toast.error("Failed to delete category");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleQuickAdd = async (name: string) => {
    try {
      await categoriesService.create({ name });
      toast.success(`"${name}" added`);
      await fetchCategories();
    } catch {
      toast.error("Failed to add category");
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  return (
    <>
      <div className="min-h-screen bg-[#f0f2f0] p-6">
        {/* Page Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Manage your product categories
            </p>
          </div>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1a7a4a] text-white text-sm font-medium rounded-lg hover:bg-[#145c37] transition-colors shadow-sm"
          >
            <Plus size={16} />
            Add Category
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
                placeholder="Search categories..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#1a7a4a] focus:ring-1 focus:ring-[#1a7a4a]/20 transition-colors"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {[
                    "Name",
                    "Description",
                    "Status",
                    "Date Created",
                    "Actions",
                  ].map((h, i) => (
                    <th
                      key={h}
                      className={`px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide ${
                        i === 4 ? "text-right" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonRow key={i} widths={[200, 300, 80, 120, 80]} />
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      {search ? (
                        <div className="py-16 text-center">
                          <p className="text-sm text-gray-500">
                            No categories match &ldquo;
                            <span className="font-medium">{search}</span>&rdquo;
                          </p>
                          <button
                            onClick={() => setSearch("")}
                            className="text-sm text-[#1a7a4a] mt-1 hover:underline"
                          >
                            Clear search
                          </button>
                        </div>
                      ) : (
                        <EmptyState
                          onAdd={openAdd}
                          onQuickAdd={handleQuickAdd}
                        />
                      )}
                    </td>
                  </tr>
                ) : (
                  filtered.map((cat) => (
                    <tr
                      key={cat.id}
                      className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-[#e8f5ee] flex items-center justify-center flex-shrink-0">
                            <Tag size={13} className="text-[#1a7a4a]" />
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {cat.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-500">
                          {cat.description || (
                            <span className="text-gray-300 italic">—</span>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            cat.isActive
                              ? "bg-[#e8f5ee] text-[#1a7a4a]"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {cat.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-500">
                          {formatDate(cat.createdAt)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(cat)}
                            className="p-2 text-gray-400 hover:text-[#1a7a4a] hover:bg-[#e8f5ee] rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => openDelete(cat)}
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
                Showing{" "}
                <span className="font-medium text-gray-600">
                  {filtered.length}
                </span>{" "}
                of{" "}
                <span className="font-medium text-gray-600">
                  {categories.length}
                </span>{" "}
                categories
              </p>
            </div>
          )}
        </div>
      </div>

      <CategoryModal
        modal={modal}
        onClose={closeModal}
        onSave={handleSave}
        isSaving={isSaving}
      />
      <ConfirmDialog
        open={deleteState.open}
        itemName={deleteState.category?.name ?? null}
        entityLabel="category"
        onClose={closeDelete}
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />
    </>
  );
}
