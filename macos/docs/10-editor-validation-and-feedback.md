---
title: Editor Validation and Feedback
status: Todo
priority: 2
labels:
  - ui
  - swiftui
  - forms
project: Possessions Style Refresh
estimate: 3
blockedBy: [00-product-decisions, 03-editor-sections]
---

# Editor Validation and Feedback

## Goal

Make editing safe, clear, and consistent with Apple form behavior.

## Scope

- Track whether the draft has unsaved changes.
- Confirm before dismissing a dirty draft through Close, Cancel, Escape, or window dismissal.
- Require a non-empty name for new possessions.
- Validate date fields, money fields, numeric fields, URLs, and JSON metadata.
- Show inline field errors and focus the first invalid field.
- Keep the editor open after a failed save; never swallow a write error.
- Show Save progress and disable duplicate submissions.
- Provide accessible labels, values, hints, and error announcements.
- Make source/imported fields read-only by default, visually secondary, and explain which fields are safe to edit. Advanced editing must be explicit.
- Validate lifecycle status against the approved mutually exclusive values and keep archive separate.

## Acceptance Criteria

- [ ] Invalid input cannot be saved silently.
- [ ] Save failures preserve the draft and show an actionable error.
- [ ] Dirty drafts require confirmation before dismissal.
- [ ] Keyboard focus moves to the first invalid field.
- [ ] Save cannot be triggered twice while a write is in progress.
