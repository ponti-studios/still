---
title: Filter Chips and Clear All
status: Todo
priority: 2
labels:
  - ui
  - swiftui
project: Possessions Style Refresh
estimate: 1
blockedBy: [00-product-decisions, 01-design-tokens]
---

# Filter Chips and Clear All

## Implementation note

Managed category records and stable category IDs are implemented in the normalized repository and covered by tests. The visible filter chips, clear-all affordance, result counts, and synchronized sidebar state remain UI work.

## Goal

Make active filters visible, reversible, and consistent with macOS search/filter patterns.

## Scope

- Show dismissible lifecycle-status, archive, and category chips below the search field.
- Add Clear All when search or filters are active.
- Show result count and the active search query in no-results states.
- Use managed category IDs so `Accessories` and `accessories` cannot become separate navigation items.
- Support keyboard dismissal and accessible labels/values.
- Keep sidebar selection and chips synchronized as a single source of truth.

## Acceptance Criteria

- [ ] Chips render only for active filters.
- [ ] Removing a chip immediately updates the list and sidebar selection.
- [ ] Clear All clears search, status, and category filters.
- [ ] Result count and active query/filter context are visible.
- [ ] Categories are normalized for display and filtering.
