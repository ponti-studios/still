---
title: Database and Daily-use UX
status: Todo
priority: 2
labels:
  - product
  - ui
  - persistence
project: Possessions Style Refresh
estimate: 5
blockedBy: [00-product-decisions, 00-app-shell-and-modal]
---

# Database and Daily-use UX

## Implementation note

The Goose possessions normalization migration, lifecycle/archive separation, managed categories, typed money/date storage, provenance separation, quarantine preservation, complete backup packages, and the user-facing Restore Database… flow are implemented. Recent-database bookmarks, background database work, and richer backup feedback remain.

## Goal

Make opening, switching, backing up, and safely operating on databases feel like a native Mac document-based workflow.

## Scope

- Show recent databases in the Open flow and preserve the last valid database.
- Provide clear loading, invalid-schema, read-only, and open-failure states.
- Show the active database name and location in the window/sidebar affordance.
- Add a visible “Back Up Now…” action with success feedback and “Reveal in Finder”.
- Add a visible “Restore Database…” flow that confirms the operation, restores to a new destination, and leaves the active database untouched.
- Explain that image assets are included with backups.
- Validate normalized constraints, category relationships, status values, date values, provenance, and image references before accepting a database.
- Provide safe recovery messaging when a write or backup fails.
- Keep database/file work off the main actor where practical so large databases do not freeze the window.
- Add future bulk operations for table multi-selection: delete, status change, category change, and export.
- Treat archive/unarchive as a separate bulk action from lifecycle status changes.

## Acceptance Criteria

- [ ] Opening an invalid database explains what is wrong and how to recover.
- [ ] Recent/last-used database behavior is visible and predictable.
- [ ] Backup success and failure are visible inline or in a confirmation banner.
- [ ] Backups include database data and associated image assets.
- [ ] Destructive writes always have a recoverable backup path.
- [ ] Destructive writes always have a recoverable backup package and, where safe, an Undo action.
- [ ] Archive is a separate visibility property from lifecycle status.
- [ ] A complete backup package can be restored to explicit database and asset destinations.
- [ ] Large database operations do not block normal window interaction.
