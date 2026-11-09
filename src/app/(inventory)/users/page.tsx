'use client';

import { useEffect, useState, useCallback } from 'react';
import { Pencil, Trash2, Activity, X } from 'lucide-react';
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
import { useMediaQuery } from '@/components/storefront/useMediaQuery';
import ModalFrame from '@/components/users/ModalFrame';
import { ActionTag } from '@/components/activity/ActivityParts';
import LoadErrorPanel from '@/components/errors/LoadErrorPanel';
import ErrorNotice from '@/components/errors/ErrorNotice';
import { appErrorFromStaff } from '@/lib/errors/staff-adapter';
import type { AppError } from '@/lib/errors/app-error';

type ActiveTab = 'users' | 'performance';

const editUserSchema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  role: z.enum([UserRole.ADMIN, UserRole.STAFF]),
  isActive: z.boolean(),
});

type EditUserForm = z.infer<typeof editUserSchema>;

const TAB_LABEL: Record<ActiveTab, string> = { users: 'Users', performance: 'Performance' };

const btnBase =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a] disabled:cursor-not-allowed disabled:opacity-50';
const btnGray = `${btnBase} border-gray-300 bg-white text-gray-800 hover:bg-gray-50`;
const btnGreen = `${btnBase} border-[#b9e0c9] bg-white text-[#1a7a4a] hover:bg-[#e8f5ee]`;
const btnRed = `${btnBase} border-red-200 bg-white text-red-700 hover:bg-red-50`;
const iconBtn = 'inline-flex h-11 w-11 items-center justify-center rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a]';
const fieldCls = 'block min-h-12 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 outline-none focus:border-[#1a7a4a] focus:ring-2 focus:ring-[#1a7a4a]/20';
const pagerBtn = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40';

const badge = 'inline-block rounded-full border px-2.5 py-0.5 text-sm font-medium';
function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className={`${badge} capitalize ${role === UserRole.ADMIN ? 'border-[#b9e0c9] bg-[#e8f5ee] text-[#14693f]' : 'border-gray-200 bg-gray-100 text-gray-700'}`}>
      {role}
    </span>
  );
}
function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`${badge} ${active ? 'border-[#b9e0c9] bg-[#e8f5ee] text-[#14693f]' : 'border-red-200 bg-red-50 text-red-800'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}
const Loading = ({ label }: { label: string }) => (
  <div role="status" aria-label={label} className="flex justify-center rounded-2xl border border-gray-200 bg-white py-12">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#1a7a4a] border-t-transparent" />
  </div>
);
const Empty = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center text-base text-gray-600">{children}</div>
);

export default function UsersPage() {
  useAuthGuard(UserRole.ADMIN);
  const wide = useMediaQuery('(min-width: 1280px)');
  const roomy = useMediaQuery('(min-width: 1024px)');

  const searchParams = useSearchParams();
  const { users, total, page, limit, totalPages, isLoading, setUsers, setLoading, setPage } =
    useUsersStore();

  const [activeTab, setActiveTab] = useState<ActiveTab>(
    searchParams.get('tab') === 'performance' ? 'performance' : 'users'
  );
  // A failed request is its own state, never an empty list: these hold the error until a retry succeeds.
  const [usersError, setUsersError] = useState<AppError | null>(null);
  const [perfError, setPerfError] = useState<AppError | null>(null);
  const [activityError, setActivityError] = useState<AppError | null>(null);
  // Failures of Save / Delete are shown inside their dialog, which stays open with what was entered.
  const [editError, setEditError] = useState<AppError | null>(null);
  const [deleteError, setDeleteError] = useState<AppError | null>(null);
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
      setUsersError(null);
      const data = await usersService.getAll({ page, limit });
      setUsers(data.data, data.meta);
    } catch (err) {
      setUsersError(appErrorFromStaff(err, { method: 'GET', action: 'load', what: 'users' }));
    } finally {
      setLoading(false);
    }
  }, [page, limit, setUsers, setLoading]);

  const fetchPerformance = useCallback(async () => {
    try {
      setPerfLoading(true);
      setPerfError(null);
      const data = await usersService.getPerformance();
      setPerformance(data);
    } catch (err) {
      setPerfError(appErrorFromStaff(err, { method: 'GET', action: 'load', what: 'user performance' }));
    } finally {
      setPerfLoading(false);
    }
  }, []);

  const fetchActivityForUser = useCallback(async (userId: string, pg: number) => {
    try {
      setActivityLoading(true);
      setActivityError(null);
      const data = await dashboardService.getActivityByUser(userId, pg, 15);
      setActivityLogs(data.data);
      setActivityTotal(data.meta.total);
      setActivityTotalPages(data.meta.totalPages);
    } catch (err) {
      // Never show the previous page's events (or "No activity found") for a request that failed.
      setActivityLogs([]);
      setActivityError(appErrorFromStaff(err, { method: 'GET', action: 'load', what: 'this user\'s activity' }));
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
    setEditError(null);
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
      setEditError(null);
      await usersService.update(editUser.id, data);
      toast.success('User updated successfully');
      setEditUser(null);
      fetchUsers();
    } catch (error) {
      // The dialog stays open with the entered values and says what happened. Nothing is reported as saved.
      setEditError(appErrorFromStaff(error, { action: 'change', one: 'user' }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    try {
      setDeleting(true);
      setDeleteError(null);
      await usersService.delete(deleteUser.id);
      toast.success('User deleted');
      setDeleteUser(null);
      fetchUsers();
    } catch (error) {
      setDeleteError(appErrorFromStaff(error, { action: 'change', one: 'user' }));
    } finally {
      setDeleting(false);
    }
  };

  const lastLogin = (u: User) => (u.lastLoginAt ? format(new Date(u.lastLoginAt), 'MMM d, yyyy · h:mm a') : '—');
  const joined = (u: User) => format(new Date(u.createdAt), 'MMM d, yyyy');
  const name = (u: User) => `${u.firstName} ${u.lastName}`;
  const openActivity = (user: User) => {
    setActivityUser(user);
    setActivityPage(1);
    setActivityLogs([]);
    setActivityError(null);
  };
  const actions = (user: User, withText: boolean) => {
    const n = name(user);
    return (
      <>
        <button type="button" onClick={() => openActivity(user)} aria-label={`View activity for ${n}`} title="View activity"
          className={withText ? btnGray : `${iconBtn} border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}>
          <Activity size={18} aria-hidden="true" />
          {withText && 'View activity'}
        </button>
        <button type="button" onClick={() => openEdit(user)} aria-label={`Edit ${n}`} title="Edit"
          className={withText ? btnGreen : `${iconBtn} border-[#b9e0c9] bg-white text-[#1a7a4a] hover:bg-[#e8f5ee]`}>
          <Pencil size={18} aria-hidden="true" />
          {withText && 'Edit'}
        </button>
        <button type="button" onClick={() => { setDeleteError(null); setDeleteUser(user); }} aria-label={`Delete ${n}`} title="Delete"
          className={withText ? btnRed : `${iconBtn} border-red-200 bg-white text-red-700 hover:bg-red-50`}>
          <Trash2 size={18} aria-hidden="true" />
          {withText && 'Delete'}
        </button>
      </>
    );
  };

  const th = 'border-b border-gray-200 bg-gray-50 px-3 py-3 text-left text-sm font-semibold text-gray-700 first:rounded-tl-2xl first:pl-5 last:rounded-tr-2xl last:pr-5';
  const tabKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next: ActiveTab = activeTab === 'users' ? 'performance' : 'users';
    setActiveTab(next);
    document.getElementById(`tab-${next}`)?.focus();
  };

  return (
    <div className="mx-auto w-full max-w-[80rem]">
      <div className="mb-6">
        <h1 className="text-[1.75rem] font-bold leading-8 text-[#0f4f2d] md:text-[2rem] md:leading-10">Users</h1>
        <p className="mt-1 text-sm text-gray-600">Manage staff and admin accounts</p>
      </div>

      <div role="tablist" aria-label="Users sections" onKeyDown={tabKey} className="mb-4 flex gap-1 border-b border-gray-200">
        {(['users', 'performance'] as const).map((tab) => (
          <button
            key={tab}
            id={`tab-${tab}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`panel-${tab}`}
            tabIndex={activeTab === tab ? 0 : -1}
            onClick={() => setActiveTab(tab)}
            className={`-mb-px min-h-11 border-b-4 px-5 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#1a7a4a] ${
              activeTab === tab ? 'border-[#1a7a4a] text-[#0f4f2d]' : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {TAB_LABEL[tab]}
          </button>
        ))}
      </div>

      {activeTab === 'users' ? (
        <div role="tabpanel" id="panel-users" aria-labelledby="tab-users">
          {isLoading ? (
            <Loading label="Loading users" />
          ) : usersError ? (
            <LoadErrorPanel error={usersError} onRetry={() => void fetchUsers()} title="Could not load users" />
          ) : users.length === 0 ? (
            <Empty>No users found</Empty>
          ) : wide ? (
            <div className="rounded-2xl border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {['Name', 'Email', 'Role', 'Status', 'Last login', 'Joined', 'Actions'].map((h) => (
                      <th key={h} scope="col" className={`sticky top-14 z-[1] ${th}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="min-h-16 border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-3 py-3 pl-5 text-base font-semibold text-[#0f4f2d] [overflow-wrap:anywhere]">{name(user)}</td>
                      <td className="break-all px-3 py-3 text-sm text-gray-700">{user.email}</td>
                      <td className="px-3 py-3"><RoleBadge role={user.role} /></td>
                      <td className="px-3 py-3"><StatusBadge active={user.isActive} /></td>
                      <td className="px-3 py-3 text-sm text-gray-700">{lastLogin(user)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-700">{joined(user)}</td>
                      <td className="px-3 py-3 pr-5"><div className="flex gap-2">{actions(user, false)}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
              {users.map((user) => (
                <li key={user.id} className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4">
                  <p className="break-words text-base font-semibold text-[#0f4f2d]">{name(user)}</p>
                  <p className="break-all text-sm text-gray-700">{user.email}</p>
                  <p className="mt-2 flex flex-wrap gap-2">
                    <RoleBadge role={user.role} />
                    <StatusBadge active={user.isActive} />
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
                    <div className="min-w-0">
                      <dt className="text-sm text-gray-600">Last login</dt>
                      <dd className="break-words text-sm text-gray-900">{lastLogin(user)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-sm text-gray-600">Joined</dt>
                      <dd className="text-sm text-gray-900">{joined(user)}</dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">{actions(user, true)}</div>
                </li>
              ))}
            </ul>
          )}

          {totalPages > 1 && !usersError && (
            <div className="mt-4 grid grid-cols-2 items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-700 sm:flex sm:justify-between">
              <p className="order-1 col-span-2 sm:order-none">Showing {users.length} of {total} users</p>
              <div className="contents sm:flex sm:items-center sm:gap-3">
                <button type="button" onClick={() => setPage(page - 1)} disabled={page === 1} className={`order-3 sm:order-none ${pagerBtn}`}>Previous</button>
                <span className="order-2 text-right sm:order-none">{page} / {totalPages}</span>
                <button type="button" onClick={() => setPage(page + 1)} disabled={page === totalPages} className={`order-4 sm:order-none ${pagerBtn}`}>Next</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div role="tabpanel" id="panel-performance" aria-labelledby="tab-performance">
          {perfLoading ? (
            <Loading label="Loading performance" />
          ) : perfError ? (
            <LoadErrorPanel error={perfError} onRetry={() => void fetchPerformance()} title="Could not load performance" />
          ) : performance.length === 0 ? (
            <Empty>No performance data available</Empty>
          ) : roomy ? (
            <div className="rounded-2xl border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {['Name', 'Email', 'Total sales', 'Total revenue'].map((h) => (
                      <th key={h} scope="col" className={`sticky top-14 z-[1] ${th}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {performance.map((entry) => (
                    <tr key={entry.user_id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-3 py-3 pl-5 text-base font-semibold text-[#0f4f2d]">{entry.user_firstName} {entry.user_lastName}</td>
                      <td className="break-all px-3 py-3 text-sm text-gray-700">{entry.user_email}</td>
                      <td className="px-3 py-3 text-base">{entry.totalsales}</td>
                      <td className="px-3 py-3 pr-5 text-base font-semibold">₦{Number(entry.totalrevenue).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
              {performance.map((entry) => (
                <li key={entry.user_id} className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4">
                  <p className="break-words text-base font-semibold text-[#0f4f2d]">{entry.user_firstName} {entry.user_lastName}</p>
                  <p className="break-all text-sm text-gray-700">{entry.user_email}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
                    <div><dt className="text-sm text-gray-600">Total sales</dt><dd className="text-base text-gray-900">{entry.totalsales}</dd></div>
                    <div className="min-w-0"><dt className="text-sm text-gray-600">Total revenue</dt><dd className="break-words text-base font-semibold text-gray-900">₦{Number(entry.totalrevenue).toLocaleString()}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {deleteUser && (
        <ModalFrame labelledBy="delete-user-title" onClose={() => setDeleteUser(null)} canClose={!deleting} widthClass="max-w-sm">
          <h2 id="delete-user-title" className="mb-1 text-lg font-semibold text-gray-900">Delete User</h2>
          <p className="mb-5 text-base text-gray-700">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-gray-900">{deleteUser.firstName} {deleteUser.lastName}</span>
            ? This cannot be undone.
          </p>
          {deleteError && <div className="mb-4"><ErrorNotice error={deleteError} /></div>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setDeleteUser(null)} disabled={deleting} className={`${btnGray} min-h-12 text-base`}>Cancel</button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-red-700 px-5 text-base font-semibold text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting && <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </ModalFrame>
      )}

      {activityUser && (
        <ModalFrame
          labelledBy="user-activity-title"
          onClose={() => { setActivityUser(null); setActivityLogs([]); }}
          widthClass="max-w-4xl"
          column
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="user-activity-title" className="break-words text-lg font-semibold text-[#0f4f2d]">Activity — {activityUser.firstName} {activityUser.lastName}</h2>
              <p className="break-all text-sm text-gray-600">{activityUser.email}</p>
            </div>
            <button
              type="button"
              onClick={() => { setActivityUser(null); setActivityLogs([]); }}
              aria-label="Close activity"
              className={`${iconBtn} shrink-0 border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
            {activityLoading ? (
              <div role="status" aria-label="Loading activity" className="flex justify-center p-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-[#1a7a4a] border-t-transparent" /></div>
            ) : activityError ? (
              <LoadErrorPanel error={activityError} onRetry={() => activityUser && void fetchActivityForUser(activityUser.id, activityPage)} title="Could not load activity" />
            ) : activityLogs.length === 0 ? (
              <div className="p-8 text-center text-base text-gray-600">No activity found</div>
            ) : (
              <ul className="space-y-2">
                {activityLogs.map((log) => (
                  <li key={log.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 sm:grid-cols-[9rem_minmax(0,11rem)_minmax(0,1fr)] sm:gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{format(new Date(log.timestamp), 'MMM d, yyyy')}</p>
                      <p className="text-sm text-gray-600">{format(new Date(log.timestamp), 'h:mm a')}</p>
                    </div>
                    <div className="min-w-0"><ActionTag action={log.action ?? ''} /></div>
                    <p className="min-w-0 text-sm text-gray-800 [overflow-wrap:anywhere] sm:text-base">{log.description}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {activityTotalPages > 1 && !activityError && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
              <p className="text-sm text-gray-700">{activityTotal} total entries</p>
              <div className="flex items-center gap-3 text-sm">
                <button type="button" onClick={() => setActivityPage((p) => p - 1)} disabled={activityPage === 1 || activityLoading} className={pagerBtn}>Previous</button>
                <span>{activityPage} / {activityTotalPages}</span>
                <button type="button" onClick={() => setActivityPage((p) => p + 1)} disabled={activityPage === activityTotalPages || activityLoading} className={pagerBtn}>Next</button>
              </div>
            </div>
          )}
        </ModalFrame>
      )}

      {editUser && (
        <ModalFrame labelledBy="edit-user-title" onClose={() => setEditUser(null)} canClose={!submitting}>
          {submitting && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/80">
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#1a7a4a] border-t-transparent" />
                <span className="text-base font-medium">Saving...</span>
              </div>
            </div>
          )}
          <h2 id="edit-user-title" className="mb-1 text-xl font-semibold text-[#0f4f2d]">Edit User</h2>
          <p className="mb-5 break-all text-sm text-gray-600">{editUser.email}</p>

          <form onSubmit={handleSubmit(handleUpdate)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="edit-firstName" className="mb-1 block text-sm font-semibold text-gray-800">First Name</label>
                <input id="edit-firstName" {...register('firstName')} aria-invalid={!!errors.firstName} className={fieldCls} />
                {errors.firstName && <p role="alert" className="mt-1 text-sm font-medium text-red-700">{errors.firstName.message}</p>}
              </div>
              <div>
                <label htmlFor="edit-lastName" className="mb-1 block text-sm font-semibold text-gray-800">Last Name</label>
                <input id="edit-lastName" {...register('lastName')} aria-invalid={!!errors.lastName} className={fieldCls} />
                {errors.lastName && <p role="alert" className="mt-1 text-sm font-medium text-red-700">{errors.lastName.message}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="edit-role" className="mb-1 block text-sm font-semibold text-gray-800">Role</label>
              <select id="edit-role" {...register('role')} className={fieldCls}>
                <option value={UserRole.STAFF}>Staff</option>
                <option value={UserRole.ADMIN}>Admin</option>
              </select>
            </div>

            <label htmlFor="isActive" className="flex min-h-11 cursor-pointer items-center gap-3 text-base font-semibold text-gray-800">
              <input {...register('isActive')} type="checkbox" id="isActive" className="h-5 w-5 rounded border-gray-300 accent-[#1a7a4a]" />
              Active
            </label>

            {editError && <ErrorNotice error={editError} />}
            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setEditUser(null)} className={`${btnGray} min-h-12 text-base`}>Cancel</button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-12 items-center justify-center rounded-lg bg-[#1a7a4a] px-5 text-base font-semibold text-white transition-colors hover:bg-[#145c37] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save Changes
              </button>
            </div>
          </form>
        </ModalFrame>
      )}
    </div>
  );
}
