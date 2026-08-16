/**
 * CC-11 · Home Screen Guide dismissal persistence.
 * Stores per-user dismissal state in localStorage with a 30-day expiry
 * so the guide re-prompts after a reasonable period.
 */

const DISMISS_KEY = 'coachcass_homescreen_dismissed';
const EXPIRY_DAYS = 30;

export function isHomeScreenDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(DISMISS_KEY);
  if (!stored) return false;
  try {
    const { timestamp } = JSON.parse(stored) as { timestamp: number };
    return Date.now() - timestamp < EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function dismissHomeScreenGuide(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(
    DISMISS_KEY,
    JSON.stringify({ timestamp: Date.now() }),
  );
}
