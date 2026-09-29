import { useState, type FormEvent } from 'react';
import { Check } from 'lucide-react';
import { Sheet } from './Sheet';
import { plural } from '../format';
import { DEFAULT_CURRENCY } from '../types';
import type { Group, Item, ItemInput, Status } from '../types';

const STATUSES: Status[] = ['Wanted', 'Planned', 'Ordered', 'Owned'];

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
  const [containerId, setContainerId] = useState(start.containerId ?? '');
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
      containerId: containerId || undefined,
      collectionIds,
    });
    onClose();
  };
  const toggle = (id: string) => setCollectionIds((ids) => (ids.includes(id) ? ids.filter((c) => c !== id) : [...ids, id]));
  const choices: Status[] = STATUSES.includes(status) ? STATUSES : [...STATUSES, status];

  return (
    <Sheet title={item ? 'Edit item' : 'Add to your space'} eyebrow={item ? undefined : 'A NEW THING'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>What is it called?</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. A good reading lamp" />
        </label>

        <div className="field">
          <span>Where does it sit in your journey?</span>
          <div className="chips" role="group" aria-label="Status">
            {choices.map((s) => (
              <button type="button" key={s} className={status === s ? 'chip chosen' : 'chip'} aria-pressed={status === s} onClick={() => setStatus(s)}>
                {status === s && <Check size={14} />} {s}
              </button>
            ))}
          </div>
        </div>

        <div className="field-row">
          <label className="field">
            <span>Category</span>
            <input list="categories" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Kitchen" />
            <datalist id="categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <label className="field">
            <span>Value ({currency})</span>
            <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" />
          </label>
        </div>

        <label className="field">
          <span>Vendor <em>(optional)</em></span>
          <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Where it comes from" />
        </label>

        {containers.length > 0 && (
          <label className="field">
            <span>Container</span>
            <select value={containerId} onChange={(e) => setContainerId(e.target.value)}>
              <option value="">No container yet</option>
              {containers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}

        {collections.length > 0 && (
          <div className="field">
            <span>Collections</span>
            <div className="chips">
              {collections.map((c) => (
                <button type="button" key={c.id} className={collectionIds.includes(c.id) ? 'chip chosen' : 'chip'} aria-pressed={collectionIds.includes(c.id)} onClick={() => toggle(c.id)}>
                  {collectionIds.includes(c.id) && <Check size={14} />} {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="form-foot">
          <span>{collectionIds.length > 0 ? plural(collectionIds.length, 'collection') : 'One item, for its whole lifecycle.'}</span>
          <button className="primary" type="submit" disabled={!name.trim()}>{item ? 'Save changes' : 'Add item'}</button>
        </div>
      </form>
    </Sheet>
  );
}
