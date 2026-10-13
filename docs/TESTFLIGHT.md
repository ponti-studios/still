---
title: Ship Still to TestFlight
summary: How to archive Still, upload it, and add a tester.
type: runbook
status: active
owner: charlesponti
tags: [ios, testflight, release]
updated: 2026-10-13
---

# TestFlight runbook

## One-time setup (needs the Apple ID)

1. Join the paid Apple Developer Program. The project's team is `3QHJ2KN8AL` (same as Thames).
2. In Xcode → Settings → Accounts, sign in with the Apple ID that owns the team. Export fails with "login details rejected" if only a different Apple ID is signed in.
3. Create the app record in App Store Connect (iOS, bundle ID `io.ponti.still`, SKU `still-ios`). The store name can be changed later; the bundle ID and SKU cannot. The first export also creates the iOS Distribution certificate.
4. Still compiles no secrets into the app (sign-in is an email code via HominemAuth; the session stays in the Keychain), so unlike Thames there is no `.env.testflight` to create.

## Each release

```sh
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 scripts/archive-testflight.sh --upload
```

Run it from `main` up to date with `origin/main`, and only when a TestFlight build was asked for. The script typechecks and runs the tests (JS + Swift), archives a Release build with a fresh build number (a timestamp, so it always goes up), checks the bundle ID, build number and encryption declaration, exports the `.ipa`, and uploads it. Without `--upload` it leaves the `.ipa` in `ios/build/testflight/export` for the Transporter app.

Apple processes the build for a few minutes, then it appears in App Store Connect → TestFlight.

## Adding a tester

- **Internal** (no review, minutes): add the person under Users and Access (App Manager or Developer role), then add them to an internal group in TestFlight. They must accept the invite.
- **External** (up to 10,000 people, no team membership needed): create an external group, add them by email or turn on the public link. The first build goes through Beta App Review, usually about a day.

The tester installs the free TestFlight app, accepts the invite, and installs Still.

## Text for App Store Connect

**Beta App Description**
Still keeps track of your things: what you own, what you want, and everything in between. Sign in with your email, add your possessions, and give them a home in containers and collections.

**What to Test**
- Sign in with an email code, then kill and reopen the app; you should stay signed in.
- Add an item, move it through its stages, and archive it.
- Make a container and a collection, and put items in them.
- Tell me if sign-in fails, if a change does not save, or if anything looks wrong.

**Privacy policy** (required for external testing): say that the email address, the possessions, containers and collections entered in the app are sent to the Hominem API to sign in and sync. Nothing else leaves the phone; TestFlight builds also send crash reports to Apple.

## Known limits

- iPhone only.
- Debug warnings are Debug-only; Release builds do not show them.
