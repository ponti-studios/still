# Still (macOS)

The Mac app of Still — a personal inventory app: track what you own, its status, value, and history. Native SwiftUI over SQLite.

It lives beside the iOS app and the shared [`StillCore`](../StillCore) library in the Still repo, so the two apps can share one domain core.

## Features

- **Lifecycle status** — one mutually exclusive value per item: Wishlist, Owned, In Use, Retired, Disposed. Archived is a separate visibility flag.
- **Managed categories** — categories are records with case-insensitive unique names, not free-form text.
- **Ordered images** — first-class `possession_images` assets stored under `~/Documents/possessions/<possession-id>/`.
- **Money & dates** — prices stored as integer cents; dates as ISO `YYYY-MM-DD`.
- **Provenance** — source table/row/metadata tracked in a separate, read-only-by-default record.
- **Safety** — automatic recoverable backup (`VACUUM INTO` + asset sidecar) before the first destructive write of each session, plus explicit backup/restore flows.
- **Schema validation & quarantine** — invalid/malformed legacy rows are preserved rather than silently dropped.

## Architecture

Two SwiftPM targets:

```
Sources/
├── StillMacCore/      # domain layer: models, persistence, services (UI-independent, testable, reusable)
│   ├── Models/        #   Possession, Status, Category, Money, LocalDate …
│   ├── Persistence/   #   SQLiteDatabase, PossessionsRepository
│   ├── Services/      #   ImageStore, BackupManager
│   └── Support/       #   UUIDv7
└── Still/             # presentation layer: SwiftUI app shell, store, and views
    ├── App/           #   StillApp, PossessionsStore
    └── Views/         #   RootView, sidebar, list, detail, editor …
```

`StillMacCore` holds the view model (`Possession`), the cache mapping
(`PossessionCache`), and the pieces the one-way SQLite importer still needs
(`SQLiteDatabase`, `PossessionsRepository`, `ImageStore`, `BackupManager`). It
no longer owns persistence: the cache and the sync engine are
[`../StillCore`](../StillCore), and Hominem is the source of truth — see
[`../docs/stillcore-adoption.md`](../docs/stillcore-adoption.md) and
[`../docs/cross-platform-merge.md`](../docs/cross-platform-merge.md).

Product decisions live in [`docs/`](docs/00-product-decisions.md).

## Requirements

- macOS 26+
- Xcode 26+ (or another toolchain for `swift-tools-version: 6.2`)
- SQLite 3 (system)

## Build & test

From this directory (`macos/`):

```sh
just build       # swift build
just test        # swift test
just run         # swift run Still
```

or directly with SwiftPM:

```sh
swift build
swift test
swift run Still
```

On first launch the app opens, in order: the last-used database, `~/.hominem/warehouse.db` if present, or a fresh database in Application Support.

## Packaging

To build a distributable, notarized `.app` + `.dmg`:

```sh
just release                                              # ad-hoc, local use
IDENTITY="Developer ID Application: …" just release-signed  # signed
IDENTITY=… APPLE_ID=… TEAM_ID=… just release-signed         # signed + notarized
```

See [`scripts/release.sh`](scripts/release.sh) for details and prerequisites.
