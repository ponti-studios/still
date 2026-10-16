import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { ApiError } from '../src/core/api';
import type { LibraryPayload } from '../src/core/library';
import { useStore, type Store } from '../src/core/store';

const mockEnqueue = jest.fn();
const mockSync = jest.fn();
const mockRead = jest.fn();
const mockNotices = jest.fn();
const mockDeleteStoredPhoto = jest.fn();
const mockOnLibraryChanged = jest.fn();

jest.mock('../src/core/api', () => ({
  ApiError: jest.requireActual('../src/core/api').ApiError,
}));

jest.mock('../src/core/library', () => ({
  isLibraryPayload: (v: unknown) => {
    const p = v as Record<string, unknown> | null;
    return (
      typeof p === 'object' &&
      p !== null &&
      Array.isArray(p.possessions) &&
      Array.isArray(p.containers) &&
      Array.isArray(p.collections) &&
      typeof p.membership === 'object' &&
      p.membership !== null
    );
  },
  syncLibrary: (...args: unknown[]) => mockSync(...args),
  readLibrary: (...args: unknown[]) => mockRead(...args),
  enqueueOp: (...args: unknown[]) => mockEnqueue(...args),
  takeNotices: (...args: unknown[]) => mockNotices(...args),
}));

jest.mock('../src/platform/NativeStill', () => ({
  onLibraryChanged: (...args: unknown[]) => mockOnLibraryChanged(...args),
}));

jest.mock('../src/core/photos', () => ({
  savePhoto: jest.fn(),
  photoFilename: jest.fn(),
  deleteStoredPhoto: (...args: unknown[]) => mockDeleteStoredPhoto(...args),
}));

const possession = {
  id: 'p1', name: 'Lamp', category: 'home', status: 'owned', isArchived: false,
  acquiredDate: '2025-01-10', priceCents: 1200, currencyCode: 'GBP',
  containerId: null, metadata: {}, createdAt: '2025-01-10T00:00:00Z',
};

const library = (overrides: Partial<LibraryPayload> = {}): LibraryPayload => ({
  possessions: [possession],
  containers: [],
  collections: [],
  membership: {},
  ...overrides,
});

const emptyLibrary: LibraryPayload = { possessions: [], containers: [], collections: [], membership: {} };

function mount() {
  const seen: { current?: Store } = {};
  function Probe() {
    const store = useStore();
    React.useEffect(() => {
      seen.current = store;
    });
    return null;
  }
  ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<Probe />);
  });
  return seen;
}

async function flush() {
  await ReactTestRenderer.act(async () => undefined);
}

describe('useStore', () => {
  beforeEach(() => {
    mockEnqueue.mockReset();
    mockSync.mockReset();
    mockRead.mockReset();
    mockNotices.mockReset();
    mockDeleteStoredPhoto.mockReset();
    mockOnLibraryChanged.mockReset();
    mockSync.mockResolvedValue(library());
    mockRead.mockRejectedValue(new Error('no cache'));
    mockEnqueue.mockResolvedValue(library());
    mockNotices.mockResolvedValue([]);
    mockOnLibraryChanged.mockReturnValue({ remove: jest.fn() });
  });

  it('loads items on mount', async () => {
    const seen = mount();
    await flush();
    expect(seen.current?.phase).toBe('ready');
    expect(seen.current?.items.map((i) => i.name)).toEqual(['Lamp']);
    expect(seen.current?.items[0]).toMatchObject({ value: 12, currency: 'GBP', status: 'Owned' });
  });

  it('serves the cache when the sync fails', async () => {
    mockSync.mockRejectedValue(new ApiError('No service', 0));
    mockRead.mockResolvedValue(library());
    const seen = mount();
    await flush();
    expect(seen.current?.phase).toBe('ready');
    expect(seen.current?.items.map((i) => i.name)).toEqual(['Lamp']);
  });

  it('marks failures as an error with a retry when the cache is empty', async () => {
    mockSync.mockRejectedValue(new ApiError('No service', 0));
    mockRead.mockResolvedValue(emptyLibrary);
    const seen = mount();
    await flush();
    expect(seen.current?.phase).toBe('error');
    expect(seen.current?.error).toContain('No service');
  });

  it('skips its own error handling when the session ended', async () => {
    mockSync.mockRejectedValue(new ApiError('Signed out', 401));
    const seen = mount();
    await flush();
    // Native already cleared the account; the screens flip on the state change.
    expect(seen.current?.phase).toBe('loading');
    expect(seen.current?.notice).toBeNull();
    expect(mockRead).not.toHaveBeenCalled();
  });

  it('shows a notice from the native outbox', async () => {
    mockNotices.mockResolvedValue([
      'A change couldn’t be saved and was undone. Pull to refresh.',
    ]);
    const seen = mount();
    await flush();
    expect(seen.current?.notice).toContain('couldn’t be saved');
  });

  it('queues a new item and its collection links', async () => {
    mockSync.mockResolvedValue(emptyLibrary);
    const seen = mount();
    await flush();
    mockSync.mockResolvedValue(library({ possessions: [{ ...possession, id: 'p2', name: 'Chair' }] }));

    await ReactTestRenderer.act(async () => {
      await seen.current?.addItem({
        name: 'Chair', category: 'home', status: 'Owned', value: 30,
        currency: 'GBP', vendor: undefined, containerId: undefined, collectionIds: ['c1'],
      });
    });

    const create = mockEnqueue.mock.calls.find(([op]) => op.entity === 'possession')?.[0];
    expect(create).toMatchObject({
      entity: 'possession', kind: 'create', payload: { name: 'Chair', externalId: create.entityId },
    });
    const membership = mockEnqueue.mock.calls.find(([op]) => op.entity === 'membership')?.[0];
    expect(membership).toMatchObject({
      entity: 'membership', kind: 'create', entityId: create.entityId, payload: { collectionId: 'c1' },
    });
    expect(seen.current?.items.map((i) => i.name)).toEqual(['Chair']);
  });

  it('queues an edit and updates the screen at once', async () => {
    const seen = mount();
    await flush();

    await ReactTestRenderer.act(async () => {
      await seen.current?.updateItem('p1', { name: 'Desk Lamp' });
    });

    const update = mockEnqueue.mock.calls.find(([op]) => op.kind === 'update')?.[0];
    expect(update).toMatchObject({
      entity: 'possession', kind: 'update', entityId: 'p1', payload: { name: 'Desk Lamp' },
    });
  });

  it('queues a delete and clears the photo file', async () => {
    mockSync.mockResolvedValue(
      library({ possessions: [{ ...possession, metadata: { imageUrl: 'file:///stored/x.jpg' } }] }),
    );
    mockDeleteStoredPhoto.mockResolvedValue(undefined);
    const seen = mount();
    await flush();
    mockSync.mockResolvedValue(emptyLibrary);

    await ReactTestRenderer.act(async () => {
      await seen.current?.deleteItem('p1');
    });

    expect(seen.current?.items).toEqual([]);
    expect(mockDeleteStoredPhoto).toHaveBeenCalledWith('file:///stored/x.jpg');
    const del = mockEnqueue.mock.calls.find(([op]) => op.kind === 'delete')?.[0];
    expect(del).toMatchObject({ entity: 'possession', kind: 'delete', entityId: 'p1' });
  });

  it('skips file cleanup when the item has no photo', async () => {
    const seen = mount();
    await flush();
    mockSync.mockResolvedValue(emptyLibrary);

    await ReactTestRenderer.act(async () => {
      await seen.current?.deleteItem('p1');
    });

    expect(mockDeleteStoredPhoto).not.toHaveBeenCalled();
  });

  it('applies a library native pushes after the network returns', async () => {
    const seen = mount();
    await flush();
    const listener = mockOnLibraryChanged.mock.calls[0]?.[0] as (e: unknown) => void;
    expect(typeof listener).toBe('function');

    await ReactTestRenderer.act(async () => {
      listener({
        library: library({ possessions: [{ ...possession, id: 'p9', name: 'AirPods Pro 3' }] }),
        notices: ['A change couldn’t be saved and was undone.'],
      });
    });

    expect(seen.current?.phase).toBe('ready');
    expect(seen.current?.items.map((i) => i.name)).toEqual(['AirPods Pro 3']);
    expect(seen.current?.notice).toContain('couldn’t be saved');
  });
});
