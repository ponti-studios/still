# Still — possessions & shopping

Local MVP for managing possessions and shopping as one item lifecycle. An item starts as an idea or wanted purchase, can move through planned, ordered, delivered and owned, then into an archived outcome. 

## Run locally

```sh
npm install
npm run dev
```

The development server binds to `127.0.0.1`. Use `npm run build` to create the production bundle.

## Data

Still stores everything in Hominem's Postgres, through the Hominem API (`/api/possessions`, `/api/possessions/containers`, `/api/collections`), scoped to the signed-in user. Nothing is kept in the browser except small view preferences.

To load the spreadsheet inventory once, export the "master" and "containers" tabs of the possessions sheet, and optionally the shopping sheet, as CSV (`master.csv`, `containers.csv`, `shopping.csv`) into a folder, then from the Hominem repo:

```sh
pnpm --filter @hominem/api exec tsx scripts/import-possessions.ts --email you@example.com --dir ~/path/to/csvs           # dry run
pnpm --filter @hominem/api exec tsx scripts/import-possessions.ts --email you@example.com --dir ~/path/to/csvs --apply   # write
```

Re-running is safe: rows are matched on the sheet's own ids (`ITM-*`, `CON-*`).

## UI

Components, tokens and theming come from [`@ponti-studios/ui`](https://www.npmjs.com/package/@ponti-studios/ui) (installed from public npm; it ships TypeScript source that Vite transpiles). Styling is Tailwind v4: `src/style.css` imports `tailwindcss` and the package's `styles.css` and points `@source` at the package so its classes are generated. Build screens from the package's Button, Badge, Card, Dialog, DropdownMenu, Select, Table, etc. rather than custom CSS.

## What it does

Mobile-first: a bottom tab bar and bottom sheets on phones, a sidebar and modals from 768px, a table view from 1024px.

- Overview, Possessions, Shopping, Orders, Containers, Collections and Archive pages; stats and the "coming up" panels are computed from your items.
- Add, edit, archive/restore and delete items; tap a status badge to move an item to the next stage.
- Search (⌘K / Ctrl+K), filter by category, sort by newest, name, value or status.
- Create, rename and delete containers and collections, assign items to them, and open one to see what is inside.
- Settings opens Hominem's hosted account page; Help opens an email to the maintainer.

`npm test` runs unit tests for the stats, sorting and the place→container migration.

The initial rows are illustrative sample content and can be edited or archived in the app.

## Authentication

Sign-in uses the Hominem API's hosted login (Better Auth). The app stores no credentials: on load it calls `GET <API>/api/auth/get-session` with the shared session cookie and redirects to `<API>/login?next=…` when there is no session. Clicking the profile row posts to the API's `/logout`.

```sh
cp .env.example .env.local   # VITE_PUBLIC_API_URL=https://api.lvh.me
npm run dev:lvh              # serves https://still.lvh.me through portless
```

The cookie is scoped to `lvh.me`, so the app must be served from `https://still.lvh.me` (the Hominem API and portless proxy must be running — see the Hominem `hominem-development` skill). The API trusts this origin via `STILL_URL` (default `https://still.lvh.me`); set `STILL_URL` on the production API service to Still's real origin.
