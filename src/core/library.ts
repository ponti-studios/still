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

export const isLibraryPayload = (v: unknown): v is LibraryPayload => {
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

/** The kinds of write the outbox accepts. */
export type OutboxEntity = 'possession' | 'container' | 'collection' | 'membership';
export type OutboxKind = 'create' | 'update' | 'delete';

/**
 * A queued write. `entityId` is this client's own UUID for a create (also sent
 * as `externalId`, so a re-sent op is idempotent) and the server id otherwise.
 * Native applies it to the cache at once and sends it on the next sync.
 */
export type OutboxOp = {
  entity: OutboxEntity;
  kind: OutboxKind;
  entityId: string;
  payload: Record<string, unknown>;
};

/** Queues a write and applies it to the cache immediately. Resolves with the library to show. */
export function enqueueOp(op: OutboxOp): Promise<LibraryPayload> {
  return libraryFrom(() =>
    NativeStill().enqueue(op.entity, op.kind, op.entityId, JSON.stringify(op.payload)),
  );
}

/** Notices raised since the last call (a rolled-back edit), drained each time. */
export async function takeNotices(): Promise<string[]> {
  try {
    const notices = await NativeStill().takeNotices();
    return Array.isArray(notices) ? notices : [];
  } catch (e) {
    throw toApiError(e);
  }
}
