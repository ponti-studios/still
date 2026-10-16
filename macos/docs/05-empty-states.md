---
title: Contextual Empty, Loading, and Error States
status: Todo
priority: 2
labels:
  - ui
  - swiftui
project: Possessions Style Refresh
estimate: 3
blockedBy: [00-product-decisions, 01-design-tokens]
---

# Contextual Empty, Loading, and Error States

## Goal

Give every non-content state a clear explanation and an immediate next action.

## Scope

- No database open: explain the workflow and provide Open Database… as the primary action.
- Database loading: show a lightweight progress state without blocking the window unnecessarily.
- Database open with no possessions: provide Add First Possession.
- Search/filter no results: show the query/filter context plus Clear Search/Clear Filters.
- Invalid schema: explain the missing/invalid data and provide Open Another Database.
- Save/backup/import failures: show inline, actionable feedback and preserve user work.
- Image loading/failure: distinguish loading from unavailable.
- Use token-based illustrations and system typography.

## Acceptance Criteria

- [ ] All empty, loading, and error states are contextual and actionable.
- [ ] Primary actions trigger the described flow.
- [ ] No-results state shows active query/filter information.
- [ ] Failed saves never dismiss the editor or lose a draft.
- [ ] Styling remains consistent in Light, Dark, and increased contrast.
