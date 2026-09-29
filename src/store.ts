import { useCallback, useEffect, useState } from 'react';
import { api, type ApiCollection, type ApiCollectionDetail, type ApiContainer, type ApiPossession } from './api';
import { fromContainer, fromPossession, toPossessionPayload } from './mapping';
import { STATUS_PATH, type Group, type GroupKind, type Item, type ItemInput } from './types';

type State = { phase: 'loading' | 'ready' | 'error'; items: Item[]; containers: Group[]; collections: Group[]; error?: string };

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

async function fetchAll(): Promise<Pick<State, 'items' | 'containers' | 'collections'>> {
  const [possessions, containers, collections] = await Promise.all([
    api<{ possessions: ApiPossession[] }>('GET', '/possessions?limit=5000'),
    api<{ containers: ApiContainer[] }>('GET', '/possessions/containers'),
    api<{ collections: ApiCollection[] }>('GET', '/collections?limit=50'),
  ]);
  // Which collections each possession belongs to lives on the collections, so read each one.
  const membership = new Map<string, string[]>();
  await Promise.all(
    collections.collections.map(async (c) => {
      const detail = await api<ApiCollectionDetail>('GET', `/collections/${c.id}`);
      for (const item of detail.items) {
        if (item.entityType === 'possessions') membership.set(item.entityId, [...(membership.get(item.entityId) ?? []), c.id]);
      }
    }),
  );
  return {
    items: possessions.possessions.map((p) => fromPossession(p, membership.get(p.id))),
    containers: containers.containers.map((c) => fromContainer(c, containers.containers)),
    collections: collections.collections.map((c) => ({ id: c.id, name: c.name, icon: '✦', description: c.description ?? '' })),
  };
}

export function useStore() {
  const [state, setState] = useState<State>({ phase: 'loading', items: [], containers: [], collections: [] });
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setState({ phase: 'ready', ...(await fetchAll()) });
    } catch (e) {
      setState((s) => ({ ...s, phase: 'error', error: errorText(e) }));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Optimistic: update the screen now, send the change, and reload from the server if it fails.
  const run = async (optimistic: (s: State) => State, request: () => Promise<unknown>) => {
    setState(optimistic);
    try {
      await request();
    } catch (e) {
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
        setState((s) => ({ ...s, items: [fromPossession(possession, input.collectionIds), ...s.items] }));
      } catch (e) {
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
    deleteItem: (id: string) =>
      run((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) }), () => api('DELETE', `/possessions/${id}`)),
    advance(id: string) {
      const item = state.items.find((i) => i.id === id);
      if (!item || item.status === 'Archived') return Promise.resolve();
      const next = STATUS_PATH[(STATUS_PATH.indexOf(item.status) + 1) % STATUS_PATH.length]!;
      return this.updateItem(id, { status: next });
    },

    async addGroup(kind: GroupKind, data: Pick<Group, 'name' | 'description'>) {
      try {
        if (kind === 'container') {
          const { container } = await api<{ container: ApiContainer }>('POST', '/possessions/containers', data);
          setState((s) => ({ ...s, containers: [...s.containers, fromContainer(container, [container])] }));
        } else {
          const { collection } = await api<{ collection: ApiCollection }>('POST', '/collections', data);
          setState((s) => ({ ...s, collections: [{ id: collection.id, name: collection.name, icon: '✦', description: collection.description ?? '' }, ...s.collections] }));
        }
      } catch (e) {
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
