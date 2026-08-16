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
  if (/MacIntel/i.test(navigator.platform) && navigator.maxTouchPoints > 1)
    return 'ios';
  return 'desktop';
}

export default function HomeScreenGuide() {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<Platform>('desktop');

  useEffect(() => {
    if (typeof window === 'undefined') return;
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
          <span className="material-symbols-outlined text-lg">close</span>
        </button>

        {/* Content */}
        <div className="pr-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-[#FF7095] text-xl">
              home_filled
            </span>
            <h3 className="text-base font-headline font-bold text-white leading-tight">
              Save Coach Cass to your Home Screen
            </h3>
          </div>
          <p className="text-sm text-white/70 font-body mb-4 leading-relaxed">
            Get instant access with one tap — no app store needed.
          </p>
          <div className="bg-white/5 rounded-xl border border-white/10 p-4">
            <p className="text-xs font-label font-semibold uppercase tracking-widest text-[#FF7095]/80 mb-2">
              {info.label}
            </p>
            <ol className="space-y-1.5">
              {info.steps.map((step, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-sm text-on-surface font-body leading-relaxed"
                >
                  <span className="text-primary font-label font-semibold shrink-0 min-w-[18px]">
                    {i + 1}.
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
