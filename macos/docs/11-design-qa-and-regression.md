---
title: Design QA and Regression Pass
status: Todo
priority: 5
labels:
  - ui
  - accessibility
  - qa
project: Possessions Style Refresh
estimate: 3
blockedBy: [01-design-tokens, 02-detail-sections, 03-editor-sections, 04-filter-chips, 05-empty-states, 06-interaction-polish, 07-image-experience, 08-accessibility-polish, 09-data-and-daily-use-ux, 10-editor-validation-and-feedback]
---

# Design QA and Regression Pass

## Goal

Verify the complete experience as one coherent Apple-style macOS app rather than as independent tickets.

## Test matrix

- Light, Dark, and increased-contrast appearance.
- Small, default, and wide window sizes.
- Grid and table display modes.
- Empty, loading, error, and populated databases.
- Search, status filters, category filters, chips, sort directions, and clear-all.
- Open, close, edit, cancel, dirty-dismissal, save failure, delete, and backup flows.
- Image import, missing image, full viewer, reorder, delete, and backup/restore.
- Fresh-location restore from a complete database-plus-assets backup package.
- Archived visibility independent from lifecycle status.
- Existing-record edit and new-record creation through the same editor implementation.
- Keyboard-only navigation, VoiceOver, Dynamic Type/large text, and Reduce Motion.
- 0, 1, 100, 500, and 1,000 possessions.

## Acceptance Criteria

- [ ] No clipped, overlapping, or inaccessible controls in the test matrix.
- [ ] Every destructive action has the intended confirmation/recovery behavior.
- [ ] Every state has a clear next action.
- [ ] Grid/table selection and modal focus behave consistently.
- [ ] Performance remains responsive with representative inventory sizes.
