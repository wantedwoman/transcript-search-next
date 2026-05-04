'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface VaultEntry {
  id: string;
  content: string;
  user_tag: string;
  heartbeat_link: string | null;
  created_at: string;
}

export default function VaultPage() {
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async (search?: string) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (search?.trim()) {
        params.set('search', search.trim());
      }
      const res = await fetch(`/api/suzy/vault?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to load vault entries');
      }
      const data = await res.json();
      setEntries(data.entries || []);
      setTotalCount(data.count ?? 0);
    } catch {
      setError('Failed to load vault entries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleSearch = () => {
    fetchEntries(searchQuery);
  };

  const handleDelete = async (id: string) => {
    if (deleting) return;
    setDeleting(id);
    try {
      const res = await fetch('/api/suzy/vault', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Failed to delete');
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setTotalCount((prev) => prev - 1);
    } catch {
      setError('Failed to delete entry');
    } finally {
      setDeleting(null);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    fetchEntries();
  };

  return (
    <div className="min-h-screen text-on-surface bg-[#171117] flex flex-col">
      {/* Decorative Glow */}
      <div className="fixed top-1/3 right-1/3 w-[500px] h-[500px] bg-primary/25 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-[#171117] border-b border-outline-variant/10">
        <div className="flex items-center gap-4 px-6 py-4">
          <Link href="/chat" className="p-2 text-[#ecbaba] hover:text-primary active:scale-95 duration-200">
            <span className="material-symbols-outlined text-2xl">arrow_back</span>
          </Link>
          <h1 className="text-2xl font-headline font-bold italic tracking-tighter text-primary">
            My Vault
          </h1>
          <span className="ml-auto text-sm font-label text-secondary/50">
            {totalCount}/100
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 pt-24 pb-36 px-6 md:px-12 lg:px-24 max-w-3xl mx-auto w-full space-y-6 relative z-0">
        {/* Search Bar */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary/40 text-lg">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search your vault…"
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg pl-10 pr-4 py-3 text-on-surface placeholder:text-secondary/30 font-body focus:outline-none focus:border-primary/40"
            />
          </div>
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="px-4 rounded-lg text-secondary/60 hover:text-primary border border-outline-variant/20 hover:border-primary/40 transition-colors text-sm font-label"
            >
              Clear
            </button>
          )}
          <button
            onClick={handleSearch}
            className="bg-primary text-on-primary px-5 py-3 rounded-lg font-label font-semibold active:scale-95 duration-200"
          >
            Search
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="text-error px-4 py-3 rounded-lg bg-error-container/10 border border-error/20 font-body text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-3 underline">Dismiss</button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="flex gap-2 items-center">
              <span className="w-2 h-2 rounded-full bg-tertiary/60 animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 rounded-full bg-tertiary/60 animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 rounded-full bg-tertiary/60 animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && entries.length === 0 && (
          <div className="text-center py-16 space-y-4">
            <span className="material-symbols-outlined text-6xl text-secondary/20">bookmark_add</span>
            <p className="text-secondary/50 font-body text-lg">
              {searchQuery ? 'No results found.' : 'Your vault is empty.'}
            </p>
            {!searchQuery && (
              <p className="text-secondary/30 font-body text-sm">
                Save Suzy&apos;s responses you want to revisit anytime.
              </p>
            )}
          </div>
        )}

        {/* Entries */}
        {!loading && entries.length > 0 && (
          <div className="space-y-4">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="glass-panel-solid bg-surface-container-high/60 border border-outline-variant/20 rounded-lg p-5 space-y-3 relative group"
              >
                {/* Tag */}
                {entry.user_tag && (
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-primary">label</span>
                    <span className="text-xs font-label font-semibold uppercase tracking-widest text-primary">
                      {entry.user_tag}
                    </span>
                  </div>
                )}

                {/* Content */}
                <p className="font-body text-on-surface leading-relaxed whitespace-pre-wrap">
                  {entry.content}
                </p>

                {/* Heartbeat Link */}
                {entry.heartbeat_link && (
                  <a
                    href={entry.heartbeat_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-tertiary hover:text-tertiary/80 text-sm font-label transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">link</span>
                    View on Heartbeat
                  </a>
                )}

                {/* Date + Delete */}
                <div className="flex items-center justify-between pt-2 border-t border-outline-variant/10">
                  <span className="text-[10px] font-label font-semibold uppercase tracking-widest text-secondary/40">
                    {new Date(entry.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    disabled={deleting === entry.id}
                    className="text-[10px] font-label font-semibold uppercase tracking-widest text-error/60 hover:text-error transition-colors disabled:opacity-50"
                  >
                    {deleting === entry.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* BottomNavBar */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-6 pt-3 bg-[#171117] z-50 rounded-t-lg border-t border-[#4c4451]/30 shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
        <Link href="/chat" prefetch={true} className="flex flex-col items-center justify-center text-[#ecbaba] opacity-60 px-6 py-2 hover:opacity-100 transition-opacity active:scale-90 duration-300 ease-out">
          <span className="material-symbols-outlined text-2xl">chat_bubble</span>
          <span className="font-label text-[11px] font-semibold uppercase tracking-widest mt-1">Chat</span>
        </Link>
        <Link href="/vault" prefetch={true} className="flex flex-col items-center justify-center bg-primary text-white rounded-full px-6 py-2 active:scale-90 duration-300 ease-out">
          <span className="material-symbols-outlined text-2xl">bookmark</span>
          <span className="font-label text-[11px] font-semibold uppercase tracking-widest mt-1">Vault</span>
        </Link>
        <Link href="/profile" prefetch={true} className="flex flex-col items-center justify-center text-[#ecbaba] opacity-60 px-6 py-2 hover:opacity-100 transition-opacity active:scale-90 duration-300 ease-out">
          <span className="material-symbols-outlined text-2xl">person</span>
          <span className="font-label text-[11px] font-semibold uppercase tracking-widest mt-1">Profile</span>
        </Link>
      </nav>
    </div>
  );
}