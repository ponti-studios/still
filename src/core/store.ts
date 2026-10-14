import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from './api';
import type { ApiPossession } from './apiTypes';
import { type LibraryPayload, readLibrary, syncLibrary } from './library';
import { fromContainer, fromPossession, toPossessionPayload } from './mapping';
import { deleteStoredPhoto } from './photos';
import { STATUS_PATH, type Group, type GroupKind, type Item, type ItemInput } from './types';

type State = { phase: 'loading' | 'ready' | 'error'; items: Item[]; containers: Group[]; collections: Group[]; error?: string };

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
// A 401 means the session ended. Native already cleared the account, so the screens flip to
// sign-in on the state change; the store just skips its own error handling.
const signedOut = (e: unknown) => e instanceof ApiError && e.status === 401;

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
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Optimistic: update the screen now, send the change, then refresh the cache from
  // Hominem (write-through). A failed change reloads, which rolls the screen back.
  const run = async (optimistic: (s: State) => State, request: () => Promise<unknown>) => {
    setState(optimistic);
    try {
      await request();
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
  const syncCollections = (id: string, before: string[], after: string[]) =>
    Promise.all([
      ...after.filter((c) => !before.includes(c)).map((c) => api('POST', `/collections/${c}/items`, { entityType: 'possessions', entityId: id })),
      ...before.filter((c) => !after.includes(c)).map((c) => api('DELETE', `/collections/${c}/items/possessions/${id}`)),
    ]);

  return {
    ...state,
    notice,
    dismissNotice: () => setNotice(null),
    reload: load,

    async addItem(input: ItemInput) {
      try {
        const { possession } = await api<{ possession: ApiPossession }>('POST', '/possessions', toPossessionPayload(input));
        await syncCollections(possession.id, [], input.collectionIds);
        await load();
      } catch (e) {
        if (signedOut(e)) return;
        setNotice(`${errorText(e)} — the item was not added.`);
      }
    },
    updateItem(id: string, patch: Partial<Item>) {
      const current = state.items.find((i) => i.id === id);
      if (!current) return Promise.resolve();
      return run(patchItem(id, patch), async () => {
        const payload = toPossessionPayload(patch);
        if (Object.keys(payload).length) await api('PATCH', `/possessions/${id}`, payload);
        if (patch.collectionIds) await syncCollections(id, current.collectionIds, patch.collectionIds);
      });
    },
    deleteItem: (id: string) => {
      const victim = state.items.find((i) => i.id === id);
      return run((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) }), async () => {
        await api('DELETE', `/possessions/${id}`);
        // Best effort: a surviving file is just an orphan, never user-visible.
        if (victim?.imageUrl) await deleteStoredPhoto(victim.imageUrl);
      });
    },
    advance(id: string) {
      const item = state.items.find((i) => i.id === id);
      if (!item || item.status === 'Archived') return Promise.resolve();
      const next = STATUS_PATH[(STATUS_PATH.indexOf(item.status) + 1) % STATUS_PATH.length]!;
      return this.updateItem(id, { status: next });
    },

    async addGroup(kind: GroupKind, data: Pick<Group, 'name' | 'description'>) {
      try {
        if (kind === 'container') {
          await api('POST', '/possessions/containers', data);
        } else {
          await api('POST', '/collections', data);
        }
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
        () => api('PATCH', kind === 'container' ? `/possessions/containers/${id}` : `/collections/${id}`, data),
      ),
    deleteGroup: (kind: GroupKind, id: string) =>
      run(
        (s) => (kind === 'container'
          ? { ...s, containers: s.containers.filter((g) => g.id !== id), items: s.items.map((i) => (i.containerId === id ? { ...i, containerId: undefined } : i)) }
          : { ...s, collections: s.collections.filter((g) => g.id !== id), items: s.items.map((i) => ({ ...i, collectionIds: i.collectionIds.filter((c) => c !== id) })) }),
        () => api('DELETE', kind === 'container' ? `/possessions/containers/${id}` : `/collections/${id}`),
      ),
  };
}

export type Store = ReturnType<typeof useStore>;
