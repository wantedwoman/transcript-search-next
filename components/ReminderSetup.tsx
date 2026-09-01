'use client';

import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useState } from 'react';

type Cadence = 'daily' | 'weekly' | 'monthly';
type MessageStyle = 'gentle' | 'direct' | 'hype';

const CADENCE_OPTIONS: { value: Cadence; label: string; hint: string }[] = [
  { value: 'daily', label: 'Daily', hint: 'Every 1 day' },
  { value: 'weekly', label: 'Weekly', hint: 'Every 7 days' },
  { value: 'monthly', label: 'Monthly', hint: 'Every 30 days' },
];

const STYLE_OPTIONS: { value: MessageStyle; label: string; description: string }[] = [
  { value: 'gentle', label: 'Gentle', description: '“Hey Sis, it’s been a while… how’s that going?”' },
  { value: 'direct', label: 'Direct', description: '“Reminder: you said you’d check back in on it…”' },
  { value: 'hype', label: 'Hype', description: '“Sis!! Time to check in… Let’s go! 🔥”' },
];

interface ActiveReminder {
  id: string;
  topic: string;
  remind_at: string;
  message_style?: MessageStyle;
}

interface CalendarStatus {
  connected: boolean;
  configured: boolean;
  connection?: {
    provider: string;
    google_email: string | null;
    calendar_id: string;
    created_at: string;
  } | null;
}

export default function ReminderSetup() {
  const supabase = createClient();

  const [topic, setTopic] = useState('');
  const [cadence, setCadence] = useState<Cadence>('weekly');
  const [messageStyle, setMessageStyle] = useState<MessageStyle>('gentle');
  const [active, setActive] = useState<ActiveReminder | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [calendar, setCalendar] = useState<CalendarStatus>({ connected: false, configured: false });
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarBusy, setCalendarBusy] = useState(false);

  const loadActive = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const res = await fetch('/api/suzy/reminders');
      if (!res.ok) return;
      const data = await res.json();
      if (data.reminders && data.reminders.length > 0) {
        setActive(data.reminders[0]);
      } else {
        setActive(null);
      }
    } catch {
      // Silently ignore — the create/cancel actions surface real errors.
    }
  }, [supabase]);

  const loadCalendar = useCallback(async () => {
    setCalendarLoading(true);
    try {
      const res = await fetch('/api/suzy/calendar/status');
      if (!res.ok) return;
      const data = await res.json();
      setCalendar(data);
    } catch {
      // Silently ignore — the connect/disconnect actions surface real errors.
    } finally {
      setCalendarLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActive();
    loadCalendar();
  }, [loadActive, loadCalendar]);

  // Reflect the OAuth callback result (redirected back to /profile?calendar=...).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('calendar');
    if (result === 'connected') {
      setStatus({ type: 'success', text: 'Google Calendar connected. Your reminders will appear there too.' });
      loadCalendar();
    } else if (result === 'error') {
      setStatus({ type: 'error', text: 'Could not connect Google Calendar. Please try again.' });
    }
  }, [loadCalendar]);

  const handleCreate = async () => {
    if (!topic.trim()) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/suzy/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), cadence, messageStyle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create reminder');
      setTopic('');
      setStatus({
        type: 'success',
        text: calendar.connected
          ? 'Reminder set! It’s on your Google Calendar too, and I’ll check in with you in the app.'
          : 'Reminder set! I’ll check in with you in the app when it’s time.',
      });
      setActive(data.reminder);
    } catch (err) {
      setStatus({ type: 'error', text: err instanceof Error ? err.message : 'Failed to create reminder' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!active) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch('/api/suzy/reminders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminderId: active.id }),
      });
      if (!res.ok) throw new Error('Failed to cancel reminder');
      setActive(null);
      setStatus({ type: 'success', text: 'Reminder cancelled.' });
    } catch (err) {
      setStatus({ type: 'error', text: err instanceof Error ? err.message : 'Failed to cancel reminder' });
    } finally {
      setBusy(false);
    }
  };

  const handleConnectCalendar = async () => {
    setCalendarBusy(true);
    setStatus(null);
    try {
      const res = await fetch('/api/suzy/calendar/auth-url');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start Google Calendar connection');
      if (!data.url) throw new Error('No connection URL returned');
      // Navigate to Google's consent screen. The callback redirects back here.
      window.location.href = data.url;
    } catch (err) {
      setStatus({ type: 'error', text: err instanceof Error ? err.message : 'Failed to start connection' });
      setCalendarBusy(false);
    }
  };

  const handleDisconnectCalendar = async () => {
    setCalendarBusy(true);
    setStatus(null);
    try {
      const res = await fetch('/api/suzy/calendar/disconnect', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to disconnect calendar');
      setCalendar({ connected: false, configured: calendar.configured });
      setStatus({ type: 'success', text: 'Google Calendar disconnected. In-app reminders still work.' });
    } catch (err) {
      setStatus({ type: 'error', text: err instanceof Error ? err.message : 'Failed to disconnect calendar' });
    } finally {
      setCalendarBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-2xl text-primary">notifications_active</span>
        <div>
          <h2 className="text-xl font-headline font-bold text-primary">Check-In Reminders</h2>
          <p className="text-sm font-body text-secondary/60">
            Have me nudge you to check back in on a goal or a topic — in the app, at no cost.
          </p>
        </div>
      </div>

      {active ? (
        <div className="glass-panel-solid rounded-lg border border-outline-variant/20 p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-label font-semibold uppercase tracking-widest text-secondary/60">
                Active reminder
              </p>
              <p className="text-lg font-body text-on-surface">{active.topic}</p>
              <p className="text-sm font-body text-secondary/70">
                Next check-in: {new Date(active.remind_at).toLocaleDateString()} at{' '}
                {new Date(active.remind_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {active.message_style ? ` • ${active.message_style} tone` : ''}
              </p>
            </div>
            <button
              onClick={handleCancel}
              disabled={busy}
              className="shrink-0 px-4 py-2 rounded-lg bg-surface-container border border-outline-variant/20 text-error font-label font-semibold text-sm active:scale-95 transition-all hover:border-error/40 disabled:opacity-50"
            >
              {busy ? 'Cancelling...' : 'Cancel'}
            </button>
          </div>
        </div>
      ) : (
        <div className="glass-panel-solid rounded-lg border border-outline-variant/20 p-6 space-y-5">
          {/* Topic */}
          <div className="space-y-2">
            <label className="block text-sm font-label font-semibold uppercase tracking-widest text-secondary/80">
              Remind me about
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-surface-container border border-outline-variant/20 text-on-surface placeholder:text-secondary/30 font-body text-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all"
              placeholder="e.g. checking in on my dating boundaries"
              maxLength={200}
            />
          </div>

          {/* Cadence */}
          <div className="space-y-2">
            <label className="block text-sm font-label font-semibold uppercase tracking-widest text-secondary/80">
              Cadence
            </label>
            <select
              value={cadence}
              onChange={(e) => setCadence(e.target.value as Cadence)}
              className="w-full px-4 py-3 rounded-lg bg-surface-container border border-outline-variant/20 text-on-surface font-body text-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all appearance-none"
            >
              {CADENCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-surface-container text-on-surface">
                  {opt.label} — {opt.hint}
                </option>
              ))}
            </select>
          </div>

          {/* Message style */}
          <div className="space-y-2">
            <label className="block text-sm font-label font-semibold uppercase tracking-widest text-secondary/80">
              How should I sound?
            </label>
            <select
              value={messageStyle}
              onChange={(e) => setMessageStyle(e.target.value as MessageStyle)}
              className="w-full px-4 py-3 rounded-lg bg-surface-container border border-outline-variant/20 text-on-surface font-body text-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all appearance-none"
            >
              {STYLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-surface-container text-on-surface">
                  {opt.label} — {opt.description}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleCreate}
            disabled={saving || !topic.trim()}
            className="w-full py-4 rounded-xl bg-primary text-on-primary font-label font-semibold uppercase tracking-widest text-sm shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#E11D69]"
          >
            {saving ? 'Setting...' : 'Remind Me To Check In'}
          </button>
        </div>
      )}

      {/* Google Calendar connection */}
      <div className="glass-panel-solid rounded-lg border border-outline-variant/20 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-2xl text-tertiary">calendar_month</span>
          <div>
            <h3 className="text-lg font-headline font-bold text-primary">Google Calendar (optional)</h3>
            <p className="text-sm font-body text-secondary/60">
              Put your check-ins on your calendar too. Events-only access — Coach Cass never reads your
              contacts or email.
            </p>
          </div>
        </div>

        {calendarLoading ? (
          <p className="text-sm font-body text-secondary/50">Checking calendar connection...</p>
        ) : calendar.connected ? (
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="flex items-center gap-2 text-sm font-body text-tertiary">
                <span className="w-2 h-2 rounded-full bg-tertiary shadow-[0_0_8px_#e9c349]" />
                Connected
              </p>
              <p className="text-sm font-body text-on-surface">
                {calendar.connection?.google_email || 'Google Calendar'}
              </p>
              <p className="text-xs font-body text-secondary/50">
                New reminders appear as recurring events on your calendar.
              </p>
            </div>
            <button
              onClick={handleDisconnectCalendar}
              disabled={calendarBusy}
              className="shrink-0 px-4 py-2 rounded-lg bg-surface-container border border-outline-variant/20 text-error font-label font-semibold text-sm active:scale-95 transition-all hover:border-error/40 disabled:opacity-50"
            >
              {calendarBusy ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </div>
        ) : (
          <button
            onClick={handleConnectCalendar}
            disabled={calendarBusy || !calendar.configured}
            className="w-full py-3 rounded-lg bg-primary/20 text-primary font-label font-semibold uppercase tracking-widest text-sm border border-primary/30 active:scale-95 transition-all hover:bg-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {calendarBusy
              ? 'Opening Google...'
              : calendar.configured
                ? 'Connect Google Calendar'
                : 'Google Calendar is not configured yet'}
          </button>
        )}
      </div>

      {status && (
        <div
          className={`text-center font-label font-semibold text-sm ${
            status.type === 'success' ? 'text-tertiary' : 'text-error'
          }`}
        >
          {status.text}
        </div>
      )}
    </div>
  );
}
