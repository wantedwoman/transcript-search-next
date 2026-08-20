const STORAGE_KEY = 'coach-cass-homescreen-dismissed';
const EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Returns true if the user has dismissed the home-screen guide within the
 * last 30 days. Once the marker expires, the guide may re-prompt.
 *
 * Safe to call during SSR (returns false when `window` is unavailable).
 */
export function isHomeScreenDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    if (!Number.isFinite(dismissedAt)) return false;
    return Date.now() - dismissedAt < EXPIRY_MS;
  } catch {
    // localStorage can throw (private mode / storage blocked) — treat as not dismissed
    return false;
  }
}

/**
 * Records that the user dismissed the home-screen guide. The marker
 * automatically expires after 30 days.
 */
export function dismissHomeScreenGuide(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // Ignore storage failures — the guide simply shows again next session.
  }
}
