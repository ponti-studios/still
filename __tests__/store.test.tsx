import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { ApiError } from '../src/core/api';
import type { LibraryPayload } from '../src/core/library';
import { useStore, type Store } from '../src/core/store';

const mockApi = jest.fn();
const mockSync = jest.fn();
const mockRead = jest.fn();
const mockDeleteStoredPhoto = jest.fn();

jest.mock('../src/core/api', () => ({
  ApiError: jest.requireActual('../src/core/api').ApiError,
  api: (...args: unknown[]) => mockApi(...args),
}));

jest.mock('../src/core/library', () => ({
  syncLibrary: (...args: unknown[]) => mockSync(...args),
  readLibrary: (...args: unknown[]) => mockRead(...args),
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
    mockApi.mockReset();
    mockSync.mockReset();
    mockRead.mockReset();
    mockDeleteStoredPhoto.mockReset();
    mockSync.mockResolvedValue(library());
    mockRead.mockRejectedValue(new Error('no cache'));
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

  it('adds an item and refreshes from the cache', async () => {
    const seen = mount();
    await flush();
    mockApi.mockImplementation((method: string, path: string) => {
      if (method === 'POST' && path === '/possessions') {
        return Promise.resolve({ possession: { ...possession, id: 'p2', name: 'Chair' } });
      }
      throw new Error(`unexpected call ${method} ${path}`);
    });
    mockSync.mockResolvedValue(
      library({ possessions: [{ ...possession, id: 'p2', name: 'Chair' }, possession] }),
    );
    await ReactTestRenderer.act(async () => {
      await seen.current?.addItem({
        name: 'Chair', category: 'home', status: 'Owned', value: 30,
        currency: 'GBP', vendor: undefined, containerId: undefined, collectionIds: [],
      });
    });
    expect(seen.current?.items.map((i) => i.name)).toEqual(['Chair', 'Lamp']);
  });

  it('deletes the photo file with the item', async () => {
    mockSync.mockResolvedValue(
      library({ possessions: [{ ...possession, metadata: { imageUrl: 'file:///stored/x.jpg' } }] }),
    );
    mockApi.mockImplementation((method: string, path: string) => {
      if (method === 'DELETE' && path === '/possessions/p1') return Promise.resolve({});
      throw new Error(`unexpected call ${method} ${path}`);
    });
    mockDeleteStoredPhoto.mockResolvedValue(undefined);
    const seen = mount();
    await flush();
    mockSync.mockResolvedValue(emptyLibrary);
    await ReactTestRenderer.act(async () => {
      await seen.current?.deleteItem('p1');
    });
    expect(seen.current?.items).toEqual([]);
    expect(mockDeleteStoredPhoto).toHaveBeenCalledWith('file:///stored/x.jpg');
  });

  it('skips file cleanup when the item has no photo', async () => {
    const seen = mount();
    await flush();
    mockApi.mockImplementation((method: string, path: string) => {
      if (method === 'DELETE' && path === '/possessions/p1') return Promise.resolve({});
      throw new Error(`unexpected call ${method} ${path}`);
    });
    mockSync.mockResolvedValue(emptyLibrary);
    await ReactTestRenderer.act(async () => {
      await seen.current?.deleteItem('p1');
    });
    expect(mockDeleteStoredPhoto).not.toHaveBeenCalled();
  });
});
