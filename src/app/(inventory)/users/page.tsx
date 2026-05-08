'use client';

import { useEffect, useState, useCallback } from 'react';
import { Pencil, Trash2, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useSearchParams } from 'next/navigation';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useUsersStore } from '@/store/users.store';
import { usersService } from '@/lib/services/users.service';
import { User, UserPerformance, UserRole, ActivityLog } from '@/types';
import { dashboardService } from '@/lib/services/dashboard.service';

type ActiveTab = 'users' | 'performance';

const editUserSchema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  role: z.enum([UserRole.ADMIN, UserRole.STAFF]),
  isActive: z.boolean(),
});

type EditUserForm = z.infer<typeof editUserSchema>;

export default function UsersPage() {
  useAuthGuard(UserRole.ADMIN);

  const searchParams = useSearchParams();
  const { users, total, page, limit, totalPages, isLoading, setUsers, setLoading, setPage } =
    useUsersStore();

  const [activeTab, setActiveTab] = useState<ActiveTab>(
    searchParams.get('tab') === 'performance' ? 'performance' : 'users'
  );
  const [performance, setPerformance] = useState<UserPerformance[]>([]);
  const [perfLoading, setPerfLoading] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [activityUser, setActivityUser] = useState<User | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityTotalPages, setActivityTotalPages] = useState(1);
  const [activityLoading, setActivityLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditUserForm>({ resolver: zodResolver(editUserSchema) });

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await usersService.getAll({ page, limit });
      setUsers(data.data, data.meta);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, limit, setUsers, setLoading]);

  const fetchPerformance = useCallback(async () => {
    try {
      setPerfLoading(true);
      const data = await usersService.getPerformance();
      setPerformance(data);
    } catch {
      toast.error('Failed to load performance data');
    } finally {
      setPerfLoading(false);
    }
  }, []);

  const fetchActivityForUser = useCallback(async (userId: string, pg: number) => {
    try {
      setActivityLoading(true);
      const data = await dashboardService.getActivityByUser(userId, pg, 15);
      setActivityLogs(data.data);
      setActivityTotal(data.meta.total);
      setActivityTotalPages(data.meta.totalPages);
    } catch {
      // fail silently
    } finally {
      setActivityLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activityUser) fetchActivityForUser(activityUser.id, activityPage);
  }, [activityUser, activityPage, fetchActivityForUser]);

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    else fetchPerformance();
  }, [activeTab, fetchUsers, fetchPerformance]);

  const openEdit = (user: User) => {
    setEditUser(user);
    reset({
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
    });
  };

  const handleUpdate = async (data: EditUserForm) => {
    if (!editUser) return;
    try {
      setSubmitting(true);
      await usersService.update(editUser.id, data);
      toast.success('User updated successfully');
      setEditUser(null);
      fetchUsers();
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string | string[] } } })
          .response?.data?.message || 'Failed to update user';
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    try {
      setDeleting(true);
      await usersService.delete(deleteUser.id);
      toast.success('User deleted');
      setDeleteUser(null);
      fetchUsers();
    } catch {
      toast.error('Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">Manage staff and admin accounts</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(['users', 'performance'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'users' ? (
        <>
          {/* Users table */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full min-w-175 text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {['Name', 'Email', 'Role', 'Status', 'Last Login', 'Joined', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center"><div className="flex justify-center"><div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div></td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No users found</td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{user.firstName} {user.lastName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                          user.role === UserRole.ADMIN
                            ? 'bg-purple-500/10 text-purple-600'
                            : 'bg-blue-500/10 text-blue-600'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          user.isActive
                            ? 'bg-green-500/10 text-green-600'
                            : 'bg-red-500/10 text-red-600'
                        }`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {user.lastLoginAt
                          ? format(new Date(user.lastLoginAt), 'MMM d, yyyy · h:mm a')
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {format(new Date(user.createdAt), 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setActivityUser(user); setActivityPage(1); setActivityLogs([]); }}
                            className="p-1.5 rounded-md bg-muted text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                            title="View activity"
                          >
                            <Activity size={13} />
                          </button>
                          <button
                            onClick={() => openEdit(user)}
                            className="p-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setDeleteUser(user)}
                            className="p-1.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {users.length} of {total} users
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-md border text-sm disabled:opacity-50 hover:bg-muted transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm">{page} / {totalPages}</span>
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
        </>
      ) : (
        /* Performance table */
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {['Name', 'Email', 'Total Sales', 'Total Revenue'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {perfLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center"><div className="flex justify-center"><div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div></td>
                </tr>
              ) : performance.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No performance data available</td>
                </tr>
              ) : (
                performance.map((entry) => (
                  <tr key={entry.user_id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{entry.user_firstName} {entry.user_lastName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{entry.user_email}</td>
                    <td className="px-4 py-3">{entry.totalsales}</td>
                    <td className="px-4 py-3">₦{Number(entry.totalrevenue).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl border p-6 w-full max-w-sm shadow-lg animate-in zoom-in-95 fade-in duration-500">
            <h2 className="text-base font-semibold mb-1">Delete User</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Are you sure you want to delete{' '}
              <span className="font-medium text-foreground">
                {deleteUser.firstName} {deleteUser.lastName}
              </span>
              ? This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteUser(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-md border text-sm hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 transition-colors"
              >
                {deleting && (
                  <div className="h-4 w-4 rounded-full border-2 border-destructive-foreground border-t-transparent animate-spin" />
                )}
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity modal */}
      {activityUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl border p-6 w-full max-w-6xl max-h-[85vh] flex flex-col animate-in zoom-in-95 fade-in duration-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold">Activity — {activityUser.firstName} {activityUser.lastName}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{activityUser.email}</p>
              </div>
              <button
                onClick={() => { setActivityUser(null); setActivityLogs([]); }}
                className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
              >
                ✕
              </button>
            </div>

            <div
              className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-1"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'hsl(var(--border)) transparent' }}
            >
              {activityLoading ? (
                <div className="p-8 flex justify-center"><div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
              ) : activityLogs.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No activity found</div>
              ) : (
                <div className="space-y-2 py-1">
                  {activityLogs.map((log) => {
                    const action = log.action ?? '';
                    const badgeClass = action.includes('LOGIN') || action.includes('LOGOUT')
                      ? 'bg-slate-500/10 text-slate-600 dark:text-slate-400'
                      : action.includes('SALE')
                      ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                      : action.includes('CREDIT')
                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                      : action.includes('COLLECTION')
                      ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
                      : action.includes('DELETE') || action.includes('VOID')
                      ? 'bg-red-500/10 text-red-700 dark:text-red-400'
                      : 'bg-muted text-muted-foreground';

                    return (
                      <div
                        key={log.id}
                        className="flex items-start gap-4 rounded-lg border bg-background px-4 py-3 hover:bg-primary/5 hover:border-primary/20 hover:scale-[1.005] transition-all duration-150 cursor-default"
                      >
                        {/* Timestamp */}
                        <div className="shrink-0 w-28 pt-0.5">
                          <p className="text-xs font-medium text-foreground">
                            {format(new Date(log.timestamp), 'MMM d, yyyy')}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(log.timestamp), 'h:mm a')}
                          </p>
                        </div>

                        {/* Badge */}
                        <div className="shrink-0 w-36 pt-0.5">
                          <span className={`inline-block px-1.5 py-0.5 rounded-md text-[10px] font-semibold leading-tight tracking-wide uppercase ${badgeClass}`}>
                            {action.replace(/_/g, ' ')}
                          </span>
                        </div>

                        {/* Description */}
                        <p className="flex-1 text-sm text-muted-foreground leading-relaxed">{log.description}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {activityTotalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground">{activityTotal} total entries</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActivityPage((p) => p - 1)}
                    disabled={activityPage === 1 || activityLoading}
                    className="px-3 py-1.5 rounded-md border text-xs disabled:opacity-50 hover:bg-muted transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-xs">{activityPage} / {activityTotalPages}</span>
                  <button
                    onClick={() => setActivityPage((p) => p + 1)}
                    disabled={activityPage === activityTotalPages || activityLoading}
                    className="px-3 py-1.5 rounded-md border text-xs disabled:opacity-50 hover:bg-muted transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="relative bg-card rounded-xl border p-6 w-full max-w-md animate-in zoom-in-95 fade-in duration-500">
            {submitting && (
              <div className="absolute inset-0 bg-card/80 rounded-xl flex items-center justify-center z-10">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <span className="text-sm font-medium">Saving...</span>
                </div>
              </div>
            )}
            <h2 className="text-lg font-semibold mb-1">Edit User</h2>
            <p className="text-sm text-muted-foreground mb-5">{editUser.email}</p>

            <form onSubmit={handleSubmit(handleUpdate)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">First Name</label>
                  <input
                    {...register('firstName')}
                    className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {errors.firstName && (
                    <p className="text-xs text-destructive">{errors.firstName.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Last Name</label>
                  <input
                    {...register('lastName')}
                    className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {errors.lastName && (
                    <p className="text-xs text-destructive">{errors.lastName.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Role</label>
                <select
                  {...register('role')}
                  className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value={UserRole.STAFF}>Staff</option>
                  <option value={UserRole.ADMIN}>Admin</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <input
                  {...register('isActive')}
                  type="checkbox"
                  id="isActive"
                  className="h-4 w-4 rounded border"
                />
                <label htmlFor="isActive" className="text-sm font-medium">Active</label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="px-4 py-2 rounded-md border text-sm hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
