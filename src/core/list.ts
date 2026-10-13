import { sortItems, type SortKey } from './derive';
import type { Group, Item } from './types';

/** The list's rows: category filter, then search across name/category/vendor/container, then sort, then limit. */
export function filterItems(
  items: Item[],
  containers: Group[],
  { query, category, sort, limit }: { query: string; category: string; sort: SortKey; limit?: number },
) {
  const containerName = (id?: string) => containers.find((c) => c.id === id)?.name;
  const q = query.trim().toLowerCase();
  const matches = items.filter(
    (i) =>
      (!category || i.category === category) &&
      (!q || `${i.name} ${i.category} ${i.vendor ?? ''} ${containerName(i.containerId) ?? ''}`.toLowerCase().includes(q)),
  );
  const sorted = sortItems(matches, sort);
  return limit ? sorted.slice(0, limit) : sorted;
}
