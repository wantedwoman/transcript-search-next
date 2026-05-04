'use client';

import { useState } from 'react';

interface DatePrepModalProps {
  open: boolean;
  onClose: () => void;
}

export default function DatePrepModal({ open, onClose }: DatePrepModalProps) {
  const [where, setWhere] = useState('');
  const [feeling, setFeeling] = useState('');
  const [communicate, setCommunicate] = useState('');
  const [loading, setLoading] = useState(false);
  const [prep, setPrep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!where.trim() || !feeling.trim() || !communicate.trim()) return;

    setLoading(true);
    setError(null);
    setPrep(null);

    try {
      const response = await fetch('/api/suzy/date-prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          where: where.trim(),
          feeling: feeling.trim(),
          communicate: communicate.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Something went wrong');

      setPrep(data.prep);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate your date prep.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!prep) return;
    try {
      await navigator.clipboard.writeText(prep);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback — select text manually
    }
  };

  const handleReset = () => {
    setWhere('');
    setFeeling('');
    setCommunicate('');
    setPrep(null);
    setError(null);
    setCopied(false);
  };

  const handleBackdropClick = () => {
    if (!loading) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-lg mx-4 mb-4 sm:mb-0 bg-[#1f1a1f] border border-outline-variant/20 rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl text-primary">favorite</span>
            <h2 className="text-xl font-headline font-bold text-primary">Date Prep</h2>
          </div>
          {!loading && (
            <button
              onClick={prep ? handleReset : onClose}
              className="p-2 text-secondary/60 hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined">{prep ? 'refresh' : 'close'}</span>
            </button>
          )}
        </div>

        <div className="px-6 pb-6">
          {prep ? (
            /* Results view */
            <div className="space-y-4">
              <p className="text-secondary/60 text-sm font-body">
                Here&apos;s your date prep, Sis. Read it, own it, walk in there knowing who you are.
              </p>
              <div className="bg-[#171117] rounded-xl p-5 border border-outline-variant/10">
                <p className="text-on-surface font-body text-base leading-relaxed whitespace-pre-wrap">
                  {prep}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCopy}
                  className="flex-1 bg-primary text-on-primary py-3 rounded-xl font-label font-semibold text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">
                    {copied ? 'check' : 'content_copy'}
                  </span>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 bg-surface-container-low border border-outline-variant/20 text-on-surface py-3 rounded-xl font-label font-semibold text-sm active:scale-95 transition-all"
                >
                  New Prep
                </button>
              </div>
            </div>
          ) : (
            /* Form view */
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-secondary/70 font-body text-sm leading-relaxed">
                Tell me about your date and I&apos;ll give you talking points, energy shifts, and openers to walk in ready.
              </p>

              <div className="space-y-2">
                <label className="text-sm font-label font-semibold text-secondary/80 uppercase tracking-wider">
                  Where are you going?
                </label>
                <input
                  type="text"
                  value={where}
                  onChange={(e) => setWhere(e.target.value)}
                  placeholder="Dinner, drinks, a walk, movie..."
                  className="w-full bg-[#171117] border border-outline-variant/20 rounded-xl px-4 py-3 text-on-surface placeholder:text-secondary/30 font-body focus:outline-none focus:border-primary/40 transition-colors"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-label font-semibold text-secondary/80 uppercase tracking-wider">
                  How are you feeling?
                </label>
                <input
                  type="text"
                  value={feeling}
                  onChange={(e) => setFeeling(e.target.value)}
                  placeholder="Nervous, excited, unsure, hopeful..."
                  className="w-full bg-[#171117] border border-outline-variant/20 rounded-xl px-4 py-3 text-on-surface placeholder:text-secondary/30 font-body focus:outline-none focus:border-primary/40 transition-colors"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-label font-semibold text-secondary/80 uppercase tracking-wider">
                  What do you want them to know about you?
                </label>
                <textarea
                  value={communicate}
                  onChange={(e) => setCommunicate(e.target.value)}
                  placeholder="I'm ambitious, I love to travel, I don't play games..."
                  rows={3}
                  className="w-full bg-[#171117] border border-outline-variant/20 rounded-xl px-4 py-3 text-on-surface placeholder:text-secondary/30 font-body focus:outline-none focus:border-primary/40 transition-colors resize-none"
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="text-error px-4 py-2 rounded-lg bg-error-container/10 border border-error/20 font-body text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!where.trim() || !feeling.trim() || !communicate.trim() || loading}
                className="w-full bg-primary text-on-primary py-3.5 rounded-xl font-label font-semibold text-base active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span>Getting your prep...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">auto_awesome</span>
                    Get My Prep
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}