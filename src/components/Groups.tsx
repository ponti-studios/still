import { Plus } from 'lucide-react';
import { EmptyState } from '@ponti-studios/ui/feedback';
import { Button, Card } from '@ponti-studios/ui/primitives';
import { Menu } from './Menu';
import { plural } from '../format';
import type { Group, GroupKind, Item } from '../types';

export function countIn(kind: GroupKind, group: Group, items: Item[]) {
  const live = items.filter((i) => i.status !== 'Archived');
  return live.filter((i) => (kind === 'container' ? i.containerId === group.id : i.collectionIds.includes(group.id))).length;
}

export function GroupGrid({ kind, groups, items, onOpen, onEdit, onDelete, onCreate }: {
  kind: GroupKind;
  groups: Group[];
  items: Item[];
  onOpen: (group: Group) => void;
  onEdit: (group: Group) => void;
  onDelete: (group: Group) => void;
  onCreate: () => void;
}) {
  if (groups.length === 0) {
    return (
      <EmptyState
        variant="dashed"
        title={`No ${kind}s yet`}
        description={kind === 'container' ? 'Containers are the places your things live: a closet, a shelf, a bag.' : 'Collections group things across places: everyday carry, favourites.'}
        action={<Button onClick={onCreate}><Plus /> Create {kind}</Button>}
      />
    );
  }
  return (
    <section className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {groups.map((group) => (
        <Card key={group.id} className="gap-2 p-3">
          <div className="flex items-center justify-between">
            <div className="bg-muted flex size-11 items-center justify-center rounded-md text-2xl" aria-hidden="true">{group.icon}</div>
            <Menu label={`Actions for ${group.name}`} items={[
              { label: 'Rename / edit', onSelect: () => onEdit(group) },
              { label: 'Delete…', danger: true, onSelect: () => onDelete(group) },
            ]} />
          </div>
          <button className="flex flex-col gap-1 rounded-md text-left" onClick={() => onOpen(group)}>
            <h3 className="font-semibold">{group.name}</h3>
            {group.description && <p className="text-muted-foreground text-sm">{group.description}</p>}
            <div className="text-muted-foreground mt-2 flex justify-between border-t pt-2 text-sm">
              <span>{plural(countIn(kind, group, items), 'item')}</span>
              <span className="text-accent-text font-medium">Open →</span>
            </div>
          </button>
        </Card>
      ))}
    </section>
  );
}
