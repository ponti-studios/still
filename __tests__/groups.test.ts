import { countIn } from '../src/core/groups';
import type { Item } from '../src/core/types';

const item = (o: Partial<Item>): Item => ({ id: 'x', name: 'X', category: 'Misc', status: 'Owned', value: 10, currency: 'GBP', date: '2025-09-01', dated: true, icon: '📦', color: 'sand', collectionIds: [], ...o });

describe('countIn', () => {
  const group = { id: 'g', name: 'G', icon: '📦', description: '' };

  it('counts live items in a container and skips archived ones', () => {
    const items = [item({ id: '1', containerId: 'g' }), item({ id: '2', containerId: 'g', status: 'Archived' }), item({ id: '3' })];
    expect(countIn('container', group, items)).toBe(1);
  });

  it('counts live items in a collection by membership', () => {
    const items = [item({ id: '1', collectionIds: ['g'] }), item({ id: '2', collectionIds: ['g', 'h'] }), item({ id: '3', collectionIds: [] })];
    expect(countIn('collection', group, items)).toBe(2);
  });
});
