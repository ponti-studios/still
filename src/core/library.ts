import { toApiError } from './api';
import type { ApiCollection, ApiContainer, ApiPossession } from './apiTypes';
import { NativeStill } from '../platform/NativeStill';

/** The whole library, API-shaped, with membership as possession id to collection ids. */
export type LibraryPayload = {
  possessions: ApiPossession[];
  containers: ApiContainer[];
  collections: ApiCollection[];
  membership: Record<string, string[]>;
};

const isLibraryPayload = (v: unknown): v is LibraryPayload => {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    Array.isArray(p.possessions) &&
    Array.isArray(p.containers) &&
    Array.isArray(p.collections) &&
    typeof p.membership === 'object' &&
    p.membership !== null
  );
};

async function libraryFrom(call: () => Promise<unknown>): Promise<LibraryPayload> {
  try {
    const payload = await call();
    if (!isLibraryPayload(payload)) throw new Error('The library could not be read. Please try again.');
    return payload;
  } catch (e) {
    throw toApiError(e);
  }
}

/** Refreshes the on-device cache from Hominem and resolves with it. */
export function syncLibrary(): Promise<LibraryPayload> {
  return libraryFrom(() => NativeStill().syncLibrary());
}

/** The cached library without touching the network. */
export function readLibrary(): Promise<LibraryPayload> {
  return libraryFrom(() => NativeStill().readLibrary());
}
