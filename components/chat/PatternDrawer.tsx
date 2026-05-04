'use client';

import { useEffect } from 'react';
import { UserPattern } from '@/lib/pattern-detection/types';

interface PatternDrawerProps {
  pattern: UserPattern;
  open: boolean;
  onClose: () => void;
  onDismiss: (patternId: string) => void;
}

export default function PatternDrawer({ pattern, open, onClose, onDismiss }: PatternDrawerProps) {
  // Close on Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md z-50 bg-[#171117] border-l border-outline-variant/20 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant/20">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🧠</span>
            <h2 className="text-lg font-headline font-bold text-primary">Your Patterns</h2>
          </div>
          <button onClick={onClose} className="p-2 text-secondary/60 hover:text-primary transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {/* Topics Observed */}
          {pattern.topics_observed.length > 0 && (
            <section>
              <h3 className="text-xs font-label font-semibold uppercase tracking-widest text-secondary/60 mb-3">Topics Observed</h3>
              <div className="flex flex-wrap gap-2">
                {pattern.topics_observed.map((topic, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 rounded-full bg-primary/15 border border-primary/30 text-primary text-sm font-label font-semibold"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Tone Trend */}
          {pattern.tone_trend && (
            <section>
              <h3 className="text-xs font-label font-semibold uppercase tracking-widest text-secondary/60 mb-3">Tone Trend</h3>
              <p className="text-on-surface font-body text-base leading-relaxed flex items-center gap-2">
                <span className="material-symbols-outlined text-tertiary text-xl">trending_up</span>
                {pattern.tone_trend}
              </p>
            </section>
          )}

          {/* Repeat Questions */}
          {pattern.repeat_questions.length > 0 && (
            <section>
              <h3 className="text-xs font-label font-semibold uppercase tracking-widest text-secondary/60 mb-3">Questions You Keep Coming Back To</h3>
              <ul className="space-y-2">
                {pattern.repeat_questions.map((q, i) => (
                  <li key={i} className="flex items-start gap-2 text-on-surface font-body text-base">
                    <span className="text-tertiary mt-1 shrink-0">•</span>
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Suggested Focus */}
          {pattern.suggested_focus && (
            <section>
              <h3 className="text-xs font-label font-semibold uppercase tracking-widest text-secondary/60 mb-3">Suggested Next Step</h3>
              <p className="text-on-surface font-body text-base leading-relaxed bg-surface-container-low/50 border border-outline-variant/20 rounded-lg px-4 py-3">
                {pattern.suggested_focus}
              </p>
              {pattern.heartbeat_link && (
                <a
                  href={pattern.heartbeat_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-3 text-primary font-label font-semibold hover:underline"
                >
                  <span className="material-symbols-outlined text-lg">play_circle</span>
                  Open in Heartbeat
                </a>
              )}
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-outline-variant/20">
          <button
            onClick={() => onDismiss(pattern.id)}
            className="w-full py-3 rounded-lg border border-outline-variant/20 text-secondary/60 hover:text-error hover:border-error/30 font-label font-semibold text-sm transition-all active:scale-[0.98]"
          >
            Dismiss Pattern
          </button>
        </div>
      </div>
    </>
  );
}