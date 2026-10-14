---
title: Still cross-platform merge (Possessions)
status: Final
labels:
  - product
  - architecture
project: Still cross-platform
---

# Still cross-platform merge (Possessions)

Source of truth for merging Still (iPhone) and Possessions (Mac) into one
cross-platform app, following the WalksGPX pattern. Nothing here is settled
until marked Accepted.

## Background (researched, not decided)

- WalksGPX: native Swift, `iOS/` + `macOS/` + `Shared/`, local Core Data per
  platform, `NSPersistentCloudKitContainer` sync, iCloud Drive file mirror.
  No custom server, no React Native.
- Still today: React Native iOS, Hominem backend (OTP auth, possessions API),
  photos on-device as of the latest change.
- Possessions today: native SwiftUI macOS, raw SQLite, images on disk under
  `~/Documents/possessions/<id>/`.

## Decisions

| # | Decision | Status | Outcome |
|---|----------|--------|---------|
| 1 | Backend: local-first CloudKit vs Hominem-backed | Decided | Hominem stays the source of truth; Core Data is a local cache on each platform |
| 2 | iOS UI stack: native Swift vs React Native | Decided (staged) | Stage 1: keep React Native on iOS, Core Data cache behind the bridge, to deploy ASAP. Stage 2 (deferred proposal, needs its own interview): rewrite iOS native in SwiftUI |
| 3 | Stage-1 sync model: write-through vs offline outbox | Decided | Write-through: reads serve from Core Data, writes hit Hominem first then update the cache; no offline writes |
| 4 | Stage 1 boundary: iOS-only vs includes Possessions | Decided | Stage 1 is iOS-only (RN + Core Data cache + Hominem sync); Possessions untouched, no shared data until stage 2 |
| 5 | Photos in stage 1 | Decided | Unchanged (follows from the iOS-only boundary): on-device files, URI in metadata, no cross-device sync |

## Goals

- Still iOS reads instantly from an on-device Core Data cache.
- Hominem remains the source of truth; the cache never invents data.
- Deployable to TestFlight ASAP; no screen rewrites in stage 1.
- Establish the Core Data model + Hominem sync that stage 2 reuses.

## Non-goals

- Offline writes, outbox, conflict resolution.
- Possessions changes; native rewrite; CloudKit; photo sync.

## Constraints

- RN screens stay untouched; only the store reroutes to the cache.
- No Hominem server changes; sync uses existing endpoints.
- Photos stay as shipped (on-device files, URI in metadata).

## Risks

- Stale-cache bugs during the transition (two reads paths, one truth).
- Every cached read crosses the RN bridge; paging/perf must be watched.
- If the Core Data model isn't designed for Mac sharing, stage 2 pays rework.

## Validation

- tsc + jest + Swift suites green; sim build; TestFlight deploy.
- Airplane-mode browse serves lists from the cache.

## Scope contract (accepted)

Accepted by the owner in chat with the word "accepted" (see session
log). No owning issue exists (early dev, no GitHub workflow), so this
record is the coordination evidence.

In scope — Still repo only: StillCore cache/sync module, StillBridge
cache methods, TS store reroute, tests.
Out of scope — Possessions repo, Hominem server, RN screens, stage-2
native rewrite, offline writes, CloudKit.
Done means — cache fills from Hominem on launch; lists render from the
cache; writes go through Hominem then the cache; airplane-mode browse
works; all suites green; TestFlight build deployed.
