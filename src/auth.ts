// Auth is owned by the Hominem API (Better Auth). This app holds no credential:
// the browser carries the API's HttpOnly session cookie, and we only ask the API
// who it belongs to. Sign-in and sign-out are the API's hosted pages.
export type AuthUser = { id: string; email: string; name?: string | null };

const API_URL = (import.meta.env.VITE_PUBLIC_API_URL as string | undefined)?.replace(/\/$/, '');

export function apiUrl() {
  if (!API_URL) throw new Error('VITE_PUBLIC_API_URL is not set');
  return API_URL;
}

export async function getSessionUser(): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${apiUrl()}/api/auth/get-session`, { credentials: 'include' });
    if (!res.ok) return null;
    const payload = (await res.json().catch(() => null)) as { session?: unknown; user?: AuthUser | null } | null;
    return payload?.session ? (payload.user ?? null) : null;
  } catch {
    return null;
  }
}

export function redirectToLogin() {
  const next = encodeURIComponent(window.location.href);
  window.location.replace(`${apiUrl()}/login?next=${next}`);
}

// The hosted /logout accepts a form POST and 303s back to `next` once the cookie is cleared.
export function signOut() {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = `${apiUrl()}/logout`;
  const next = document.createElement('input');
  next.type = 'hidden';
  next.name = 'next';
  next.value = window.location.origin;
  form.append(next);
  document.body.append(form);
  form.submit();
}

export function settingsUrl() {
  return `${apiUrl()}/auth/settings`;
}
