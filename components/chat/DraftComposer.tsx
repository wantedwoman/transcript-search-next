'use client';

import { useState, useCallback } from 'react';

type DraftTone = 'Soft' | 'Direct' | 'Playful' | 'Vulnerable' | 'Neutral';

const TONES: { value: DraftTone; label: string; icon: string; description: string }[] = [
  { value: 'Soft', label: 'Soft', icon: '🌙', description: 'Gentle warmth, tenderness' },
  { value: 'Direct', label: 'Direct', icon: '💎', description: 'Clear, confident, no hedging' },
  { value: 'Playful', label: 'Playful', icon: '✨', description: 'Light, fun, a little spark' },
  { value: 'Vulnerable', label: 'Vulnerable', icon: '💜', description: 'Raw honesty, no armor' },
  { value: 'Neutral', label: 'Neutral', icon: '📝', description: 'Clean up only, same energy' },
];

interface DraftComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertDraft?: (text: string) => void;
}

export default function DraftComposer({ isOpen, onClose, onInsertDraft }: DraftComposerProps) {
  if (!isOpen) return null;
  const [rawText, setRawText] = useState('');
  const [tone, setTone] = useState<DraftTone>('Neutral');
  const [draftedText, setDraftedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleDraft = useCallback(async () => {
    if (!rawText.trim()) return;

    setLoading(true);
    setError(null);
    setDraftedText('');

    try {
      const response = await fetch('/api/suzy/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: rawText.trim(), tone }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || data?.details || 'Failed to draft message');
      }

      setDraftedText(data.draft.drafted_text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [rawText, tone]);

  const handleCopy = useCallback(async () => {
    if (!draftedText) return;
    try {
      await navigator.clipboard.writeText(draftedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text
    }
  }, [draftedText]);

  const handleInsertToChat = useCallback(() => {
    if (draftedText && onInsertDraft) {
      onInsertDraft(draftedText);
      onClose();
    }
  }, [draftedText, onInsertDraft, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-[#1e1720] border border-outline-variant/20 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/10">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-2xl">edit_note</span>
            <h2 className="text-xl font-headline font-bold text-primary">Write a Letter</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-secondary/60 hover:text-primary active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Raw Text Input */}
          <div>
            <label className="text-sm font-label font-semibold uppercase tracking-widest text-secondary/60 mb-2 block">
              What do you want to say?
            </label>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Type what you're feeling... Suzy will help you say it better."
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-on-surface font-body text-base placeholder:text-secondary/30 focus:outline-none focus:border-primary/40 resize-none"
              rows={4}
              maxLength={2000}
              disabled={loading}
            />
            <p className="text-[10px] font-label text-secondary/40 mt-1">
              {rawText.length}/2000
            </p>
          </div>

          {/* Tone Selector */}
          <div>
            <label className="text-sm font-label font-semibold uppercase tracking-widest text-secondary/60 mb-3 block">
              Choose your tone
            </label>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTone(t.value)}
                  disabled={loading}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-label font-semibold transition-all active:scale-95 ${
                    tone === t.value
                      ? 'bg-primary text-white shadow-lg'
                      : 'bg-surface-container-low border border-outline-variant/20 text-secondary/70 hover:border-primary/40 hover:text-primary'
                  }`}
                >
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] font-label text-secondary/40 mt-2">
              {TONES.find((t) => t.value === tone)?.description}
            </p>
          </div>

          {/* Draft Button - Always Visible */}
          <button
            onClick={handleDraft}
            disabled={!rawText.trim() || loading}
            className="w-full bg-primary text-on-primary py-4 rounded-xl font-label font-semibold text-lg active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Drafting...
              </span>
            ) : (
              'Draft It'
            )}
          </button>

          {/* Error */}
          {error && (
            <div className="text-error px-4 py-3 rounded-lg bg-error-container/10 border border-error/20 text-sm font-body">
              {error}
            </div>
          )}

          {/* Before vs After */}
          {draftedText && (
            <div className="space-y-4">
              <div className="border border-outline-variant/10 rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-surface-container-low border-b border-outline-variant/10">
                  <span className="text-[10px] font-label font-semibold uppercase tracking-widest text-secondary/50">
                    Before — Your Original
                  </span>
                </div>
                <div className="px-4 py-3 text-secondary/70 font-body text-sm whitespace-pre-wrap">
                  {rawText}
                </div>
              </div>

              <div className="border border-primary/30 rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-primary/10 border-b border-primary/20">
                  <span className="text-[10px] font-label font-semibold uppercase tracking-widest text-primary">
                    After — Suzy&apos;s Draft
                  </span>
                </div>
                <div className="px-4 py-3 text-on-surface font-body text-base whitespace-pre-wrap">
                  {draftedText}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleCopy}
                  className="flex-1 flex items-center justify-center gap-2 bg-surface-container-low border border-outline-variant/20 py-3 rounded-lg font-label font-semibold text-secondary hover:border-primary/40 hover:text-primary active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-lg">
                    {copied ? 'check' : 'content_copy'}
                  </span>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                {onInsertDraft && (
                  <button
                    onClick={handleInsertToChat}
                    className="flex-1 flex items-center justify-center gap-2 bg-primary text-on-primary py-3 rounded-lg font-label font-semibold active:scale-95 transition-all shadow-lg"
                  >
                    <span className="material-symbols-outlined text-lg">chat_bubble</span>
                    Use in Chat
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}