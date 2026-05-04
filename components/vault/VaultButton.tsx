'use client';

import { useState } from 'react';

interface VaultButtonProps {
  messageId: string;
  content: string;
}

export default function VaultButton({ messageId, content }: VaultButtonProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (saving || saved) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/suzy/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403) {
          setError('Vault full — delete some entries first.');
        } else {
          setError(data.error || 'Failed to save');
        }
        setSaving(false);
        return;
      }

      setSaved(true);
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <button
        disabled
        className="flex items-center gap-1.5 text-[11px] font-label font-semibold uppercase tracking-widest text-tertiary/80 px-2 py-1 rounded-md cursor-default"
      >
        <span className="material-symbols-outlined text-sm">bookmark</span>
        Saved
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-1.5 text-[11px] font-label font-semibold uppercase tracking-widest text-secondary/40 hover:text-primary transition-colors px-2 py-1 rounded-md hover:bg-primary/5 active:scale-95 duration-200 disabled:opacity-50"
        title="Save to Vault"
      >
        <span className="material-symbols-outlined text-sm">
          {saving ? 'hourglass_empty' : 'bookmark_add'}
        </span>
        {saving ? 'Saving…' : 'Save to Vault'}
      </button>
      {error && (
        <span className="text-[11px] text-error/80 font-label">{error}</span>
      )}
    </div>
  );
}