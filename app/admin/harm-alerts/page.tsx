'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type HarmAlert = {
  id: string;
  userId: string;
  email: string;
  messageSnippet: string;
  matchedPattern: string;
  severity: 'critical';
  acknowledged: boolean;
  createdAt: string;
};

const severityBadge = {
  critical: 'bg-red-500/15 text-red-300 border-red-500/30',
};

export default function AdminHarmAlertsPage() {
  const [alerts, setAlerts] = useState<HarmAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/harm-alerts');
      if (!res.ok) throw new Error('Failed to fetch harm alerts');
      const data = await res.json();
      setAlerts(data.alerts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load harm alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  async function acknowledge(id: string) {
    try {
      setError(null);
      const res = await fetch(`/api/admin/harm-alerts/${id}/acknowledge`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to acknowledge alert');
      setAlerts((current) => current.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to acknowledge alert');
    }
  }

  const unacknowledged = alerts.filter((a) => !a.acknowledged);
  const acknowledged = alerts.filter((a) => a.acknowledged);

  function renderAlertRow(alert: HarmAlert) {
    return (
      <div
        key={alert.id}
        className={`rounded-2xl border p-5 ${alert.acknowledged ? 'border-white/5 bg-white/[0.03]' : 'border-[#FF7095]/25 bg-[#FF7095]/5'}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`px-2.5 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wide ${severityBadge[alert.severity]}`}>
                {alert.severity}
              </span>
              {!alert.acknowledged && (
                <span className="px-2.5 py-1 rounded-full bg-white/10 text-white/80 text-[11px] font-semibold uppercase tracking-wide">
                  New
                </span>
              )}
              <span className="font-medium text-white truncate">{alert.email}</span>
            </div>
            <div className="text-xs text-white/40 mt-1.5">
              {new Date(alert.createdAt).toLocaleString()}
            </div>
          </div>
          {!alert.acknowledged && (
            <button
              onClick={() => acknowledge(alert.id)}
              className="px-4 py-2 rounded-lg bg-[#FF7095] hover:bg-[#FF7095]/80 text-white text-sm font-semibold transition-colors shrink-0"
            >
              Acknowledge
            </button>
          )}
          {alert.acknowledged && (
            <span className="px-3 py-1.5 rounded-lg bg-green-500/15 text-green-300 text-xs font-semibold shrink-0">
              Acknowledged
            </span>
          )}
        </div>

        <p className="text-sm text-white/85 leading-6 whitespace-pre-wrap bg-black/20 rounded-lg px-4 py-3 border border-white/5">
          {alert.messageSnippet}
        </p>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-white/35 uppercase tracking-wider font-semibold">Matched pattern</span>
          <code className="text-[11px] text-[#ecbaba] bg-white/5 rounded px-2 py-0.5 border border-white/10">
            {alert.matchedPattern}
          </code>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#171117] text-white">
      <header className="border-b border-white/10 px-6 py-4 sticky top-0 z-20 bg-[#171117]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/admin" className="text-[#ecbaba] hover:text-white transition-colors shrink-0">
              <span className="material-symbols-outlined text-2xl">arrow_back</span>
            </Link>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold italic text-[#FF7095] truncate">Harm Alerts</h1>
              <p className="text-sm text-white/45 truncate">
                Self-harm, suicide, and violence language detected in chat — 988 + emergency referral sent to the member.
              </p>
            </div>
          </div>
          <button
            onClick={loadAlerts}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm transition-colors shrink-0"
          >
            Refresh
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-300 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-white/50">Loading harm alerts...</div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-16 text-white/50">
            No harm alerts yet. The team will be notified here when harm language is detected.
          </div>
        ) : (
          <>
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-white/80">Unacknowledged</h2>
                <span className="text-xs text-white/40">{unacknowledged.length}</span>
              </div>
              {unacknowledged.length === 0 ? (
                <div className="bg-white/5 rounded-2xl border border-white/10 px-5 py-6 text-sm text-white/50">
                  All caught up — no unacknowledged alerts.
                </div>
              ) : (
                <div className="space-y-4">{unacknowledged.map(renderAlertRow)}</div>
              )}
            </section>

            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-white/80">Acknowledged</h2>
                <span className="text-xs text-white/40">{acknowledged.length}</span>
              </div>
              {acknowledged.length === 0 ? (
                <div className="bg-white/5 rounded-2xl border border-white/10 px-5 py-6 text-sm text-white/50">
                  Nothing acknowledged yet.
                </div>
              ) : (
                <div className="space-y-4">{acknowledged.map(renderAlertRow)}</div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
