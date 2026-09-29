import { describe, expect, it } from 'vitest';
import { deriveStats, sortItems } from './derive';
import type { Item } from './types';

const item = (o: Partial<Item>): Item => ({ id: 'x', name: 'X', category: 'Misc', status: 'Owned', value: 10, currency: 'GBP', date: '2025-09-01', dated: true, icon: '📦', color: 'sand', collectionIds: [], ...o });

describe('deriveStats', () => {
  const now = new Date('2025-09-29T12:00:00Z');
  const items = [
    item({ id: '1', value: 100, date: '2025-09-10' }),
    item({ id: '2', value: 50, date: '2025-08-10', containerId: 'c' }),
    item({ id: '3', status: 'Wanted', category: 'A' }),
    item({ id: '4', status: 'Ordered', category: 'B' }),
    item({ id: '5', status: 'Archived' }),
  ];
  it('computes counts from real items', () => {
    const s = deriveStats(items, now);
    expect(s).toMatchObject({ owned: 2, ownedAddedThisMonth: 1, shopping: 2, shoppingCategories: 2, worth: { GBP: 150 }, unhomed: 1 });
    expect(s.ordered.map((i) => i.id)).toEqual(['4']);
  });
});

describe('deriveStats currencies', () => {
  it('totals owned value per currency instead of mixing them', () => {
    const s = deriveStats([item({ id: '1', value: 100 }), item({ id: '2', value: 50, currency: 'USD' }), item({ id: '3', value: 5, currency: 'USD' })]);
    expect(s.worth).toEqual({ GBP: 100, USD: 55 });
  });
  it('does not count undated (imported) items as added this month', () => {
    const s = deriveStats([item({ id: '1', date: '2025-09-15' }), item({ id: '2', date: '2025-09-15', dated: false })], new Date('2025-09-29T12:00:00Z'));
    expect(s.ownedAddedThisMonth).toBe(1);
  });
});

describe('sortItems', () => {
  it('sorts by value descending and does not mutate', () => {
    const list = [item({ id: 'a', value: 1 }), item({ id: 'b', value: 9 })];
    expect(sortItems(list, 'value').map((i) => i.id)).toEqual(['b', 'a']);
    expect(list[0]!.id).toBe('a');
  });
});
