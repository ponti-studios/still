---
title: Plan Interrogation and Product Risks
status: Approved
priority: 1
labels:
  - product
  - architecture
  - qa
project: Possessions Style Refresh
estimate: 2
blockedBy: [00-product-decisions]
---

# Plan Interrogation and Product Risks

This ticket records the questions that could otherwise make the backlog internally inconsistent. Resolve these before polishing individual screens.

## Questions and decisions

### Is a sheet the right detail pattern on macOS?

Yes for this product because the inventory workspace is the primary task and the user explicitly wants a Maps-like focused inspection surface. The sheet must remain resizable, keyboard reachable, dismissible, and non-destructive by default. It is not a permanent navigation destination.

### Can selection both select and open?

Yes, for single selection in grid and table modes. The originating selection is retained while the sheet is open, and closing returns focus to that item. Table multi-selection is the exception: it is reserved for future bulk actions and must not accidentally open a one-item sheet.

### Do we need two editor implementations?

No. Existing records have one detail sheet that switches between read and edit mode. New records open that same editor content directly. A second independently implemented editor sheet would cause drift in validation, dirty-state handling, and accessibility.

### Is “Archived” a status?

No. It is an archive/visibility property. Lifecycle statuses must remain mutually understandable and mutually exclusive. This avoids filters that imply an archived possession is no longer owned.

### Is a database backup enough for image safety?

No. The backup unit is a package containing the SQLite database plus managed image assets. Restore must be tested as a unit, including missing, renamed, and deleted assets.

### Should we promise iCloud now?

No. A raw SQLite file in iCloud Drive can produce conflicts or partial state without file coordination and merge policy. Keep v1 local/document-style and design sync as a separate product/architecture project.

### Are all fields equally editable?

No. User-owned fields are editable in the normal flow. Imported/provenance fields are read-only unless the user intentionally expands Advanced. This prevents accidental corruption of source identity.

### Does “backup before delete” make deletion safe enough?

No. A backup protects recovery but does not make the destructive action understandable. Delete must state what will be removed, distinguish deleting a database record from deleting managed image assets, and offer a visible recovery path. Archive should be the low-friction alternative for records that may be needed later.

### Should the app add a dashboard or statistics view?

No for v1. The app’s value is fast, trustworthy retrieval and editing of inventory records. Counts belong in contextual sidebar/filter affordances; analytics should not compete with the primary workspace.

### What does “Apple ecosystem” mean here?

It means native Mac behavior, accessibility, file handling, menus, appearance, and recoverability—not automatically iCloud sync. Any future sync feature needs its own conflict and privacy design before it is promised.

## Required implementation guardrails

- [x] Use one modal routing state, not two independent `.sheet` modifiers that can compete.
- [ ] Make dirty-draft state explicit and test Close, Cancel, Escape, window dismissal, failed Save, and successful Save.
- [x] Replace comma-separated image paths with ordered asset records and remove the legacy column after Goose migration.
- [x] Define archive separately from lifecycle status before finalizing filters, counts, and badges.
- [x] Replace free-form category normalization with managed category records and stable category IDs.
- [x] Test the complete backup package by restoring it into a fresh temporary location.

The Goose normalization migration and Swift repository tests cover managed categories, typed money/date round trips, ordered images, provenance, quarantine counts, and backup-package restoration. The user-facing Restore Database… flow restores into a new destination without replacing the active database.

## Review gate

Do not mark the visual polish tickets complete if any of the following remain unresolved: ambiguous status language, competing editor surfaces, data loss on dismissal, a database-only backup presented as complete, or a UI that freezes during open/save/image work.
