---
title: Native Interaction Polish
status: Todo
priority: 3
labels:
  - ui
  - swiftui
project: Possessions Style Refresh
estimate: 3
blockedBy: [00-app-shell-and-modal, 01-design-tokens, 02-detail-sections, 07-image-experience]
---

# Native Interaction Polish

## Goal

Add responsive feedback while preserving the restrained behavior of native macOS apps.

## Scope

- Card and table-row hover/press/selection states.
- Native modal presentation/dismissal motion.
- Disclosure expansion animation.
- Image drag/drop target using appropriate file-provider/image UTTypes.
- Clear drop feedback and import progress.
- Context-menu icons for Edit, Duplicate, Delete, and Reveal in Finder.
- Tooltips/help text for unfamiliar toolbar controls.
- Respect Reduce Motion and avoid decorative animation during data work.

## Acceptance Criteria

- [ ] Cards and rows visibly respond to hover, press, and selection.
- [ ] Dragging supported image files highlights the drop target.
- [ ] Disclosure and modal transitions are smooth but restrained.
- [ ] Reduce Motion removes nonessential movement.
- [ ] Every context-menu action has an appropriate icon and label.
