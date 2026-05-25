'use client';

import { useState } from 'react';

interface DateAuditResult {
  factsVsFeelings: {
    facts: string[];
    feelings: string[];
  };
  greenFlags: string[];
  redFlags: string[];
  decisionClarity: string;
  nextSteps: string[];
}

interface DateAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DateAuditModal({ isOpen, onClose }: DateAuditModalProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DateAuditResult | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/suzy/date-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: input.trim() }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `Server error: ${response.status}`);

      setResult(data.audit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setInput('');
    setResult(null);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto glass-panel-solid bg-[#1f1825] border border-outline-variant/20 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-[#1f1825] z-10 px-6 pt-6 pb-4 border-b border-outline-variant/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-2xl text-tertiary">search_check</span>
              <h2 className="text-xl font-headline font-bold text-primary">Date Audit</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-secondary/60 hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <p className="text-sm text-secondary/70 mt-2 font-body">
            Paste a text exchange or describe how the date went. Coach Cass AI will help you separate facts from feelings, spot flags, and get clarity on next steps.
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {!result ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="So we went to dinner and he paid, but then he didn't text for two days after. Here's what he said..."
                className="w-full h-48 bg-surface-container-low border border-outline-variant/20 rounded-lg p-4 text-on-surface placeholder:text-secondary/30 font-body text-sm leading-relaxed resize-none focus:outline-none focus:border-primary/40 transition-colors"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="w-full bg-primary text-on-primary font-label font-semibold py-3 rounded-lg shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="ml-1">Analyzing...</span>
                  </span>
                ) : (
                  'Run the Audit'
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-6">
              {/* Facts vs Feelings */}
              <div>
                <h3 className="text-sm font-label font-semibold uppercase tracking-widest text-secondary/60 mb-3">
                  Facts vs Feelings
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  <div className="bg-surface-container-low/60 border border-outline-variant/20 rounded-lg p-4">
                    <p className="text-xs font-label font-semibold uppercase tracking-widest text-primary/70 mb-2">
                      What Happened
                    </p>
                    <ul className="space-y-1">
                      {result.factsVsFeelings.facts.map((fact, i) => (
                        <li key={i} className="text-sm text-on-surface font-body leading-relaxed flex gap-2">
                          <span className="text-primary/50 shrink-0">•</span>
                          <span>{fact}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-surface-container-low/60 border border-outline-variant/20 rounded-lg p-4">
                    <p className="text-xs font-label font-semibold uppercase tracking-widest text-secondary/50 mb-2">
                      How It Felt
                    </p>
                    <ul className="space-y-1">
                      {result.factsVsFeelings.feelings.map((feeling, i) => (
                        <li key={i} className="text-sm text-on-surface font-body leading-relaxed flex gap-2">
                          <span className="text-secondary/50 shrink-0">•</span>
                          <span>{feeling}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Flags */}
              <div>
                <h3 className="text-sm font-label font-semibold uppercase tracking-widest text-secondary/60 mb-3">
                  Flags
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  {result.greenFlags.length > 0 && (
                    <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-lg p-4">
                      <p className="text-xs font-label font-semibold uppercase tracking-widest text-emerald-400/80 mb-2">
                        🟢 Green Flags
                      </p>
                      <ul className="space-y-1">
                        {result.greenFlags.map((flag, i) => (
                          <li key={i} className="text-sm text-on-surface font-body leading-relaxed flex gap-2">
                            <span className="text-emerald-400/60 shrink-0">•</span>
                            <span>{flag}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.redFlags.length > 0 && (
                    <div className="bg-red-950/30 border border-red-500/20 rounded-lg p-4">
                      <p className="text-xs font-label font-semibold uppercase tracking-widest text-red-400/80 mb-2">
                        🔴 Red Flags
                      </p>
                      <ul className="space-y-1">
                        {result.redFlags.map((flag, i) => (
                          <li key={i} className="text-sm text-on-surface font-body leading-relaxed flex gap-2">
                            <span className="text-red-400/60 shrink-0">•</span>
                            <span>{flag}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.greenFlags.length === 0 && result.redFlags.length === 0 && (
                    <p className="text-sm text-secondary/50 font-body">No strong flags either way. More information may help.</p>
                  )}
                </div>
              </div>

              {/* Decision Clarity */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <h3 className="text-sm font-label font-semibold uppercase tracking-widest text-primary/70 mb-2">
                  Decision Clarity
                </h3>
                <p className="text-sm text-on-surface font-body leading-relaxed">
                  {result.decisionClarity}
                </p>
              </div>

              {/* Next Steps */}
              <div>
                <h3 className="text-sm font-label font-semibold uppercase tracking-widest text-secondary/60 mb-3">
                  Next Steps
                </h3>
                <ol className="space-y-2">
                  {result.nextSteps.map((step, i) => (
                    <li key={i} className="text-sm text-on-surface font-body leading-relaxed flex gap-3">
                      <span className="text-primary font-label font-semibold shrink-0">{i + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Reset Button */}
              <button
                onClick={handleReset}
                className="w-full bg-surface-container-low border border-outline-variant/20 text-on-surface font-label font-semibold py-3 rounded-lg hover:border-primary/40 transition-colors active:scale-[0.98]"
              >
                Audit Another Date
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 text-error px-4 py-3 rounded-lg bg-error-container/10 border border-error/20 font-body text-sm">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}