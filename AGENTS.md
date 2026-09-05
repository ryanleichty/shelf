# Shelf — agent guide

Shelf is a small, shared inventory for books, movies and TV shows built on
TanStack Start (React, file router, SSR) with Drizzle ORM over libSQL. The
catalog is public: anyone can browse it without an account. Sign-in is required
only for writes — adding or editing items, managing shared lists, collection
lookup, Settings and user management. A token-guarded JSON API under
`/api/items` exists for automation.

## Commands

| Command                | Purpose                                                       |
| ---------------------- | ------------------------------------------------------------- |
| `pnpm dev`             | Vite dev server with SSR on port 3000                         |
| `pnpm build`           | Production build                                              |
| `pnpm preview`         | Serve the production build                                    |
| `pnpm test`            | `vitest run`                                                  |
| `pnpm lint`            | oxlint                                                        |
| `pnpm format`          | oxfmt, writing changes                                        |
| `pnpm check`           | oxfmt in `--check` mode (what CI runs)                        |
| `pnpm typecheck`       | Regenerates the route tree, then `tsc --noEmit`               |
| `pnpm routes:generate` | Rewrites `src/routeTree.gen.ts` from the route files          |
| `pnpm bundle:check`    | Client bundle size budget (`scripts/check-bundle-budget.mjs`) |
| `pnpm db:migrate`      | Applies `runMigrations` ahead of time                         |
| `pnpm db:seed`         | Inserts the sample classics                                   |
| `pnpm db:reset`        | Deletes `/tmp/shelf.db`, then migrate + seed                  |

The full local gate:

```bash
pnpm lint && pnpm check && pnpm typecheck && pnpm test && pnpm build && pnpm bundle:check
```

## Fresh clone

`src/routeTree.gen.ts` is generated and gitignored. `pnpm typecheck` rewrites
it every run, and `pnpm dev` and `pnpm build` keep it current. A bare `tsc`
will fail on the missing file in a fresh clone, and read a stale one after a
route is added — run `pnpm typecheck` instead.

## Database and migrations

There is exactly one migration system: `runMigrations` in
`src/server/migrate.ts`. There is no `drizzle/` directory and no
`drizzle-kit` workflow.

To add a column: append an idempotent statement to `runMigrations` (a
`CREATE TABLE IF NOT EXISTS`, or an `ALTER TABLE` guarded by
`PRAGMA table_info`) and mirror it in `src/server/schema.ts`. Do not bump a
version by hand — `schemaVersion()` is an FNV-1a fingerprint of
`runMigrations.toString()`, so editing the function is the version bump.
`src/server/db.ts` compares it with the `schema_meta` row once per process and
migrates when they differ.

With `TURSO_DATABASE_URL` unset, Shelf uses an ephemeral `file:/tmp/shelf.db`
and auto-seeds the sample items on first query. Note that the `db:migrate`,
`db:seed` and `db:reset` scripts run under `tsx`, which does not load `.env`,
while `pnpm dev` (Nitro) does — the two can target different databases.

Lending is recorded in a `loans` table, not on `items` directly:
`items.status === "borrowed"` if and only if the item has an open `loans` row
(`returned_at IS NULL`), enforced by a unique partial index
(`loans_open_item_unique`). Only `lendItem` and `returnLoan`
(`src/server/loans.ts`) may set or clear `"borrowed"` status, each doing both
writes in one transaction — a reviewer should grep for any other
`update(items).set({ status: "borrowed" })`. A loan links to a `users` row
when the borrower has an account, but `borrower_name` is always stored as a
point-in-time snapshot so a loan still reads correctly after the account is
renamed or deleted. `items.status` is `"wanted"` for something you don't own
yet, `"owned"` for something on the shelf, and `"borrowed"` for an owned item
that is currently out on loan. A `"wanted"` item can never have an open loan
and can never carry a reading/watching state — `lendItem` and `setItemState`
both guard against it. Only `lendItem` and `returnLoan` change `"borrowed"`,
and `markItemOwned` (`src/server/items.ts`) is the only other writer of
`status`, flipping a wanted item to `"owned"`; the form no longer offers a
status field, and `saveItem`'s update path never touches `status` (its insert
path sets `"wanted"` or `"owned"` from a `wanted` flag).

`getShell` (`src/server/shell.ts`) partitions wanted rows out of
`catalog.items` into a separate `catalog.wishlist` array — that single
partition is why no browse surface (search, genre/author/year pages, the home
carousels) needs its own status filter to keep wishlist items out. A new
browse surface must read `catalog.items` (never query `items` directly), or
it will silently count wishlist entries as owned.

A wishlist entry is deliberately a real `items` row rather than a row in a
separate `wishlist` table. That choice buys the item page, provider metadata
sync, the genre and people joins, and `itemExists` deduplication against a
copy you already own, and it makes buying something a one-field status flip
instead of a create-then-delete. The separate table was considered and
rejected; do not refactor wanted rows back out of `items` without re-reading
the partition rule above.

The wishlist browses like the shelf, one level down: `/wishlist` shows one
carousel per type and `/wishlist/$section` (`books`, `movies`, `tv` — the
`typeSegments` map in `src/lib/catalog.ts`) is the searchable grid. Both read
`catalog.wishlist`. A wanted item cannot join a list — `addItemToList`
rejects it, as `setItemState` and `lendItem` do — and the item page hides the
readlist/watchlist toggle and the list menu for it, links back to its
wishlist section, and fills its "also on" carousel from the rest of the
wishlist rather than from owned titles.

Reading and watching are per-member state, not a property of the item: a
`user_items` row (`user_id`, `item_id`, `state`, `started_at`, `updated_at`,
unique on `(user_id, item_id)`, both foreign keys `ON DELETE CASCADE`) exists
only while that member is currently reading or watching something — no
history, no rating, no progress. Finishing removes the row. `setItemState`
and `clearItemState` (`src/server/user-items.ts`) enforce the type rule
server-side (`"reading"` is books only, `"watching"` is movies and TV only)
and require a stored user — a bootstrap session has none. `getShell`
(`src/server/shell.ts`) adds the signed-in viewer's own states as
`catalog.viewerStates` (item id → state); it is empty for anonymous
visitors, and no other member's state is ever sent.

## Bundle hygiene

Never import `@/server/db`, `@/server/auth`, or any `node:` module at the top
level of anything a client component can reach. Two rules keep that true:

- `src/routes/api/*.tsx` declare `const api = () => import("@/server/api/…")`
  and await it inside each handler, so the route module itself pulls in no
  database, auth or provider code.
- `src/server/shell.ts` and `src/server/session.ts` use `await import("./auth")`
  _inside_ handler bodies to keep `node:crypto` out of client bundles.

CI runs an SSR smoke test and greps the server log for `createSsrRpc`
(`.github/workflows/ci.yml`) — a hit means server code leaked into a client
bundle and is being round-tripped over RPC.

## Layering and conventions

- `src/routes` — file-based routes and thin API route shells.
- `src/server/*.ts` — server functions via `createServerFn`, with the auth
  check (`requireSignedIn()` / `requireAdmin()`) as the **first statement** of
  the handler and a zod schema in `.inputValidator(...)`.
- `src/lib` — pure shared logic. This is the tested layer.
- `src/components` — UI, with shadcn primitives in `src/components/ui`.

Formatting is oxfmt (`.oxfmtrc.json`): no semicolons, double quotes, 2-space
indent, 80 columns, ES5 trailing commas, LF, Tailwind classes sorted inside
`cn`/`cva`. Linting is oxlint. There is no ESLint and no Prettier — `.cta.json`
still lists `eslint` from scaffolding, and it is stale; ignore it.

## Tests

Vitest, node environment, `src/**/*.test.{ts,tsx}` (`vitest.config.ts`). Plain
`describe` / `test` / `expect`, no mocks. Server tests build a real database
in memory:

```ts
const client = createClient({ url: ":memory:" })
await runMigrations(client)
```

Match the style of `src/lib/catalog.test.ts`.

## Environment variables

All of these are server-only and never reach the browser. See `.env.example`.

| Variable                | Purpose                                                     |
| ----------------------- | ----------------------------------------------------------- |
| `ADMIN_PASSWORD`        | Bootstraps the first admin at `/admin/login`                |
| `TMDB_API_KEY`          | Movie and TV lookup for signed-in users                     |
| `UPCMDB_API_KEY`        | Optional; disc barcode lookup via UPCitemdb                 |
| `BLOB_READ_WRITE_TOKEN` | Optional; stores cover images in Vercel Blob                |
| `SHELF_AGENT_TOKEN`     | Required for the agent JSON API below                       |
| `TURSO_DATABASE_URL`    | libSQL/Turso URL; unset means the ephemeral `/tmp` database |
| `TURSO_AUTH_TOKEN`      | Token for that database                                     |

## Bulk import

`/admin/import` accepts a Goodreads or Letterboxd CSV export in addition to
its one-title-per-line textarea. `src/lib/csv.ts` parses the file and
`src/lib/import-csv.ts` detects which export it is (by header names, not
column position) and maps rows to `{ query }` entries. The page sends them to
`importItems` in sequential chunks of 25 rows, since each row costs a
provider lookup. Goodreads rows on the `to-read` shelf are skipped rather
than imported, since Shelf only records items you own.

## Agent JSON API

Every endpoint requires `Authorization: Bearer $SHELF_AGENT_TOKEN` (the bare
token without the `Bearer` prefix is also accepted). Failures are
`401 { "error": "Unauthorized" }` and `400 { "error": "Invalid body" }`.
`dryRun: true` resolves and reports everything without writing. Live schemas
live in `src/server/api/{items,item,sync}.ts`.

- `GET /api/items?type=book|movie|tv` → array of items, excluding wishlist
  (`status = "wanted"`) rows — this endpoint answers "what is on the shelf".
  An unknown `type` is `400 { "error": "Invalid type" }`.
- `POST /api/items` — body
  `{ dryRun?, items: [{ type? (default "movie"), query, format?, edition?, status?, year?, tmdbId?, openLibraryKey? }] }`,
  max 40 entries. `query` may carry a trailing year (`"Dune (1984)"`).
  `tmdbId` is digits; `edition` is `theatrical|extended|director-cut` and is
  movie/TV only; `status` is `""|owned` — `borrowed`, `wanted`, and
  reading/watching (now per-member, not an item field — see the database
  section above), fall into the `400 { "error": "Invalid body" }` case; agents
  cannot create wishlist rows. →
  `{ added, skipped, failed, needsReview }`, where `needsReview` carries up to
  5 candidates for an ambiguous `query`.
- `PATCH /api/items/:id` — partial
  `{ title, creator, year, format, edition, status, coverImageUrl, slug }`
  (`status` here also accepts `owned`; `borrowed` is rejected with
  `400 { "error": "Lending is managed through the app's loan actions" }`, and
  `wanted`/`reading`/`watching` are rejected as `400 { "error": "Invalid body" }`
  since they are not valid `status` values here) → the
  updated row. `404` if the id is unknown, `409` if the edition already exists
  on the shelf.
- `DELETE /api/items/:id` → `{ "ok": true }`, or `404`.
- `POST /api/items/sync` — body `{ dryRun?, ids?, type? }`, `ids` max 40 and
  the selection is capped at 40 rows either way. Re-fetches provider metadata.
  → `{ updated, skipped, failed }`.
- `GET /api/export` — unlike the other endpoints above, this one also accepts
  a signed-in session cookie in place of the agent bearer token. Returns
  `{ version, exportedAt, items, lists, listItems, loans }` (version 2: items
  no longer carry `borrower`/`loanedAt` — lending is a top-level `loans`
  section instead): items with their joins (genres, keywords, authors,
  directors, actors, collection), the lists, list membership, and loan history
  (`itemSlug`, `borrowerName`, `lentAt`, `dueAt`, `returnedAt` — no user ids or
  row ids), all keyed by `slug` rather than database id.
