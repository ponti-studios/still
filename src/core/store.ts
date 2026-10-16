import { useCallback, useEffect, useState } from 'react';
import { ApiError } from './api';
import {
  enqueueOp,
  type LibraryPayload,
  type OutboxOp,
  readLibrary,
  syncLibrary,
  takeNotices,
} from './library';
import { fromContainer, fromPossession, toPossessionPayload } from './mapping';
import { deleteStoredPhoto } from './photos';
import { STATUS_PATH, type Group, type GroupKind, type Item, type ItemInput } from './types';

type State = { phase: 'loading' | 'ready' | 'error'; items: Item[]; containers: Group[]; collections: Group[]; error?: string };

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
// A 401 means the session ended. Native already cleared the account, so the screens flip to
// sign-in on the state change; the store just skips its own error handling.
const signedOut = (e: unknown) => e instanceof ApiError && e.status === 401;

/** A client-generated id for a new row. It doubles as the create's idempotency key. */
function newId(): string {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function fetchAll(): Promise<Pick<State, 'items' | 'containers' | 'collections'>> {
  let lib: LibraryPayload;
  try {
    lib = await syncLibrary();
  } catch (e) {
    if (signedOut(e)) throw e;
    // Offline (or Hominem unreachable): browse what the cache holds. When the
    // cache cannot help, the sync failure is still the story.
    try {
      lib = await readLibrary();
    } catch {
      throw e;
    }
    if (!lib.possessions.length && !lib.containers.length && !lib.collections.length) throw e;
  }
  return {
    items: lib.possessions.map((p) => fromPossession(p, lib.membership[p.id])),
    containers: lib.containers.map((c) => fromContainer(c, lib.containers)),
    collections: lib.collections.map((c) => ({ id: c.id, name: c.name, icon: '✦', description: c.description ?? '' })),
  };
}

export function useStore() {
  const [state, setState] = useState<State>({ phase: 'loading', items: [], containers: [], collections: [] });
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setState({ phase: 'ready', ...(await fetchAll()) });
    } catch (e) {
      if (signedOut(e)) return;
      setState((s) => ({ ...s, phase: 'error', error: errorText(e) }));
    }
    // A rejected edit is rolled back on the native side; its notice surfaces here.
    try {
      const notices = await takeNotices();
      if (notices.length) setNotice(notices.join(' '));
    } catch {
      // A notice is not worth failing the load over.
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Offline-capable: queue the ops (native applies them to the cache at once),
  // then sync. Offline the cache keeps the edits and the next sync sends them,
  // so the screen never asks the person to retry.
  const run = async (optimistic: (s: State) => State, ops: OutboxOp[]) => {
    setState(optimistic);
    try {
      for (const op of ops) await enqueueOp(op);
      await load();
    } catch (e) {
      if (signedOut(e)) return;
      setNotice(`${errorText(e)} — your last change was not saved.`);
      await load();
    }
  };
  const patchItem = (id: string, patch: Partial<Item>) => (s: State): State => ({
    ...s, items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
  });
  // Membership changes are their own ops, keyed on the possession id.
  const membershipOps = (id: string, before: string[], after: string[]): OutboxOp[] => [
    ...after.filter((c) => !before.includes(c)).map((c) => ({
      entity: 'membership' as const, kind: 'create' as const, entityId: id, payload: { collectionId: c },
    })),
    ...before.filter((c) => !after.includes(c)).map((c) => ({
      entity: 'membership' as const, kind: 'delete' as const, entityId: id, payload: { collectionId: c },
    })),
  ];

  return {
    ...state,
    notice,
    dismissNotice: () => setNotice(null),
    reload: load,

    async addItem(input: ItemInput) {
      const id = newId();
      const ops: OutboxOp[] = [
        { entity: 'possession', kind: 'create', entityId: id, payload: { ...toPossessionPayload(input), externalId: id } },
        ...membershipOps(id, [], input.collectionIds),
      ];
      try {
        for (const op of ops) await enqueueOp(op);
        await load();
      } catch (e) {
        if (signedOut(e)) return;
        setNotice(`${errorText(e)} — the item was not added.`);
      }
    },
    updateItem(id: string, patch: Partial<Item>) {
      const current = state.items.find((i) => i.id === id);
      if (!current) return Promise.resolve();
      const payload = toPossessionPayload(patch);
      const ops: OutboxOp[] = [];
      if (Object.keys(payload).length) {
        ops.push({ entity: 'possession', kind: 'update', entityId: id, payload });
      }
      if (patch.collectionIds) ops.push(...membershipOps(id, current.collectionIds, patch.collectionIds));
      return run(patchItem(id, patch), ops);
    },
    deleteItem: (id: string) => {
      const victim = state.items.find((i) => i.id === id);
      const ops: OutboxOp[] = [
        { entity: 'possession', kind: 'delete', entityId: id, payload: {} },
        ...membershipOps(id, victim?.collectionIds ?? [], []),
      ];
      const done = run((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) }), ops);
      // Best effort: a surviving file is just an orphan, never user-visible.
      if (victim?.imageUrl) void deleteStoredPhoto(victim.imageUrl);
      return done;
    },
    advance(id: string) {
      const item = state.items.find((i) => i.id === id);
      if (!item || item.status === 'Archived') return Promise.resolve();
      const next = STATUS_PATH[(STATUS_PATH.indexOf(item.status) + 1) % STATUS_PATH.length]!;
      return this.updateItem(id, { status: next });
    },

    async addGroup(kind: GroupKind, data: Pick<Group, 'name' | 'description'>) {
      const id = newId();
      const op: OutboxOp = {
        entity: kind, kind: 'create', entityId: id, payload: { ...data, externalId: id },
      };
      try {
        await enqueueOp(op);
        await load();
      } catch (e) {
        if (signedOut(e)) return;
        setNotice(`${errorText(e)} — the ${kind} was not created.`);
      }
    },
    updateGroup: (kind: GroupKind, id: string, data: Pick<Group, 'name' | 'description'>) =>
      run(
        (s) => (kind === 'container'
          ? { ...s, containers: s.containers.map((g) => (g.id === id ? { ...g, ...data } : g)) }
          : { ...s, collections: s.collections.map((g) => (g.id === id ? { ...g, ...data } : g)) }),
        [{ entity: kind, kind: 'update', entityId: id, payload: { ...data } }],
      ),
    deleteGroup: (kind: GroupKind, id: string) =>
      run(
        (s) => (kind === 'container'
          ? { ...s, containers: s.containers.filter((g) => g.id !== id), items: s.items.map((i) => (i.containerId === id ? { ...i, containerId: undefined } : i)) }
          : { ...s, collections: s.collections.filter((g) => g.id !== id), items: s.items.map((i) => ({ ...i, collectionIds: i.collectionIds.filter((c) => c !== id) })) }),
        [{ entity: kind, kind: 'delete', entityId: id, payload: {} }],
      ),
  };
}

export type Store = ReturnType<typeof useStore>;
