---
title: Editor Progressive Disclosure
status: Todo
priority: 2
labels:
  - ui
  - swiftui
project: Possessions Style Refresh
estimate: 3
blockedBy: [00-app-shell-and-modal, 01-design-tokens, 02-detail-sections]
---

# Editor Progressive Disclosure

## Goal

Give the modal editor the same information hierarchy as the read view without creating a wall of fields.

## Scope

- Reuse `DetailSection` for Images, Identity, Classification, Dates & Pricing, Details, Links, Source, Metadata, and Notes.
- Default-open Identity and Classification on first edit; reveal Dates & Pricing, Details, Links, and Notes progressively. Keep Source, Metadata, and other provenance fields closed and visually secondary.
- Keep TextField, TextEditor, Picker, and image-strip behavior native.
- Keep Save and Cancel in standard modal toolbar/footer locations.
- Integrate dirty-draft tracking, validation, and inline errors from ticket 10.
- Keep advanced/source/metadata fields visually secondary.
- Do not use tabs.

## Acceptance Criteria

- [ ] Edit mode uses the same named groups as read mode.
- [ ] Sections collapse and persist state.
- [ ] Save is transactional; Cancel never writes a draft.
- [ ] Invalid fields show inline feedback and receive focus.
- [ ] Dirty drafts require confirmation before dismissal.
