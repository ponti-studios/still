import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDownUp, ListFilter } from 'lucide-react';
import { Menu } from './Menu';
import { sortItems, type SortKey } from '../derive';
import { money, plural, shortDate } from '../format';
import { prettyCategory } from '../mapping';
import type { Group, Item } from '../types';

export type ItemActions = {
  onEdit: (item: Item) => void;
  onAdvance: (item: Item) => void;
  onArchive: (item: Item) => void;
  onDelete: (item: Item) => void;
};

export function ItemList({ title, items, containers, query, limit, empty, actions, showControls = true }: {
  title: string;
  items: Item[];
  containers: Group[];
  query: string;
  limit?: number;
  empty: ReactNode;
  actions: ItemActions;
  showControls?: boolean;
}) {
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const containerName = (id?: string) => containers.find((c) => c.id === id)?.name;

  const categories = useMemo(() => [...new Set(items.map((i) => i.category))].sort(), [items]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = items.filter(
      (i) =>
        (!category || i.category === category) &&
        (!q || `${i.name} ${i.category} ${i.vendor ?? ''} ${containerName(i.containerId) ?? ''}`.toLowerCase().includes(q)),
    );
    const sorted = sortItems(matches, sort);
    return limit ? sorted.slice(0, limit) : sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, category, query, sort, limit, containers]);

  return (
    <section className="list-section">
      <div className="list-head">
        <div>
          <h2>{title}</h2>
          <span className="muted">{plural(rows.length, 'item')}</span>
        </div>
        {showControls && (
          <div className="list-controls">
            <label className="select-control">
              <ListFilter size={15} aria-hidden="true" />
              <select aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">All categories</option>
                {categories.map((c) => <option key={c} value={c}>{prettyCategory(c)}</option>)}
              </select>
            </label>
            <label className="select-control">
              <ArrowDownUp size={15} aria-hidden="true" />
              <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                <option value="newest">Newest</option>
                <option value="name">Name</option>
                <option value="value">Value</option>
                <option value="status">Status</option>
              </select>
            </label>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="empty">{empty}</div>
      ) : (
        <>
          <div className="table-header" aria-hidden="true">
            <span>ITEM</span><span>STATUS</span><span>CATEGORY</span><span>VALUE</span><span>LOCATION / VENDOR</span><span />
          </div>
          <ul className="rows">
            {rows.map((item) => {
              const where = containerName(item.containerId) ?? item.vendor;
              const archived = item.status === 'Archived';
              return (
                <li className="row" key={item.id}>
                  <div className="cell-item">
                    <div className={`thumb ${item.color}`} aria-hidden="true">{item.icon}</div>
                    <div className="row-main">
                      <b>{item.name}</b>
                      <small className="meta-mobile">{[prettyCategory(item.category), where].filter(Boolean).join(' · ')}</small>
                      <small className="meta-desktop">{item.dated ? `Added ${shortDate(item.date)}` : prettyCategory(item.category)}</small>
                    </div>
                  </div>
                  <div className="cell-status">
                    <button className={`badge ${item.status.toLowerCase()}`} disabled={archived} title={archived ? undefined : 'Move to the next stage'} onClick={() => actions.onAdvance(item)}>
                      <i />{item.status}
                    </button>
                  </div>
                  <div className="cell-cat">{prettyCategory(item.category)}</div>
                  <div className="cell-value">{item.value ? money(item.value, item.currency) : '—'}</div>
                  <div className="cell-loc">{where ?? '—'}</div>
                  <Menu
                    label={`Actions for ${item.name}`}
                    items={[
                      { label: 'Edit', onSelect: () => actions.onEdit(item) },
                      { label: archived ? 'Restore' : 'Archive', onSelect: () => actions.onArchive(item) },
                      { label: 'Delete…', danger: true, onSelect: () => actions.onDelete(item) },
                    ]}
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
