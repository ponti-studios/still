---
title: Apple-aligned Product Decisions
status: Approved
priority: 1
labels:
  - product
  - ui
  - macos
project: Possessions Style Refresh
estimate: 1
blockedBy: []
---

# Apple-aligned Product Decisions

This is the source of truth for the interaction model. Later tickets follow these decisions unless this document changes first.

## Platform and shell

- Still is a macOS-first app using native SwiftUI controls and system conventions.
- The primary shell is a two-column `NavigationSplitView`: sidebar on the left, list/grid/table workspace on the right.
- The workspace is always the dominant surface; there is no permanent empty detail column.
- The sidebar owns database navigation and status/category filters.
- Search, sort, display mode, selection count, and primary actions belong in the workspace toolbar.

## Selection and detail

- Selecting one possession opens a native modal detail sheet immediately.
- The detail sheet is read-only by default and supports explicit Edit mode.
- Existing possessions use one detail surface that transitions between read and edit states; do not stack a second editor sheet over the detail sheet.
- New Possession opens the editor directly because there is no read state to show first.
- The sheet has Close, Edit, Save, Cancel, and Delete actions using standard macOS placements and keyboard shortcuts.
- Closing clears selection and restores focus to the originating list row or card.
- Escape closes a read-only sheet. In Edit mode, Escape cancels only after confirming unsaved changes.
- Multiple selection remains available in table mode for future bulk actions; it does not open a detail sheet.

## Editing and safety

- Editing is transactional: drafts are separate from persisted records and only Save writes.
- Unsaved changes always produce a confirmation before dismissal.
- Required and malformed values are validated inline and focus moves to the first invalid field.
- Destructive actions require confirmation. The app creates a recoverable backup before the destructive write and offers Undo when the operation can be reversed safely.
- Future bulk actions should provide Undo where technically safe.

## Data semantics

- Lifecycle status is one mutually exclusive value: Wishlist, Owned, In Use, Retired, or Disposed.
- Archived is a visibility/archive flag, not a lifecycle status. It must not compete with Owned or In Use in the same picker.
- Categories are managed records with stable IDs and case-insensitive unique names; filtering never compares free-form category text.
- Images are first-class ordered assets, not a comma-separated string. Legacy `image_url` values are migrated into `possession_images` and then removed from the active schema.
- Money is stored as integer cents, dates as ISO `YYYY-MM-DD` values, and invalid/unlinked legacy rows are preserved in quarantine rather than silently discarded.
- Source table, source row ID, and imported metadata live in a separate provenance record. They are read-only by default and editable only through an explicitly labeled Advanced section.

## Files and Apple ecosystem

- v1 is a local document-style Mac app. It supports explicit Open, backup, export, and restore flows; it does not imply live iCloud synchronization until SQLite file coordination and conflict handling are designed and tested.
- Recent databases use security-scoped bookmarks where sandboxing requires them, not only raw paths.
- A backup is a restorable package containing the database and managed image assets. A database-only copy is never described as a complete backup.

## Content and hierarchy

- Detail and edit fields use the same groups: Images, Identity, Classification, Dates & Pricing, Details, Links, Source, Metadata, Notes.
- Groups use progressive disclosure rather than tabs.
- Advanced/source/metadata fields are available but visually secondary.
- Empty, loading, error, and success states are contextual and actionable.

## Apple ecosystem requirements

- Support Light and Dark appearance, Dynamic Type, Reduce Motion, VoiceOver, keyboard navigation, and standard menu commands.
- Prefer native controls, materials, sheets, tables, context menus, file importers, and system typography over custom replacements.
- Status is never communicated by color alone; use text and an icon as well.
- No destructive or externally visible action occurs without the appropriate confirmation.

## Decisions deliberately deferred

- Multi-window editing, live iCloud sync, bulk editing, and automatic conflict merging are deferred until their data-coordination model is specified.
- We will not add a dashboard, charts, or a second navigation hierarchy until the core inventory workflow is fast and reliable.
