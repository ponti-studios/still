import { deriveStats, sortItems } from '../src/core/derive';
import { filterItems } from '../src/core/list';
import type { Item } from '../src/core/types';

const item = (o: Partial<Item>): Item => ({ id: 'x', name: 'X', category: 'Misc', status: 'Owned', value: 10, currency: 'GBP', date: '2025-09-01', dated: true, icon: '📦', color: 'sand', collectionIds: [], ...o });

describe('filterItems', () => {
  const items = [
    item({ id: '1', name: 'Lamp', category: 'home', vendor: 'Ikea', date: '2025-09-10' }),
    item({ id: '2', name: 'Chair', category: 'home', containerId: 'c1', date: '2025-09-12' }),
    item({ id: '3', name: 'Novel', category: 'books', date: '2025-09-11' }),
  ];
  const containers = [{ id: 'c1', name: 'Closet', icon: '📦', description: '' }];

  it('filters by category then searches across name, vendor and container', () => {
    expect(filterItems(items, containers, { query: '', category: 'home', sort: 'newest' }).map((i) => i.id)).toEqual(['2', '1']);
    expect(filterItems(items, containers, { query: 'ikea', category: '', sort: 'newest' }).map((i) => i.id)).toEqual(['1']);
    expect(filterItems(items, containers, { query: 'closet', category: '', sort: 'newest' }).map((i) => i.id)).toEqual(['2']);
    expect(filterItems(items, containers, { query: 'novel', category: 'home', sort: 'newest' })).toEqual([]);
  });

  it('sorts and limits', () => {
    expect(filterItems(items, containers, { query: '', category: '', sort: 'name', limit: 2 }).map((i) => i.id)).toEqual(['2', '1']);
  });

  it('does not mutate the input', () => {
    const before = items.map((i) => i.id);
    filterItems(items, containers, { query: '', category: '', sort: 'value' });
    expect(items.map((i) => i.id)).toEqual(before);
  });
});

describe('deriveStats edge', () => {
  it('handles an empty shelf', () => {
    const s = deriveStats([], new Date('2025-09-29T12:00:00Z'));
    expect(s).toMatchObject({ owned: 0, shopping: 0, unhomed: 0, worth: {} });
    expect(sortItems([], 'newest')).toEqual([]);
  });
});
