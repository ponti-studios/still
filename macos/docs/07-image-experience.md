---
title: Image Experience: Cache, Viewer, and Reorder
status: Todo
priority: 3
labels:
  - ui
  - swiftui
  - performance
project: Possessions Style Refresh
estimate: 4
blockedBy: [00-product-decisions, 01-design-tokens]
---

# Image Experience: Cache, Viewer, and Reorder

## Implementation note

The ordered asset table, legacy migration, normalized schema migration, relative managed paths, and backup/restore sidecar handling are implemented and tested. Thumbnail caching, full viewer, drag-reorder, and drag/drop import remain.

## Goal

Make images fast, inspectable, reorderable, and safely backed up.

## Scope

- Cache downsampled thumbnails with `NSCache` keyed by path and size.
- Decode thumbnails off the main actor with cancellation and explicit loading/failure states.
- Clicking a thumbnail opens a native viewer sheet with zoom, pan, keyboard navigation, and Share.
- In edit mode, drag-reorder images and persist the order.
- Support drag-and-drop image import in read and edit modes.
- Clearly distinguish missing files from empty image collections.
- Confirm deletion and remove managed files when references are removed.
- Include image assets in backup/restore workflows.
- Use the ordered `possession_images` representation with stable asset ID, managed relative path, display order, alt text, and import metadata. Existing comma-separated paths were migrated by Goose before the legacy column was removed.

## Acceptance Criteria

- [ ] Cached thumbnails remain responsive in large grids.
- [ ] Viewer supports zoom, pan, next/previous, and accessible image descriptions.
- [ ] Image order persists after Save.
- [ ] Drag/drop accepts supported image files and reports failures.
- [ ] Removing an image does not leave unmanaged orphan files.
- [ ] Backups include the assets needed to restore the database experience.
- [ ] Restore is tested from a complete backup package in a fresh location.
