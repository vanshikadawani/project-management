/**
 * Centralized API utility for Fern & Foley Project Management System.
 * Supports VITE_API_URL configuration for cross-origin backend deployments
 * as well as same-domain / relative proxy deployments.
 */

const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
   window.location.hostname === '127.0.0.1' ||
   window.location.hostname === '0.0.0.0');

const envUrl = (((import.meta as any).env?.VITE_API_URL || '') as string).trim().replace(/\/$/, '');

// On localhost, always use relative path ("") to route through Vite's local dev server proxy.
// In production, use VITE_API_URL if configured, or same-origin.
export const API_BASE_URL: string = isLocalhost ? '' : envUrl;


/**
 * Returns the fully qualified URL for an API endpoint.
 * @example apiUrl('/api/auth/login') => 'https://project-management-1zps.vercel.app/api/auth/login' (if VITE_API_URL set)
 * @example apiUrl('/api/auth/login') => '/api/auth/login' (if VITE_API_URL not set)
 */
export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!API_BASE_URL) {
    return normalizedPath;
  }
  return `${API_BASE_URL}${normalizedPath}`;
}

/**
 * Enhanced fetch wrapper that:
 * 1. Resolves relative paths to the centralized API_BASE_URL
 * 2. Automatically includes credentials (cookies) for cross-origin session persistence
 * 3. Preserves standard RequestInit options
 */
export async function apiFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? apiUrl(input) : input;
  const method = init?.method || 'GET';
  const startTime = Date.now();

  try {
    const res = await fetch(url, {
      ...init,
      credentials: init?.credentials || 'include',
    });

    const elapsed = Date.now() - startTime;
    if (!res.ok) {
      console.warn(`[API] ${method} ${typeof url === 'string' ? url : (url as any).url} -> ${res.status} (${elapsed}ms)`);
    }

    return res;
  } catch (err: any) {
    const elapsed = Date.now() - startTime;
    console.error(`[API] Network failure: ${method} ${typeof url === 'string' ? url : (url as any).url} (${elapsed}ms):`, err?.message || err);
    throw err;
  }
}

