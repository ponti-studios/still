import { SHOPPING, type Item } from './types';

export function deriveStats(items: Item[], now = new Date()) {
  const month = now.toISOString().slice(0, 7);
  const owned = items.filter((i) => i.status === 'Owned');
  const shopping = items.filter((i) => SHOPPING.includes(i.status));
  const ordered = items.filter((i) => i.status === 'Ordered');
  return {
    owned: owned.length,
    ownedAddedThisMonth: owned.filter((i) => i.dated && i.date.startsWith(month)).length,
    shopping: shopping.length,
    shoppingCategories: new Set(shopping.map((i) => i.category)).size,
    worth: owned.reduce<Record<string, number>>((sum, i) => ({ ...sum, [i.currency]: (sum[i.currency] ?? 0) + i.value }), {}),
    ordered,
    unhomed: owned.filter((i) => !i.containerId).length,
  };
}

export type SortKey = 'newest' | 'name' | 'value' | 'status';

export function sortItems(items: Item[], key: SortKey) {
  const copy = [...items];
  if (key === 'name') return copy.sort((a, b) => a.name.localeCompare(b.name));
  if (key === 'value') return copy.sort((a, b) => b.value - a.value);
  if (key === 'status') return copy.sort((a, b) => a.status.localeCompare(b.status) || a.name.localeCompare(b.name));
  return copy.sort((a, b) => b.date.localeCompare(a.date));
}
