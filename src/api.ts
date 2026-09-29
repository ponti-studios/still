import { apiUrl, redirectToLogin } from './auth';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

// Every call carries the Hominem session cookie; a 401 means the session ended, so sign in again.
export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${apiUrl()}/api${path}`, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401) {
    redirectToLogin();
    throw new ApiError('Signed out', 401);
  }
  const data = (await res.json().catch(() => null)) as (T & { message?: string; error?: string }) | null;
  if (!res.ok) throw new ApiError(data?.message ?? data?.error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}

export type ApiPossession = {
  id: string; name: string; category: string | null; status: string | null; isArchived: boolean;
  acquiredDate: string | null; priceCents: number | null; currencyCode: string | null;
  containerId: string | null; metadata: Record<string, unknown>; createdAt: string;
};
export type ApiContainer = {
  id: string; name: string; containerType: string | null; parentContainerId: string | null;
  description: string | null; metadata: Record<string, unknown>;
};
export type ApiCollection = { id: string; name: string; description: string | null };
export type ApiCollectionDetail = { items: { entityType: string; entityId: string }[] };
