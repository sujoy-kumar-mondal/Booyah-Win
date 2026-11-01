/**
 * Cookie preference manager for Booyah Win language (bw_lang)
 *
 * Requirements:
 * - Cookie name: bw_lang ('en' or 'bn')
 * - Max-Age: 1 year (31,536,000 seconds)
 * - Path=/
 * - SameSite=Lax
 * - Secure on https
 * - Readable by JavaScript (not HttpOnly)
 */

export type SupportedLanguage = 'en' | 'bn';

export const COOKIE_NAME = 'bw_lang';
export const COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60; // 31,536,000s (1 year)

export function getLanguageCookie(): SupportedLanguage | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)bw_lang=(en|bn)(?:;|$)/);
  if (!match) return null;
  const val = match[1];
  return val === 'en' || val === 'bn' ? val : null;
}

export function setLanguageCookie(lang: SupportedLanguage): void {
  if (typeof document === 'undefined') return;
  const isHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:';
  const secureFlag = isHttps ? '; Secure' : '';
  document.cookie = `${COOKIE_NAME}=${lang}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secureFlag}`;
}
