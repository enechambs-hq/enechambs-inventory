'use client';

import { Trash2 } from 'lucide-react';
import { Supplier } from '@/types';

interface DeleteState {
  open: boolean;
  supplier: Supplier | null;
}

function DeleteDialog({
  deleteState,
  onClose,
  onConfirm,
  isDeleting,
}: {
  deleteState: DeleteState;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
}) {
  if (!deleteState.open || !deleteState.supplier) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <Trash2 size={20} className="text-red-500" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Delete supplier</h3>
        <p className="text-sm text-gray-500 mb-6">
          Are you sure you want to delete{' '}
          <span className="font-medium text-gray-700">
            &ldquo;{deleteState.supplier.name}&rdquo;
          </span>
          ? This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteDialog;
