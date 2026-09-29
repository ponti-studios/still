import { Plus } from 'lucide-react';
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
      <div className="empty">
        <p>{kind === 'container' ? 'Containers are the places your things live: a closet, a shelf, a bag.' : 'Collections group things across places: everyday carry, favourites.'}</p>
        <button className="primary" onClick={onCreate}><Plus size={16} /> Create {kind}</button>
      </div>
    );
  }
  return (
    <section className="group-grid">
      {groups.map((group) => (
        <article className="group-card" key={group.id}>
          <div className="group-card-top">
            <div className="group-icon" aria-hidden="true">{group.icon}</div>
            <Menu label={`Actions for ${group.name}`} items={[
              { label: 'Rename / edit', onSelect: () => onEdit(group) },
              { label: 'Delete…', danger: true, onSelect: () => onDelete(group) },
            ]} />
          </div>
          <button className="group-open" onClick={() => onOpen(group)}>
            <h3>{group.name}</h3>
            {group.description && <p>{group.description}</p>}
            <div className="group-foot"><span>{plural(countIn(kind, group, items), 'item')}</span><span>Open →</span></div>
          </button>
        </article>
      ))}
    </section>
  );
}
