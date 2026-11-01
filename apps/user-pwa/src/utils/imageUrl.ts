import { getApiBaseUrl } from '../api/client.js';

/**
 * Resolves relative file and media URLs into full URLs accessible by both
 * Web browsers and Capacitor Android WebViews.
 */
export function resolveImageUrl(url?: string | null): string {
  if (!url) return '';

  // Already fully-qualified or blob/data URI
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  ) {
    return url;
  }

  const base = getApiBaseUrl();
  const cleanBase = base ? base.replace(/\/+$/, '') : '';

  // If pointing to backend API endpoint (e.g. /api/v1/files/...)
  if (url.startsWith('/api/') || url.startsWith('api/')) {
    const trimmed = url.replace(/^\/+/, '');
    return cleanBase ? `${cleanBase}/${trimmed}` : `/${trimmed}`;
  }

  // If raw uploaded file key (e.g. "c12e41ec.jpg")
  if (!url.startsWith('/')) {
    const fileRoute = `api/v1/files/${url}`;
    return cleanBase ? `${cleanBase}/${fileRoute}` : `/${fileRoute}`;
  }

  // Other absolute paths (e.g. static assets like /assets/...)
  return url;
}

