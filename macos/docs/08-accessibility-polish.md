---
title: Accessibility and macOS Polish
status: Todo
priority: 3
labels:
  - accessibility
  - ui
  - swiftui
project: Possessions Style Refresh
estimate: 4
blockedBy: [00-app-shell-and-modal, 01-design-tokens, 02-detail-sections, 04-filter-chips]
---

# Accessibility and macOS Polish

## Goal

Make the app fully usable with Apple accessibility technologies and keyboard-first workflows.

## Accessibility scope

- Use system text styles and verify at larger accessibility sizes without clipping.
- Add VoiceOver labels, values, hints, traits, and expanded/collapsed state.
- Manage focus when a modal opens, closes, enters Edit mode, fails validation, or presents an error.
- Support keyboard navigation in grid and table modes, including arrow-key movement where appropriate.
- Ensure every action is available through menus, keyboard shortcuts, or reachable controls.
- Support Reduce Motion and increased contrast.
- Never communicate status using color alone.

## Polish scope

- Show the active sort column and direction clearly.
- Add context-menu icons and standard menu command placement.
- Add a visible Back Up Now… action with success feedback and Reveal in Finder.
- Show inline editor error banners without hiding field-level errors.
- Add result counts, selection counts, and clear filter affordances.

## Acceptance Criteria

- [ ] The UI works at normal and large accessibility text sizes.
- [ ] Grid, table, sidebar, modal, editor, chips, images, and errors are VoiceOver-readable.
- [ ] The complete CRUD and filter workflow is keyboard reachable.
- [ ] Sort, backup, and destructive actions have clear state and feedback.
- [ ] Light, Dark, increased contrast, and Reduce Motion are verified.
