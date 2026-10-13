export type Status = 'Owned' | 'Wanted' | 'Planned' | 'Ordered' | 'Delivered' | 'Archived';
export type GroupKind = 'container' | 'collection';

export type Item = {
  id: string;
  name: string;
  category: string;
  status: Status;
  value: number;
  currency: string;
  date: string;
  // False when `date` is only a fallback (e.g. an imported item with no acquired date).
  dated: boolean;
  icon: string;
  color: string;
  vendor?: string;
  containerId?: string;
  collectionIds: string[];
};

// Containers (where a thing physically sits) and collections (how you group things) share a shape.
export type Group = { id: string; name: string; icon: string; description: string; parentId?: string };

export type ItemInput = Pick<Item, 'name' | 'category' | 'status' | 'value' | 'currency' | 'vendor' | 'containerId' | 'collectionIds'>;

export const STATUS_PATH: Status[] = ['Wanted', 'Planned', 'Ordered', 'Delivered', 'Owned'];
export const SHOPPING: Status[] = ['Wanted', 'Planned', 'Ordered'];
export const DEFAULT_CURRENCY = 'GBP';
