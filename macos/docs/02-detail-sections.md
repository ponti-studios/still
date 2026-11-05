---
title: Modal Detail Sections
status: Todo
priority: 2
labels:
  - ui
  - swiftui
project: Possessions Style Refresh
estimate: 3
blockedBy: [00-app-shell-and-modal, 01-design-tokens]
---

# Modal Detail Sections

## Goal

Make the modal read view scannable without hiding any information permanently.

## Scope

- Add a reusable `DetailSection` with native disclosure behavior, token styling, and accessible expanded state.
- Group Images, Identity, Classification, Dates & Pricing, Details, Links, Source, Metadata, and Notes.
- Default-open Images, Identity, and Classification; keep advanced groups closed.
- Persist expansion state per scene using stable keys.
- Keep the modal title/identity visible and provide Close and Edit actions.
- Preserve text selection and keyboard/VoiceOver navigation.

## Acceptance Criteria

- [ ] The modal read view shows grouped, collapsible sections.
- [ ] Expansion state persists across the current scene/session.
- [ ] `DetailSection` is reusable by the editor.
- [ ] Every field remains reachable and selectable.
- [ ] Keyboard and VoiceOver users can expand and collapse every section.
