---
title: Apple-style App Shell and Modal Detail
status: Todo
priority: 1
labels:
  - product
  - ui
  - swiftui
  - macos
project: Possessions Style Refresh
estimate: 3
blockedBy: [00-product-decisions]
---

# Apple-style App Shell and Modal Detail

## Implementation note

The two-column shell, routed single-sheet presentation, unified existing/new editor surface, archive filter, and restore-aware database menu are implemented. Remaining work is interaction QA: focus restoration, dirty-dismissal confirmation, and full keyboard/window-size verification.

## Goal

Make the list/grid/table the primary workspace and present possession details in a focused native sheet.

## Scope

- Use a two-column `NavigationSplitView`: `SidebarView` plus `PossessionsListView`.
- Remove the persistent detail column and its empty “Select a Possession” state.
- Present one routed detail/editor surface with `.sheet(item:)` when a single existing possession is selected; it transitions from read mode to edit mode in place.
- Present the same editor content directly for New Possession without stacking it over a detail sheet.
- Give the sheet a useful minimum size, native Close action, Edit action, and standard toolbar placement.
- Clear selection when the sheet closes and restore keyboard focus to the originating item.
- Keep New Possession on the same editor implementation and prevent conflicting sheets through one modal routing state.
- Verify grid selection, table selection, sidebar filtering, keyboard shortcuts, and window resizing.

## Acceptance Criteria

- [ ] The main window is sidebar + workspace only.
- [ ] Selecting a grid card or table row opens the detail sheet.
- [ ] Closing the sheet returns to the same workspace state.
- [ ] The detail sheet supports read-only and explicit Edit modes.
- [ ] Escape and standard close controls behave predictably.
- [ ] No empty detail pane remains at any window size.
