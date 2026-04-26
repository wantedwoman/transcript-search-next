'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  status: string;
  created_at: string;
  last_active: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(userId: string) {
    if (!confirm('Are you sure you want to revoke this user\'s access?')) return;
    try {
      setActionLoading(userId);
      const res = await fetch('/api/admin/users/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error('Failed to revoke user');
      setUsers((prev) =>
        prev.map((u) => (u.user_id === userId ? { ...u, status: 'revoked' } : u))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke user');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRestore(userId: string) {
    try {
      setActionLoading(userId);
      const res = await fetch('/api/admin/users/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error('Failed to restore user');
      setUsers((prev) =>
        prev.map((u) => (u.user_id === userId ? { ...u, status: 'active' } : u))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore user');
    } finally {
      setActionLoading(null);
    }
  }

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#171117] text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-[#ecbaba] hover:text-white transition-colors">
              <span className="material-symbols-outlined text-2xl">arrow_back</span>
            </Link>
            <h1 className="text-2xl font-bold italic text-[#FF7095]">User Management</h1>
          </div>
          <button
            onClick={fetchUsers}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm transition-colors"
          >
            Refresh
          </button>
        </div>
      </header>

      {/* Search */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
            search
          </span>
          <input
            type="text"
            placeholder="Search by email or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF7095]/50 transition-colors"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="max-w-6xl mx-auto px-6 mb-4">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="max-w-6xl mx-auto px-6 pb-12">
        {loading ? (
          <div className="text-center py-16 text-white/50">Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-16 text-white/50">
            {searchQuery ? 'No users match your search' : 'No users found'}
          </div>
        ) : (
          <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-6 py-4 text-sm font-semibold text-white/50 uppercase tracking-wider">Email</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-white/50 uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-white/50 uppercase tracking-wider">Created</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-white/50 uppercase tracking-wider">Last Active</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-white/50 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/insights/${user.user_id}`}
                        className="text-[#FF7095] hover:underline"
                      >
                        {user.email}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                          user.status === 'active'
                            ? 'bg-green-500/20 text-green-400'
                            : user.status === 'revoked'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-white/60">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-white/60">
                      {new Date(user.last_active).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {actionLoading === user.user_id ? (
                        <span className="text-white/30 text-sm">Working...</span>
                      ) : user.status === 'active' ? (
                        <button
                          onClick={() => handleRevoke(user.user_id)}
                          className="px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm transition-colors"
                        >
                          Revoke
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRestore(user.user_id)}
                          className="px-4 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 text-sm transition-colors"
                        >
                          Restore
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 text-sm text-white/30 text-center">
          {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}