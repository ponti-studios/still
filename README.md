# Still — possessions & shopping (iOS)

Still keeps track of your things: what you own, what you want, and everything in between. An item
starts as an idea or wanted purchase, can move through planned, ordered, delivered and owned, then
into an archived outcome.

A React Native app with a Swift core (`StillCore`). Sign-in is an email code through the shared
`HominemAuth` package (same mechanism as Thames); the session stays in the Keychain.

`HominemAuth` is public and MIT-licensed ([charlesponti/HominemAuth](https://github.com/charlesponti/HominemAuth)).

## Run locally

Requires Xcode, Node 24, and CocoaPods.

```sh
npm ci
(cd ios && pod install)
npm start              # Metro on :8084 in its own terminal
npm run ios            # build & run on the simulator
```

## Checks

```sh
npx tsc --noEmit
npm test               # jest
(cd StillCore && swift test)
```

To point a Debug build at a local API: launch with `-StillAPIBase http://localhost:4040`.

## Ship

See [docs/TESTFLIGHT.md](docs/TESTFLIGHT.md). One command archives, verifies and uploads:

```sh
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 scripts/archive-testflight.sh --upload
```

`scripts/deploy-ios.sh --install --launch` builds for the paired physical iPhone.

## Data

Still stores record truth in Hominem's Postgres, through the Hominem API (`/api/possessions`,
`/api/possessions/containers`, `/api/collections`), scoped to the signed-in user.

On the phone: the Keychain session, small view preferences, a Core Data library cache
(`Application Support/Still/StillLibrary.sqlite` — Hominem stays the source of truth, the cache
is wipe-and-filled on sync and serves airplane-mode browse), and item photos
(`Application Support/Still/Photos` — on-device files, file URI in metadata, never uploaded).

To load the spreadsheet inventory once, export the "master" and "containers" tabs of the
possessions sheet, and optionally the shopping sheet, as CSV (`master.csv`, `containers.csv`,
`shopping.csv`) into a folder, then from the Hominem repo:

```sh
pnpm --filter @hominem/api exec tsx scripts/import-possessions.ts --email you@example.com --dir ~/path/to/csvs           # dry run
pnpm --filter @hominem/api exec tsx scripts/import-possessions.ts --email you@example.com --dir ~/path/to/csvs --apply   # write
```

Re-running is safe: rows are matched on the sheet's own ids (`ITM-*`, `CON-*`).

## Studio verbs

Still shares one set of `just` verbs with the other studio repos (`.studio/STUDIO.md`): `just setup`, `doctor`, `run`, `sim`, `device`, `check`, `testflight`. `.studio/` is copied from the `studio-dev` repo; do not edit it here, run `just studio-update`.
