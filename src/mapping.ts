import type { ApiContainer, ApiPossession } from './api';
import { DEFAULT_CURRENCY, type Group, type Item, type ItemInput, type Status } from './types';

const FROM_DB: Record<string, Status> = {
  wishlist: 'Wanted', planned: 'Planned', ordered: 'Ordered', delivered: 'Delivered',
  owned: 'Owned', in_use: 'Owned', retired: 'Archived', disposed: 'Archived',
};
const TO_DB: Record<Exclude<Status, 'Archived'>, string> = {
  Wanted: 'wishlist', Planned: 'planned', Ordered: 'ordered', Delivered: 'delivered', Owned: 'owned',
};

const ICONS: [RegExp, string][] = [
  [/tech|electronic|computer/, '💻'], [/apparel|cloth/, '👕'], [/footwear|shoe/, '👟'], [/accessor|jewel/, '⌚'],
  [/art|collect|book/, '🎨'], [/kitchen|home|furnit/, '🪑'], [/photo|camera/, '📷'], [/travel|luggage|bag/, '🧳'],
  [/personal_care|beauty|health/, '🧴'], [/outdoor|sport/, '🧥'], [/station|office/, '📓'],
];
const COLORS = ['sand', 'blue', 'yellow', 'green', 'pink', 'lavender', 'peach', 'mint'];

export function iconFor(category: string) {
  return ICONS.find(([test]) => test.test(category.toLowerCase()))?.[1] ?? '📦';
}
export function colorFor(category: string) {
  const sum = [...category].reduce((total, ch) => total + ch.charCodeAt(0), 0);
  return COLORS[sum % COLORS.length]!;
}
export const prettyCategory = (category: string) => {
  const text = category.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export function fromPossession(p: ApiPossession, collectionIds: string[] = []): Item {
  const category = p.category ?? 'Uncategorised';
  const vendor = typeof p.metadata.vendor === 'string' ? p.metadata.vendor : undefined;
  return {
    id: p.id,
    name: p.name,
    category,
    status: p.isArchived ? 'Archived' : (p.status ? FROM_DB[p.status] : undefined) ?? 'Owned',
    value: (p.priceCents ?? 0) / 100,
    currency: p.currencyCode ?? DEFAULT_CURRENCY,
    date: p.acquiredDate ?? p.createdAt.slice(0, 10),
    dated: Boolean(p.acquiredDate) || !p.metadata.importedFrom,
    icon: iconFor(category),
    color: colorFor(category),
    ...(vendor ? { vendor } : {}),
    ...(p.containerId ? { containerId: p.containerId } : {}),
    collectionIds,
  };
}

// Only the fields present in `patch` are sent, so an edit never overwrites what it didn't touch.
export function toPossessionPayload(patch: Partial<ItemInput>, existingMetadata: Record<string, unknown> = {}) {
  const payload: Record<string, unknown> = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.category !== undefined) payload.category = patch.category;
  if (patch.value !== undefined) payload.priceCents = Math.round(patch.value * 100);
  if (patch.currency !== undefined) payload.currencyCode = patch.currency;
  if ('containerId' in patch) payload.containerId = patch.containerId ?? null;
  if (patch.vendor !== undefined) payload.metadata = { ...existingMetadata, vendor: patch.vendor };
  if (patch.status !== undefined) {
    if (patch.status === 'Archived') payload.isArchived = true;
    else {
      payload.isArchived = false;
      payload.status = TO_DB[patch.status];
    }
  }
  return payload;
}

const CONTAINER_ICONS: Record<string, string> = { suitcase: '🧳', backpack: '🎒', pouch: '👝', tote_bag: '👜', box: '📦', bag: '🛍️' };

export function fromContainer(c: ApiContainer, all: ApiContainer[]): Group {
  const parent = all.find((other) => other.id === c.parentContainerId);
  const detail = [c.containerType?.replace(/_/g, ' '), parent ? `in ${parent.name}` : null].filter(Boolean).join(' · ');
  return {
    id: c.id,
    name: c.name,
    icon: CONTAINER_ICONS[c.containerType ?? ''] ?? '📦',
    description: c.description ?? detail,
    ...(c.parentContainerId ? { parentId: c.parentContainerId } : {}),
  };
}
