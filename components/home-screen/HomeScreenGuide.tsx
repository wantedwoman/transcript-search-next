'use client';

import { useEffect, useState } from 'react';
import {
  isHomeScreenDismissed,
  dismissHomeScreenGuide,
} from '@/lib/home-screen/dismiss-persistence';

type Platform = 'ios' | 'android' | 'desktop';

interface PlatformSteps {
  label: string;
  steps: string[];
}

const PLATFORM_STEPS: Record<Platform, PlatformSteps> = {
  ios: {
    label: 'iOS Safari',
    steps: [
      'Tap the Share button (square with arrow up)',
      "Scroll down and tap 'Add to Home Screen'",
      'Tap Add',
    ],
  },
  android: {
    label: 'Android Chrome',
    steps: [
      'Tap the menu (⋮) in the top right',
      "Tap 'Install app' or 'Add to Home Screen'",
    ],
  },
  desktop: {
    label: 'Desktop Chrome',
    steps: ['Click the install icon in the address bar', 'Click Install'],
  },
};

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  // iPadOS Safari reports as a Mac but supports touch.
  if (/MacIntel/i.test(navigator.platform) && navigator.maxTouchPoints > 1) return 'ios';
  return 'desktop';
}

export default function HomeScreenGuide() {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<Platform>('desktop');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Mobile only (matches the `md:` Tailwind breakpoint).
    if (window.innerWidth >= 768) return;
    if (isHomeScreenDismissed()) return;

    setPlatform(detectPlatform());
    setVisible(true);
  }, []);

  const handleDismiss = () => {
    dismissHomeScreenGuide();
    setVisible(false);
  };

  if (!visible) return null;

  const info = PLATFORM_STEPS[platform];

  return (
    <div className="fixed top-20 inset-x-4 z-40 pointer-events-none">
      <div className="glass-panel-solid rounded-2xl border border-[#FF7095]/25 shadow-2xl p-5 pointer-events-auto relative max-w-md mx-auto">
        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          aria-label="Dismiss home screen guide"
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-secondary/60 hover:text-primary hover:bg-white/10 transition-colors"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>

        {/* Header */}
        <div className="flex items-start gap-3 pr-8">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF7095] to-[#E11D69] flex items-center justify-center shadow-lg shadow-[#FF7095]/30">
            <span className="material-symbols-outlined text-white text-xl">home</span>
          </div>
          <div>
            <h2 className="font-headline font-bold text-on-surface text-lg leading-snug">
              Save Coach Cass to your Home Screen
            </h2>
            <p className="text-secondary/70 text-sm mt-1">Get instant access — it works like an app</p>
          </div>
        </div>

        {/* Platform-specific steps */}
        <div className="mt-4 rounded-xl bg-surface-container-low border border-outline-variant/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2.5 py-1 rounded-full bg-tertiary/15 border border-tertiary/30 text-tertiary text-[10px] font-label font-bold uppercase tracking-widest">
              {info.label}
            </span>
          </div>
          <ol className="space-y-2.5">
            {info.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-secondary">
                <span className="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-[11px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span className="font-body leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
