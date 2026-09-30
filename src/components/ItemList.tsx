import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDownUp, ListFilter } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ponti-studios/ui/data-display';
import { EmptyState } from '@ponti-studios/ui/feedback';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ponti-studios/ui/forms';
import { Badge, Card } from '@ponti-studios/ui/primitives';
import { Menu } from './Menu';
import { sortItems, type SortKey } from '../derive';
import { money, plural, shortDate } from '../format';
import { prettyCategory } from '../mapping';
import type { Group, Item, Status } from '../types';

export type ItemActions = {
  onEdit: (item: Item) => void;
  onAdvance: (item: Item) => void;
  onArchive: (item: Item) => void;
  onDelete: (item: Item) => void;
};

// Category names are free text, so real options are prefixed to never collide with the ALL sentinel.
const ALL = 'all';
const catValue = (c: string) => `c:${c}`;
const SORTS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'name', label: 'Name' },
  { value: 'value', label: 'Value' },
  { value: 'status', label: 'Status' },
];

const STATUS_VARIANT: Record<Status, 'default' | 'secondary' | 'outline' | 'ghost'> = {
  Wanted: 'outline', Planned: 'secondary', Ordered: 'default', Delivered: 'default', Owned: 'default', Archived: 'ghost',
};

function StatusBadge({ item, onAdvance }: { item: Item; onAdvance: (item: Item) => void }) {
  const archived = item.status === 'Archived';
  return (
    <button className="rounded disabled:cursor-default" disabled={archived} title={archived ? undefined : 'Move to the next stage'} onClick={() => onAdvance(item)}>
      <Badge variant={STATUS_VARIANT[item.status]}>{item.status}</Badge>
    </button>
  );
}

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
  const [category, setCategory] = useState(ALL);
  const [sort, setSort] = useState<SortKey>('newest');
  const containerName = (id?: string) => containers.find((c) => c.id === id)?.name;

  const categories = useMemo(() => [...new Set(items.map((i) => i.category))].sort(), [items]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = items.filter(
      (i) =>
        (category === ALL || catValue(i.category) === category) &&
        (!q || `${i.name} ${i.category} ${i.vendor ?? ''} ${containerName(i.containerId) ?? ''}`.toLowerCase().includes(q)),
    );
    const sorted = sortItems(matches, sort);
    return limit ? sorted.slice(0, limit) : sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, category, query, sort, limit, containers]);

  const menuFor = (item: Item) => (
    <Menu
      label={`Actions for ${item.name}`}
      items={[
        { label: 'Edit', onSelect: () => actions.onEdit(item) },
        { label: item.status === 'Archived' ? 'Restore' : 'Archive', onSelect: () => actions.onArchive(item) },
        { label: 'Delete…', danger: true, onSelect: () => actions.onDelete(item) },
      ]}
    />
  );
  const thumb = (item: Item, size: string) => (
    <div className={`bg-muted flex shrink-0 items-center justify-center rounded-md ${size}`} aria-hidden="true">{item.icon}</div>
  );

  return (
    <section className="mb-6">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <span className="text-muted-foreground text-sm">{plural(rows.length, 'item')}</span>
        </div>
        {showControls && (
          <div className="flex w-full gap-2 md:w-auto">
            <Select value={category} onValueChange={(v) => setCategory(v ?? ALL)}>
              <SelectTrigger className="flex-1 md:min-w-44 md:flex-none" aria-label="Filter by category">
                <ListFilter aria-hidden="true" /><SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All categories</SelectItem>
                {categories.map((c) => <SelectItem key={c} value={catValue(c)}>{prettyCategory(c)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort((v ?? 'newest') as SortKey)}>
              <SelectTrigger className="flex-1 md:min-w-36 md:flex-none" aria-label="Sort">
                <ArrowDownUp aria-hidden="true" /><SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState variant="dashed" title="Nothing to show">{empty}</EmptyState>
      ) : (
        <>
          <ul className="flex flex-col gap-2 lg:hidden">
            {rows.map((item) => {
              const where = containerName(item.containerId) ?? item.vendor;
              return (
                <li key={item.id}>
                  <Card className="gap-2 py-3 pr-1 pl-3">
                    <div className="flex items-center gap-3">
                      {thumb(item, 'size-11 text-2xl')}
                      <div className="flex min-w-0 flex-1 flex-col">
                        <b className="truncate">{item.name}</b>
                        <small className="text-muted-foreground truncate text-xs">{[prettyCategory(item.category), where].filter(Boolean).join(' · ')}</small>
                      </div>
                      {menuFor(item)}
                    </div>
                    <div className="flex items-center justify-between pr-3">
                      <StatusBadge item={item} onAdvance={actions.onAdvance} />
                      <span className="font-semibold tabular-nums">{item.value ? money(item.value, item.currency) : '—'}</span>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>

          <Card className="hidden gap-0 overflow-hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead><TableHead>Status</TableHead><TableHead>Category</TableHead>
                  <TableHead>Value</TableHead><TableHead>Location / vendor</TableHead><TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {thumb(item, 'size-10 text-xl')}
                        <div className="flex min-w-0 flex-col">
                          <b className="truncate">{item.name}</b>
                          <small className="text-muted-foreground text-xs">{item.dated ? `Added ${shortDate(item.date)}` : prettyCategory(item.category)}</small>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><StatusBadge item={item} onAdvance={actions.onAdvance} /></TableCell>
                    <TableCell className="text-muted-foreground">{prettyCategory(item.category)}</TableCell>
                    <TableCell className="tabular-nums">{item.value ? money(item.value, item.currency) : '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{containerName(item.containerId) ?? item.vendor ?? '—'}</TableCell>
                    <TableCell>{menuFor(item)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </section>
  );
}
