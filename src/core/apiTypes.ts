// Hominem API shapes for possessions, containers and collections.
// Ported from the web app's api.ts; the native request transport (Phase 3)
// sends these through HominemAuth's authenticatedRequest instead of fetch.
export type ApiPossession = {
  id: string; name: string; category: string | null; status: string | null; isArchived: boolean;
  acquiredDate: string | null; priceCents: number | null; currencyCode: string | null;
  containerId: string | null; metadata: Record<string, unknown>; createdAt: string;
};
export type ApiContainer = {
  id: string; name: string; containerType: string | null; parentContainerId: string | null;
  description: string | null; metadata: Record<string, unknown>;
};
export type ApiCollection = { id: string; name: string; description: string | null };
export type ApiCollectionDetail = { items: { entityType: string; entityId: string }[] };
