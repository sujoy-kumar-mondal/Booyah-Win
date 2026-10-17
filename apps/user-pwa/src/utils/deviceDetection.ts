/**
 * Device detection and download banner eligibility utilities
 *
 * Requirements:
 * 1. Show only to Android browser visitors who are NOT already inside the app.
 * 2. Hide inside installed PWA (display-mode: standalone).
 * 3. Hide inside Trusted Web Activity (TWA: document.referrer starts with android-app://).
 * 4. Hide inside common WebViews (user agent contains "wv").
 * 5. Hide on iOS and desktop.
 * 6. Dismissing hides it for 7 days (stored in localStorage).
 * 7. VITE_APP_DOWNLOAD_URL must be valid HTTPS (if missing/invalid, banner never shown).
 */

export const DOWNLOAD_BANNER_STORAGE_KEY = 'booyah_app_download_dismissed_until';
export const DISMISSAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export interface DeviceDetectionOptions {
  userAgent?: string;
  referrer?: string;
  isStandalone?: boolean;
  dismissedUntil?: number | null;
  downloadUrl?: string | null;
  now?: number;
}

/**
 * Validates that a download URL is non-empty and strictly uses the HTTPS protocol.
 */
export function isValidHttpsDownloadUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Returns true if the user has dismissed the banner within the 7-day window.
 */
export function isBannerDismissed(now: number = Date.now()): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const raw = window.localStorage.getItem(DOWNLOAD_BANNER_STORAGE_KEY);
    if (!raw) return false;
    const expiry = parseInt(raw, 10);
    if (Number.isNaN(expiry)) return false;
    return now < expiry;
  } catch {
    return false;
  }
}

/**
 * Persists the 7-day dismissal timestamp into localStorage.
 */
export function dismissDownloadBanner(now: number = Date.now()): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const expiry = now + DISMISSAL_DURATION_MS;
    window.localStorage.setItem(DOWNLOAD_BANNER_STORAGE_KEY, String(expiry));
  } catch {
    // Graceful fallback if localStorage is disabled or restricted
  }
}

/**
 * Clears dismissal from localStorage (used for resets / testing).
 */
export function clearDownloadBannerDismissal(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(DOWNLOAD_BANNER_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Checks if the current environment is an installed PWA (display-mode: standalone).
 */
export function isPwaStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const matchMediaStandalone =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches;
    const navigatorStandalone =
      typeof navigator !== 'undefined' &&
      'standalone' in navigator &&
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    return Boolean(matchMediaStandalone || navigatorStandalone);
  } catch {
    return false;
  }
}

/**
 * Determines whether the visitor is an Android browser user eligible to see the "Download App" banner.
 */
export function isEligibleAndroidBrowser(options?: DeviceDetectionOptions): boolean {
  const ua =
    options?.userAgent ??
    (typeof navigator !== 'undefined' ? navigator.userAgent || '' : '');
  const referrer =
    options?.referrer ??
    (typeof document !== 'undefined' ? document.referrer || '' : '');
  const standalone = options?.isStandalone ?? isPwaStandalone();
  const now = options?.now ?? Date.now();

  // 1. Download URL validation: must be valid HTTPS
  const downloadUrl =
    options && 'downloadUrl' in options
      ? options.downloadUrl
      : (import.meta.env.VITE_APP_DOWNLOAD_URL as string | undefined);
  if (!isValidHttpsDownloadUrl(downloadUrl)) {
    return false;
  }

  // 2. Platform check: must be Android; hide on iOS, Windows, macOS, Linux desktop, etc.
  // Note: Some desktop user-agents might include Linux, but Android user agents specifically contain "Android".
  // Check that it contains "Android" and does not contain desktop OS identifiers like Windows, Macintosh, or CrOS.
  const isAndroid = /Android/i.test(ua) && !/Windows Phone|Windows NT|Macintosh/i.test(ua);
  if (!isAndroid) {
    return false;
  }

  // 3. Hide inside common WebViews (spec requirement: user agent contains "wv")
  if (ua.toLowerCase().includes('wv')) {
    return false;
  }

  // 4. Hide inside Trusted Web Activity (TWA: document.referrer starts with android-app://)
  if (referrer.startsWith('android-app://')) {
    return false;
  }

  // 5. Hide inside installed PWA (display-mode standalone)
  if (standalone) {
    return false;
  }

  // 6. Hide if dismissed within 7 days
  if (options?.dismissedUntil !== undefined) {
    if (options.dismissedUntil !== null && now < options.dismissedUntil) {
      return false;
    }
  } else if (isBannerDismissed(now)) {
    return false;
  }

  return true;
}
