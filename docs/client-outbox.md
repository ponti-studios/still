---
title: Still client outbox
status: Final
labels:
  - architecture
  - sync
project: Still cross-platform
---

# Still client outbox

How an edit made offline reaches Hominem without silent loss. This is the client
half of `docs/sync-contract.md` (in the Hominem repo) and the implementation of
decision 7 in `docs/cross-platform-merge.md`.

There is one implementation, in `StillCore`: `LibraryOutbox.swift` (the op
model and the flush loop) and the outbox section of `StillLibraryStore.swift`
(the durable queue and the optimistic cache). The React Native screens do not
talk to Hominem for writes; they hand ops to the native side through the bridge
(`enqueue` / `takeNotices`) and re-read the cache. The Mac app will use the same
`StillCore` types, so both clients converge identically.

## The op

A queued write is a `LibraryOp`:

| field | meaning |
|-------|---------|
| `id` | this op's UUID, for coalescing only |
| `entity` | `possession` \| `container` \| `collection` \| `membership` |
| `kind` | `create` \| `update` \| `delete` |
| `entityId` | the client's own UUID for a create (sent as `externalId`), the server id otherwise |
| `payload` | the API-shaped request body as JSON text |

Ops are stored in the `CachedOutboxOp` entity and replay in the order they were
made. The order is a monotonic `sequence`, not the timestamp: a create and the
membership that points at it are queued in the same second, and the create must
always go first so its server id can be filled into the ops that follow.

## Lifecycle

1. **Enqueue (offline-friendly).** The screen builds an op and calls the native
   `enqueue`. The store writes it to the outbox and applies it to the cache at
   once, so the edit is visible even with no connection. `readLibrary` then
   serves it.
2. **Coalesce.** Queuing against a target that already has a pending op folds
   into it: an update merges into a pending create; a later delete of a
   never-sent create cancels the op and its cached row. A burst of edits to one
   row stays one request.
3. **Flush.** `syncLibrary` runs the flush first. Ops go in order:
   - create → `POST .../upsert` with the client id as `externalId` (idempotent);
   - update → `PATCH .../{id}`; delete → `DELETE .../{id}`;
   - membership → `POST|DELETE /collections/{id}/items` (idempotent on the server).
4. **Server id.** A create's response carries the real id. The optimistic row
   and every later op that referred to the client id are remapped in one save,
   so a crash cannot leave a half-remapped outbox.
5. **Pull the delta.** Only after a successful flush does the store pull
   `?since=<cursor>`, apply the changed rows and tombstones, then advance the
   cursor to the earliest `serverTime` seen. Pending ops are re-applied on top,
   so a pull never hides an unconfirmed edit.
6. **Rejection.** A 4xx that is not a missing row drops that one op, records a
   notice for the screen, and forces the next pull to be a full one so the
   server's row wins again. The edit is not silently lost and it does not retry
   forever.
7. **Offline / transient.** A network error or 5xx stops the flush with the ops
   intact and throws `noService`; the screens fall back to the cache and the
   next sync retries. No user action is needed.
8. **Reconnect.** Native watches the network (`NWPathMonitor`) and the app's
   return to the foreground. When a connection comes back it syncs on its own —
   flush, then pull — and pushes the refreshed library to the screens, so a
   queued edit lands the moment there is signal, without a reopen or a retry.

## Idempotency

Re-sending an op must not duplicate a row. Possessions, containers and
collections all accept a client `externalId` on an upsert (`POST .../upsert`),
and membership add/remove are naturally idempotent on the server. A repeated
flush therefore updates the same row instead of creating a second one. A
`DELETE` that finds nothing (404) counts as success.

## What is not here

Last-write-wins is honest and version-less: no etags, no 409, no field-level
merge. Concurrent edits to the same row resolve by arrival order at the server.
Tombstone pruning and photo-manifest sync are later tasks.
