---
title: The Mac app on StillCore
status: Final
labels:
  - architecture
  - mac
  - sync
project: Still cross-platform
---

# The Mac app on StillCore

Task 008 of the cross-platform merge. The Mac app stopped talking to SQLite
directly and started talking to Hominem through the same client the iOS app
uses. One domain core, two front ends.

## The shape of it

```
Hominem (source of truth)
   ▲
   │  delta pull (?since=, tombstones)      writes: /api/possessions/{upsert,:id}
   │
StillCore   StillLibraryStore (Core Data cache)   LibraryOutbox   LibrarySync
   ▲                                     │
   │  readLibrary() → cache rows         │  enqueue(entity:kind:entityId:payload:)
   │                                     │
macos/  PossessionsStore ── PossessionCache ── → Possession (the view model)
             │                                     │
             └── SwiftUI views ────────────────────┘
```

- **Reads** render the cache. `PossessionsStore.reload()` calls
  `StillAccount.readLibrary()` and maps each row with
  `PossessionCache.possession(from:)`. No network, so the list draws instantly,
  signed in or not, online or not.
- **Writes** are queued, not sent. Save and delete build the API request body
  (`PossessionCache.writePayload(for:)`), hand it to
  `StillAccount.enqueue(...)`, and re-read the cache — the optimistic row shows
  at once. `StillAccount.syncLibrary()` then flushes the outbox and pulls the
  delta.
- **Sync points** are launch, every write, ⌘R, and returning to the app. The
  sidebar footer shows the same four states as iOS: `All changes saved`,
  `N changes syncing…`, `N waiting — offline`, `Offline — showing saved data`.
- **Sign-in** is `StillAccount` — the same state machine, the same Keychain
  service (`io.ponti.still.hominem`), and therefore the same Hominem account as
  the phone. The Mac app draws its own small form; `SignInView` is a view over
  `StillAccountState`, not a second session.

## Fields Hominem does not model

Hominem models name, status, archive, dates, prices, brand, model, category,
sub-category, serial, size, colour, placement, notes, url, container and a
`metadata` object. The Mac editor shows more than that, so the rest lives in
`metadata` rather than being dropped:

| Mac field | metadata key |
|-----------|--------------|
| Artist | `artist` |
| Type | `possessionType` |
| Net value | `netValueCents` |
| Daily cost | `dailyCostCents` |
| Days owned | `daysOwned` |
| Amount, unit | `amount`, `amountUnit` |
| Source table, row | `importedFrom`, `sourceRowId` |
| Photos | `imageUrl` (shared with React Native) |

Two rules keep this honest:

- The metadata text the editor shows starts as the person's own JSON, so an
  unfamiliar key (`vendor`, or one a later version adds) survives an edit.
- The form fields win for the keys they own. Editing a value in the metadata
  box that also has a field will not persist — the field is the source.

An edit whose metadata text is not a JSON object is refused with a message; it
is never silently replaced.

## Status and categories

The Mac app now speaks the canonical lifecycle — Wanted, Planned, Ordered,
Delivered, Owned — with archive as the separate flag, per
[`status-category-mapping.md`](status-category-mapping.md). The mapping table
(`PossessionStatusMapping`) translates the stored values in both directions, so
a row written by Possessions (`in_use`, `retired`, `disposed`) reads correctly
and a Mac write stores the canonical value. A test covers every row of that
table.

Categories stay managed records on Hominem: a write sends the category's name
and `PossessionCategoryRepository.resolve` finds or creates the one record, so
`Technology` and `technology` are one category. `LibrarySync` pulls the whole
set from `GET /api/possessions/categories` each sync into `CachedCategory`, and
it rides back on the library payload, so the Mac offers every managed category —
including one no item uses yet. The pull is best effort: a server without the
endpoint (or a blip) keeps the list already cached instead of failing the sync.
The Mac also falls back to the categories its items use, for a client that has
not pulled yet.

## Backup and quarantine, re-decided

This task changes the reason the backup existed, so the decision is recorded
here rather than left implied.

- **Before:** the app wrote SQLite directly, so it took a recoverable snapshot
  (`VACUUM INTO` plus the asset sidecar) before the first destructive write of
  each session, and quarantined rows that failed schema validation.
- **After:** the app does not write SQLite at runtime at all. A failed edit is
  Hominem's to refuse, and the outbox already handles that: a 4xx rolls the one
  op back, keeps the rest, and tells the person. A local snapshot no longer
  protects anything, so the runtime backup is gone.
- **Where those duties live now:** the one-way importer
  ([task 009](../../.opencode/plan/009-sqlite-importer-one-way.md)) takes the
  backup before it reads, and quarantines rows that fail validation. That is the
  only SQLite write path left. `SQLiteDatabase`, `PossessionsRepository` and
  `BackupManager` stay in `StillMacCore` for it, and its tests still pass.

## Photos

Unchanged by this task. Item photos stay on the device
(`~/Documents/possessions/<possession-id>/`) and the row carries their paths in
`metadata.imageUrl`. The shared iCloud container and the manifest
([tasks 010–011](../../.opencode/plan/)) are where bytes start crossing devices;
until then a path written on the phone will not resolve on the Mac. The Mac
already ignores a path whose file is missing rather than showing a broken image.

## What to watch

- A rejected write pulls everything from the epoch, which is a full re-read. It
  is rare and the upserts are idempotent, but it is the expensive path.
- The Mac does not yet watch the network path on its own, so a queue left while
  offline waits for the next sync point (a write, ⌘R, or coming back to the app)
  rather than flushing the moment the connection returns.
