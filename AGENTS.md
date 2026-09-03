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
| `pnpm typecheck`       | Generates the route tree if missing, then `tsc --noEmit`      |
| `pnpm routes:generate` | Writes `src/routeTree.gen.ts` only when it is absent          |
| `pnpm bundle:check`    | Client bundle size budget (`scripts/check-bundle-budget.mjs`) |
| `pnpm db:migrate`      | Applies `runMigrations` ahead of time                         |
| `pnpm db:seed`         | Inserts the sample classics                                   |
| `pnpm db:reset`        | Deletes `/tmp/shelf.db`, then migrate + seed                  |

The full local gate:

```bash
pnpm lint && pnpm check && pnpm typecheck && pnpm test && pnpm build && pnpm bundle:check
```

## Fresh clone

`src/routeTree.gen.ts` is generated and gitignored. `pnpm typecheck` generates
it when missing; `pnpm dev` and `pnpm build` keep it current. A bare `tsc` in a
fresh clone will fail on the missing file — run `pnpm typecheck` instead.

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

## Agent JSON API

Every endpoint requires `Authorization: Bearer $SHELF_AGENT_TOKEN` (the bare
token without the `Bearer` prefix is also accepted). Failures are
`401 { "error": "Unauthorized" }` and `400 { "error": "Invalid body" }`.
`dryRun: true` resolves and reports everything without writing. Live schemas
live in `src/server/api/{items,item,sync}.ts`.

- `GET /api/items?type=book|movie|tv` → array of items. An unknown `type` is
  `400 { "error": "Invalid type" }`.
- `POST /api/items` — body
  `{ dryRun?, items: [{ type? (default "movie"), query, format?, edition?, status?, year?, tmdbId?, openLibraryKey? }] }`,
  max 40 entries. `query` may carry a trailing year (`"Dune (1984)"`).
  `tmdbId` is digits; `edition` is `theatrical|extended|director-cut` and is
  movie/TV only; `status` is `""|reading|watching|borrowed` and defaults to
  `owned`. → `{ added, skipped, failed, needsReview }`, where `needsReview`
  carries up to 5 candidates for an ambiguous `query`.
- `PATCH /api/items/:id` — partial
  `{ title, creator, year, format, edition, status, coverImageUrl, slug }`
  (`status` here also accepts `owned`) → the updated row. `404` if the id is
  unknown, `409` if the edition already exists on the shelf.
- `DELETE /api/items/:id` → `{ "ok": true }`, or `404`.
- `POST /api/items/sync` — body `{ dryRun?, ids?, type? }`, `ids` max 40 and
  the selection is capped at 40 rows either way. Re-fetches provider metadata.
  → `{ updated, skipped, failed }`.

## Plans

`plans/README.md` tracks advisor-generated implementation plans and their
status.
