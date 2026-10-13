import type { Group, GroupKind, Item } from './types';

export function countIn(kind: GroupKind, group: Group, items: Item[]) {
  const live = items.filter((i) => i.status !== 'Archived');
  return live.filter((i) => (kind === 'container' ? i.containerId === group.id : i.collectionIds.includes(group.id))).length;
}
