---
title: Status and category mapping
status: Final
labels:
  - architecture
project: Still cross-platform
---

# Status and category mapping

The one vocabulary Still, Hominem, and Possessions agree on (cross-platform
merge, decision 8). Hominem stores one lifecycle; every other spelling is
translated where it enters or leaves, so no screen has to guess.

The table lives in three places because the code does. Keep them in step:

- Hominem (the source): `packages/db/src/services/possessions/status.ts`
- Still, React Native: `src/core/mapping.ts` (`FROM_DB` / `TO_DB`)
- StillCore and the Mac importer: read the canonical values as stored

Each has a test covering every value below.

## Statuses

Hominem stores `status` (snake_case) plus the `is_archived` boolean. The
canonical lifecycle is Still's buying path; the Possessions end states fold onto
it, with the reason kept in the row's metadata (`archivedReason`), never lost.

| Hominem `status` | Still `Status` | `is_archived` | Notes |
|------------------|----------------|---------------|-------|
| `wishlist` | `Wanted` | false | |
| `planned` | `Planned` | false | |
| `ordered` | `Ordered` | false | |
| `delivered` | `Delivered` | false | |
| `owned` | `Owned` | false | |
| `in_use` | `Owned` | false | Possessions' active state; converges on `owned` |
| `retired` | `Archived` | true | `archivedReason: 'retired'` |
| `disposed` | `Archived` | true | `archivedReason: 'disposed'` |
| `donated` | `Archived` | true | `archivedReason: 'donated'` |
| `sold` | `Archived` | true | `archivedReason: 'sold'` |
| anything else | `Owned` | false | an owner-invented value: shown, never hidden, never archived |

Rules:

- **Writes are canonical.** The API maps a legacy status onto the lifecycle
  before it is stored: updating to `in_use` stores `owned`, and an end state
  stores `owned` + `is_archived` and records its reason in metadata.
- **Reads never hide a row.** An unrecognised status renders as `Owned`.
- Nothing is bulk-rewritten. The migration backfills only `is_archived`, so the
  original status value (and therefore the reason) survives on old rows.

## Categories

Categories are managed records on Hominem (`app.possession_categories`), unique
per owner **case-insensitively** (`lower(btrim(name))`). A possession still
carries its own free-text `category`, and that text is the fallback; it is
resolved to the managed record's spelling on write, so `Technology` and
`technology` become one.

- The migration creates one record per existing case-variant and rewrites the
  rows onto the chosen spelling (the most common casing wins).
- `PossessionCategoryRepository.resolve` finds or creates the record on every
  write, so duplicates cannot reappear.
- Clients may keep deriving their list from item text. The managed records are
  the authority; exposing them to the apps (a categories endpoint, and
  `CachedCategory` on StillCore) is stage-2 follow-up.

Both land in migration `20261016160000_possession_categories.sql` (Hominem) —
the archived backfill and the category dedup together.
