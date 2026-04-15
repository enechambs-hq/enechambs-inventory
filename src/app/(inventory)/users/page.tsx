'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useUsersStore } from '@/store/users.store';
import { usersService } from '@/lib/services/users.service';
import { UserRole } from '@/types';

export default function UsersPage() {
  useAuthGuard(UserRole.ADMIN);

  const { users, total, page, limit, totalPages, isLoading, setUsers, setLoading, setPage } =
    useUsersStore();

  const [search, setSearch] = useState('');

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await usersService.getAll({ page, limit, search });
      setUsers(data.data, data.meta);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, setUsers, setLoading]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">Manage staff and admin accounts</p>
      </div>

      {/* Search */}
      <div className="relative w-72">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-8 pr-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {['Name', 'Email', 'Role', 'Status', 'Last Login', 'Joined'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No users found
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    {user.firstName} {user.lastName}
                  </td>
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
                  <td className="px-4 py-3 text-muted-foreground">
                    {user.lastLoginAt
                      ? format(new Date(user.lastLoginAt), 'MMM d, yyyy · h:mm a')
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {format(new Date(user.createdAt), 'MMM d, yyyy')}
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
    </div>
  );
}
