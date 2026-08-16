'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Referral = {
  id: string;
  referrerEmail: string;
  referredEmail: string;
  status: 'pending' | 'released' | 'paid';
  createdAt: string;
  releasedAt: string | null;
  credit: number | null;
};

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-300',
    released: 'bg-blue-500/20 text-blue-300',
    paid: 'bg-green-500/20 text-green-300',
  };
  return map[status] ?? 'bg-white/10 text-white/60';
};

export default function AdminReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchReferrals();
  }, []);

  async function fetchReferrals() {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/referrals');
      if (!res.ok) throw new Error('Failed to fetch referrals');
      const data = await res.json();
      setReferrals(data.referrals || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load referrals');
    } finally {
      setLoading(false);
    }
  }

  const filtered = referrals.filter((r) => {
    const matchesSearch =
      r.referrerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.referredEmail.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: referrals.length,
    pending: referrals.filter((r) => r.status === 'pending').length,
    released: referrals.filter((r) => r.status === 'released').length,
    paid: referrals.filter((r) => r.status === 'paid').length,
  };

  return (
    <div className="min-h-screen bg-[#171117] text-white">
      <header className="border-b border-white/10 px-6 py-4 sticky top-0 z-20 bg-[#171117]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/admin" className="text-[#ecbaba] hover:text-white transition-colors shrink-0">
              <span className="material-symbols-outlined text-2xl">arrow_back</span>
            </Link>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold italic text-[#FF7095] truncate">Referral Activity</h1>
              <p className="text-sm text-white/45 truncate">
                Track who referred whom, commission status, and payouts.
              </p>
            </div>
          </div>
          <button
            onClick={fetchReferrals}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm transition-colors shrink-0"
          >
            Refresh
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-white/50 mt-1">Total Referrals</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="text-2xl font-bold text-yellow-300">{stats.pending}</div>
            <div className="text-xs text-white/50 mt-1">Pending</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="text-2xl font-bold text-blue-300">{stats.released}</div>
            <div className="text-xs text-white/50 mt-1">Released</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="text-2xl font-bold text-green-300">{stats.paid}</div>
            <div className="text-xs text-white/50 mt-1">Paid</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-xl">search</span>
            <input
              type="text"
              placeholder="Search by email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#FF7095]/50 transition-colors"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF7095]/50 transition-colors"
          >
            <option value="all" className="bg-[#171117]">All statuses</option>
            <option value="pending" className="bg-[#171117]">Pending</option>
            <option value="released" className="bg-[#171117]">Released</option>
            <option value="paid" className="bg-[#171117]">Paid</option>
          </select>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-300 text-sm mb-6">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-white/50">Loading referrals...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-white/50">
            {searchQuery || statusFilter !== 'all'
              ? 'No referrals match your filters.'
              : 'No referrals yet.'}
          </div>
        ) : (
          <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wider">Referrer</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wider">Referred</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wider">Status</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wider">Created</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wider">Released</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wider">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 text-sm text-white/90 max-w-[200px] truncate">{r.referrerEmail}</td>
                      <td className="px-6 py-4 text-sm text-white/70 max-w-[200px] truncate">{r.referredEmail}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-white/60">{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-sm text-white/60">{r.releasedAt ? new Date(r.releasedAt).toLocaleDateString() : '—'}</td>
                      <td className="px-6 py-4 text-sm text-white/60">{r.credit != null ? `$${Number(r.credit).toFixed(2)}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 text-xs text-white/30 border-t border-white/5">
              Showing {filtered.length} of {referrals.length} referral{referrals.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
