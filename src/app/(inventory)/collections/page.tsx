'use client';

import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useCollectionsStore } from '@/store/collections.store';
import { collectionsService } from '@/lib/services/collections.service';
import { CreateCollectionDto, CollectionStatus, CollectionsStats } from '@/types';
import CollectionForm from '@/components/shared/CollectionForm';
import CollectionsStatsCards from '@/components/dashboard/CollectionsStats';
import { dashboardService } from '@/lib/services/dashboard.service';

export default function CollectionsPage() {
  const {
    collections,
    total,
    page,
    limit,
    totalPages,
    isLoading,
    setCollections,
    setLoading,
    setPage,
  } = useCollectionsStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [collectionsStats, setCollectionsStats] = useState<CollectionsStats | null>(null);

  // Animated placeholder
  const PLACEHOLDERS = ['product name...', 'collector name...'];
  const [phIndex, setPhIndex] = useState(0);
  const [phVisible, setPhVisible] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setPhVisible(false);
      setTimeout(() => {
        setPhIndex((i) => (i + 1) % PLACEHOLDERS.length);
        setPhVisible(true);
      }, 300);
    }, 3000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [voidModal, setVoidModal] = useState<{ id: string; status: CollectionStatus; current: CollectionStatus } | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const fetchCollections = useCallback(async () => {
    try {
      setLoading(true);
      const data = await collectionsService.getAll({
        page,
        limit,
        productName: searchQuery,
        collectorName: searchQuery,
      });
      setCollections(data.data, data.meta);
    } catch {
      toast.error('Failed to load collections');
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchQuery, setCollections, setLoading]);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  useEffect(() => {
    dashboardService.getCollectionsStats().then(setCollectionsStats).catch(() => {});
  }, []);

  const handleSubmit = async (data: CreateCollectionDto) => {
    try {
      setSubmitting(true);
      await collectionsService.create(data);
      toast.success('Collection recorded successfully');
      setModalOpen(false);
      fetchCollections();
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string | string[] } } })
          .response?.data?.message || 'Something went wrong';
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = (id: string, status: CollectionStatus, current: CollectionStatus) => {
    if (current === status) {
      toast.error(`Status is already set to ${status}`);
      return;
    }
    if (status === CollectionStatus.RETURNED) {
      setVoidReason('');
      setVoidModal({ id, status, current });
      return;
    }
    commitStatusUpdate(id, status);
  };

  const commitStatusUpdate = async (id: string, status: CollectionStatus, reason?: string) => {
    try {
      setUpdatingId(id);
      await collectionsService.updateStatus(id, status, reason);
      toast.success('Status updated successfully');
      fetchCollections();
      setVoidModal(null);
      setVoidReason('');
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusStyle = (status: CollectionStatus) => {
    switch (status) {
      case CollectionStatus.PAID:
        return 'bg-green-500/10 text-green-600';
      case CollectionStatus.RETURNED:
        return 'bg-blue-500/10 text-blue-600';
      case CollectionStatus.PENDING:
        return 'bg-yellow-500/10 text-yellow-600';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Collections</h1>
          <p className="text-sm text-muted-foreground">
            Track credit collections and returns
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          Record Collection
        </button>
      </div>

      {collectionsStats && <CollectionsStatsCards stats={collectionsStats} />}

      <hr className="border-border my-6" />

      {/* Search filters */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
        {!searchQuery && (
          <span className="absolute left-8 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none select-none flex items-center gap-1">
            Search by{' '}
            <span className={`transition-opacity duration-300 ${phVisible ? 'opacity-100' : 'opacity-0'}`}>
              {PLACEHOLDERS[phIndex]}
            </span>
          </span>
        )}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
          className="w-full pl-8 pr-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-transparent"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {[
                'Date',
                'Product',
                'IMEI',
                'Collector',
                'Storage',
                'Color',
                'Amount',
                'Status',
                'Actions',
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-medium text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Loading...
                </td>
              </tr>
            ) : collections.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No collections found
                </td>
              </tr>
            ) : (
              collections.map((collection) => (
                <tr
                  key={collection.id}
                  className="hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3">{format(new Date(collection.date), 'MMM d, yyyy')}</td>
                  <td className="px-4 py-3 font-medium">
                    {collection.productName}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {collection.imei}
                  </td>
                  <td className="px-4 py-3">{collection.collectorName}</td>
                  <td className="px-4 py-3">{collection.storageGB}</td>
                  <td className="px-4 py-3">{collection.color}</td>
                  <td className="px-4 py-3">
                    ₦{collection.amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusStyle(
                        collection.status
                      )}`}
                    >
                      {collection.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                    {updatingId === collection.id && (
                      <div className="h-3.5 w-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
                    )}
                    <select
                      value=""
                      disabled={updatingId === collection.id || collection.status === CollectionStatus.PAID || collection.status === CollectionStatus.RETURNED}
                      onChange={(e) =>
                        handleStatusUpdate(
                          collection.id,
                          e.target.value as CollectionStatus,
                          collection.status,
                        )
                      }
                      className={`text-xs rounded-md border bg-background px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 ${
                        (collection.status === CollectionStatus.PAID || collection.status === CollectionStatus.RETURNED) ? 'cursor-not-allowed' : ''
                      }`}
                    >
                      <option value="" disabled>
                        {collection.status ? collection.status.charAt(0).toUpperCase() + collection.status.slice(1) : 'Set status'}
                      </option>
                      <option value={CollectionStatus.PAID}>Paid</option>
                      <option value={CollectionStatus.RETURNED}>
                        Returned
                      </option>
                    </select>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {collections.length} of {total} collections
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-md border text-sm disabled:opacity-50 hover:bg-muted transition-colors"
            >
              Previous
            </button>
            <span className="text-sm">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-md border text-sm disabled:opacity-50 hover:bg-muted transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="relative bg-card rounded-xl border p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {submitting && (
              <div className="absolute inset-0 bg-card/80 rounded-xl flex items-center justify-center z-10">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <span className="text-sm font-medium">Recording collection...</span>
                </div>
              </div>
            )}
            <h2 className="text-lg font-semibold mb-4">
              Record New Collection
            </h2>
            <CollectionForm
              onSubmit={handleSubmit}
              isLoading={submitting}
              onCancel={() => setModalOpen(false)}
            />
          </div>
        </div>
      )}
      {/* Void reason modal (RETURNED status) */}
      {voidModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl border p-6 w-full max-w-sm shadow-lg">
            <h2 className="text-base font-semibold mb-1">Mark as Returned</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Provide an optional reason for returning this item.
            </p>
            <textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Reason (optional)…"
              rows={3}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setVoidModal(null)}
                disabled={updatingId === voidModal.id}
                className="px-4 py-2 rounded-md border text-sm hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => commitStatusUpdate(voidModal.id, voidModal.status, voidReason || undefined)}
                disabled={updatingId === voidModal.id}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {updatingId === voidModal.id && (
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                )}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}