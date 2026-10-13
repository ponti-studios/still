import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { ApiError } from '../src/core/api';
import { useStore, type Store } from '../src/core/store';

const mockApi = jest.fn();

jest.mock('../src/core/api', () => ({
  ApiError: jest.requireActual('../src/core/api').ApiError,
  api: (...args: unknown[]) => mockApi(...args),
}));

const possession = {
  id: 'p1', name: 'Lamp', category: 'home', status: 'owned', isArchived: false,
  acquiredDate: '2025-01-10', priceCents: 1200, currencyCode: 'GBP',
  containerId: null, metadata: {}, createdAt: '2025-01-10T00:00:00Z',
};

function responding() {
  mockApi.mockImplementation((method: string, path: string) => {
    if (path === '/possessions?limit=5000') return Promise.resolve({ possessions: [possession] });
    if (path === '/possessions/containers') return Promise.resolve({ containers: [] });
    if (path === '/collections?limit=50') return Promise.resolve({ collections: [] });
    throw new Error(`unexpected call ${method} ${path}`);
  });
}

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
  beforeEach(() => mockApi.mockReset());

  it('loads items on mount', async () => {
    responding();
    const seen = mount();
    await flush();
    expect(seen.current?.phase).toBe('ready');
    expect(seen.current?.items.map((i) => i.name)).toEqual(['Lamp']);
    expect(seen.current?.items[0]).toMatchObject({ value: 12, currency: 'GBP', status: 'Owned' });
  });

  it('marks other failures as an error with a retry', async () => {
    mockApi.mockRejectedValue(new ApiError('No service', 0));
    const seen = mount();
    await flush();
    expect(seen.current?.phase).toBe('error');
    expect(seen.current?.error).toContain('No service');
  });

  it('skips its own error handling when the session ended', async () => {
    mockApi.mockRejectedValue(new ApiError('Signed out', 401));
    const seen = mount();
    await flush();
    // Native already cleared the account; the screens flip on the state change.
    expect(seen.current?.phase).toBe('loading');
    expect(seen.current?.notice).toBeNull();
  });

  it('adds an item to the top of the list', async () => {
    responding();
    const seen = mount();
    await flush();
    mockApi.mockImplementation((method: string, path: string) => {
      if (method === 'POST' && path === '/possessions') {
        return Promise.resolve({ possession: { ...possession, id: 'p2', name: 'Chair' } });
      }
      throw new Error(`unexpected call ${method} ${path}`);
    });
    await ReactTestRenderer.act(async () => {
      await seen.current?.addItem({
        name: 'Chair', category: 'home', status: 'Owned', value: 30,
        currency: 'GBP', vendor: undefined, containerId: undefined, collectionIds: [],
      });
    });
    expect(seen.current?.items.map((i) => i.name)).toEqual(['Chair', 'Lamp']);
  });
});
