import { useState, type FormEvent } from 'react';
import { Check } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, TextField } from '@ponti-studios/ui/forms';
import { Button } from '@ponti-studios/ui/primitives';
import { Sheet } from './Sheet';
import { plural } from '../format';
import { DEFAULT_CURRENCY } from '../types';
import type { Group, Item, ItemInput, Status } from '../types';

const STATUSES: Status[] = ['Wanted', 'Planned', 'Ordered', 'Owned'];
const NO_CONTAINER = 'none';

export function ItemSheet({ item, defaults, containers, collections, categories, onSave, onClose }: {
  item?: Item;
  defaults?: Partial<ItemInput>;
  containers: Group[];
  collections: Group[];
  categories: string[];
  onSave: (input: ItemInput) => void;
  onClose: () => void;
}) {
  const start = { ...defaults, ...item };
  const [name, setName] = useState(start.name ?? '');
  const [status, setStatus] = useState<Status>(start.status ?? 'Wanted');
  const [category, setCategory] = useState(start.category ?? '');
  const [value, setValue] = useState(start.value ? String(start.value) : '');
  const [vendor, setVendor] = useState(start.vendor ?? '');
  const [containerId, setContainerId] = useState(start.containerId ?? NO_CONTAINER);
  const currency = start.currency ?? DEFAULT_CURRENCY;
  const [collectionIds, setCollectionIds] = useState<string[]>(start.collectionIds ?? []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const parsed = Number(value);
    onSave({
      name: name.trim(),
      category: category.trim() || 'Uncategorised',
      status,
      value: Number.isFinite(parsed) && parsed > 0 ? parsed : 0,
      currency,
      vendor: vendor.trim() || undefined,
      containerId: containerId === NO_CONTAINER ? undefined : containerId,
      collectionIds,
    });
    onClose();
  };
  const toggle = (id: string) => setCollectionIds((ids) => (ids.includes(id) ? ids.filter((c) => c !== id) : [...ids, id]));
  const choices: Status[] = STATUSES.includes(status) ? STATUSES : [...STATUSES, status];

  return (
    <Sheet title={item ? 'Edit item' : 'Add to your space'} eyebrow={item ? undefined : 'A new thing'} onClose={onClose}>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <TextField label="What is it called?" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. A good reading lamp" />

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Where does it sit in your journey?</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Status">
            {choices.map((s) => (
              <Button type="button" size="sm" key={s} variant={status === s ? 'default' : 'outline'} aria-pressed={status === s} onClick={() => setStatus(s)}>
                {status === s && <Check />} {s}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <TextField label="Category" list="categories" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Kitchen" />
            <datalist id="categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <TextField label={`Value (${currency})`} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" />
        </div>

        <TextField label="Vendor (optional)" value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Where it comes from" />

        {containers.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Container</span>
            <Select value={containerId} onValueChange={(v) => setContainerId(v ?? NO_CONTAINER)}>
              <SelectTrigger className="w-full" aria-label="Container"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CONTAINER}>No container yet</SelectItem>
                {containers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {collections.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Collections</span>
            <div className="flex flex-wrap gap-2">
              {collections.map((c) => (
                <Button type="button" size="sm" key={c.id} variant={collectionIds.includes(c.id) ? 'default' : 'outline'} aria-pressed={collectionIds.includes(c.id)} onClick={() => toggle(c.id)}>
                  {collectionIds.includes(c.id) && <Check />} {c.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground text-xs">{collectionIds.length > 0 ? plural(collectionIds.length, 'collection') : 'One item, for its whole lifecycle.'}</span>
          <Button type="submit" disabled={!name.trim()}>{item ? 'Save changes' : 'Add item'}</Button>
        </div>
      </form>
    </Sheet>
  );
}
