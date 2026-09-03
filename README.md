# Shelf

A small, shared inventory for books and movies. The catalog is public: anyone can browse it without an account. Sign-in is required only to add or edit catalog items, manage shared lists, use collection lookup, or access Settings and user management.

## Local development

```bash
pnpm install
cp .env.example .env
# Set ADMIN_PASSWORD in .env for the first-admin bootstrap
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Working with an agent? Read `AGENTS.md` for commands, conventions and the agent JSON API.

Visit `http://localhost:3000`. Browse the catalog without signing in. Before the first stored admin account exists, use `/admin/login` with `ADMIN_PASSWORD`, then finish that admin's profile at `/settings`. Afterward, everyone signs in using their email and password.

The seed command adds sample classics to make a first run feel complete. They are example content only, not Ryan Leichty’s actual collection. To start over locally:

```bash
pnpm db:reset
```

Or remove the individual examples from `/admin` and add the real collection.

## Data and database

Shelf uses Drizzle ORM with libSQL. When `TURSO_DATABASE_URL` is present, Shelf uses Turso-compatible libSQL. Without it, Shelf boots from an ephemeral local database at `/tmp/shelf.db` and seeds its sample content automatically on the first request. Schema migrations are hand-written in `src/server/migrate.ts` (`runMigrations`). They run automatically on the first query of a process when the stored version in the `schema_meta` table differs from `SCHEMA_VERSION`, which is derived from the migration source, and `pnpm db:migrate` applies them ahead of time.

| Variable                | Purpose                                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| `ADMIN_PASSWORD`        | Temporary first-admin bootstrap password; no longer used once an admin account has been configured    |
| `TMDB_API_KEY`          | Free TMDB API key for signed-in movie lookup and for storing taglines, logos and trailer keys on save |
| `UPCMDB_API_KEY`        | Optional UPCitemdb key for disc barcode lookup in the barcode check and item form                     |
| `BLOB_READ_WRITE_TOKEN` | Optional Vercel Blob token for storing uploaded cover images                                          |
| `SHELF_AGENT_TOKEN`     | Bearer token required by the private agent JSON API                                                   |
| `TURSO_DATABASE_URL`    | Turso/libSQL database URL                                                                             |
| `TURSO_AUTH_TOKEN`      | Token for the production database                                                                     |

To change the schema, add an idempotent statement to `runMigrations` (`CREATE TABLE IF NOT EXISTS`, or a `PRAGMA table_info` guarded `ALTER TABLE`) and update `src/server/schema.ts` to match. The version updates itself.

The admin’s book search uses Open Library and requires no key. Movie and TV search use TMDB and need `TMDB_API_KEY`; the key is only used by authenticated server functions and never reaches the browser.

When `BLOB_READ_WRITE_TOKEN` is configured, a remote cover URL saved through the admin is fetched server-side and persisted to Vercel Blob. Without it, Shelf keeps the original remote URL for local development.

A full JSON export of the catalog — items with their joins, lists, and list order — is available at `/api/export` and linked from Settings. It is the backup path when running on the ephemeral `/tmp` database.

## Deploying to Vercel

1. Create a Turso database and apply the schema using `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` with `pnpm db:migrate`.
2. Import this GitHub repository into Vercel.
3. Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in Vercel’s project settings for durable collection data. Without them, Vercel uses an ephemeral `/tmp` database: the catalog still boots with sample content, but additions disappear when the serverless instance is replaced. Set `ADMIN_PASSWORD` to bootstrap the first admin account, plus optionally `TMDB_API_KEY` and `BLOB_READ_WRITE_TOKEN`.
4. Deploy. The included Nitro Vite plugin supplies TanStack Start SSR and server functions to Vercel; no custom output directory is needed.

`nitro` is pinned to an exact prerelease build; the CI SSR smoke test guards the upgrade.

## Checks

```bash
pnpm lint
pnpm check
pnpm typecheck
pnpm test
pnpm build
```

`pnpm typecheck` generates `src/routeTree.gen.ts` if it is missing; the file is
gitignored, and `pnpm dev`/`pnpm build` keep it current.
