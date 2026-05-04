'use client';

import { useState } from 'react';

interface PatternBannerProps {
  topic: string;
  onShowMe: () => void;
  onDismiss: () => void;
}

export default function PatternBanner({ topic, onShowMe, onDismiss }: PatternBannerProps) {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="glass-panel-solid px-4 py-3 rounded-xl border border-tertiary/30 bg-surface-container-high/40 flex items-center gap-3 text-sm">
      <span className="text-lg shrink-0">🧠</span>
      <p className="flex-1 text-on-surface font-body leading-snug">
        Pattern Catch: You&apos;ve been exploring <span className="text-primary font-semibold">{topic}</span> lately. Want to see your patterns?
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => { setVisible(false); onShowMe(); }}
          className="bg-primary text-on-primary px-4 py-1.5 rounded-full text-xs font-label font-semibold active:scale-95 transition-all"
        >
          Show Me
        </button>
        <button
          onClick={() => { setVisible(false); onDismiss(); }}
          className="text-secondary/60 hover:text-on-surface px-3 py-1.5 rounded-full text-xs font-label font-semibold active:scale-95 transition-all"
        >
          Not Now
        </button>
      </div>
    </div>
  );
}