---
title: Design Tokens and Semantic Roles
status: Todo
priority: 1
labels:
  - design-system
  - ui
  - swiftui
project: Possessions Style Refresh
estimate: 3
blockedBy: [00-product-decisions]
---

# Design Tokens and Semantic Roles

## Goal

Create one source of truth for visual values that behaves correctly in Light, Dark, and increased-contrast appearance.

## Scope

Create `DesignTokens.swift` covering:

- Lifecycle status roles: in use, owned, wishlist, disposed, retired. Archive is a separate visibility role and must not be treated as a lifecycle status.
- Workspace, grouped surface, elevated sheet, divider, selected, hover, focus, destructive, and placeholder roles.
- Spacing, radius, elevation, and typography scales based on system text styles.
- Environment-aware Light/Dark and increased-contrast variants.
- Semantic accessors from `Status` so badges, cards, tables, and filters cannot drift apart.

Refactor views to consume roles instead of hardcoded colors, opacity values, radii, and fixed font sizes.

## Acceptance Criteria

- [ ] `DesignTokens.swift` exists with color, spacing, radius, elevation, and typography sections.
- [ ] Status color literals are replaced with semantic tokens.
- [ ] Cards, tables, sheets, dividers, chips, and empty states use surface tokens.
- [ ] Focus and selected states remain visible without relying on color alone.
- [ ] The app renders correctly in Light, Dark, and increased-contrast appearance.
