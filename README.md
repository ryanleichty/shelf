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

Visit `http://localhost:3000`. Browse the catalog without signing in. Before the first stored admin account exists, use `/admin/login` with `ADMIN_PASSWORD`, then finish that admin's profile at `/settings`. Afterward, everyone signs in using their email and password.

The seed command adds sample classics to make a first run feel complete. They are example content only, not Ryan Leichty’s actual collection. To start over locally:

```bash
pnpm db:reset
```

Or remove the individual examples from `/admin` and add the real collection.

## Data and database

Shelf uses Drizzle ORM with libSQL. When `TURSO_DATABASE_URL` is present, Shelf uses Turso-compatible libSQL. Without it, Shelf boots from an ephemeral local database at `/tmp/shelf.db` and seeds its sample content automatically on the first request.

| Variable | Purpose |
| --- | --- |
| `ADMIN_PASSWORD` | Temporary first-admin bootstrap password; no longer used once an admin account has been configured |
| `TMDB_API_KEY` | Free TMDB API key for signed-in movie lookup |
| `BLOB_READ_WRITE_TOKEN` | Optional Vercel Blob token for storing uploaded cover images |
| `SHELF_AGENT_TOKEN` | Bearer token required by the private agent JSON API |
| `TURSO_DATABASE_URL` | Turso/libSQL database URL |
| `TURSO_AUTH_TOKEN` | Token for the production database |

Schema changes are created with `pnpm db:generate`; apply the local schema with `pnpm db:migrate`.

The admin’s book search uses Open Library and requires no key. Movie search uses TMDB and needs `TMDB_API_KEY`; the key is only used by authenticated server functions and never reaches the browser.

When `BLOB_READ_WRITE_TOKEN` is configured, a remote cover URL saved through the admin is fetched server-side and persisted to Vercel Blob. Without it, Shelf keeps the original remote URL for local development.

## Deploying to Vercel

1. Create a Turso database and apply the schema using `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` with `pnpm db:migrate`.
2. Import this GitHub repository into Vercel.
3. Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in Vercel’s project settings for durable collection data. Without them, Vercel uses an ephemeral `/tmp` database: the catalog still boots with sample content, but additions disappear when the serverless instance is replaced. Set `ADMIN_PASSWORD` to bootstrap the first admin account, plus optionally `TMDB_API_KEY` and `BLOB_READ_WRITE_TOKEN`.
4. Deploy. The included Nitro Vite plugin supplies TanStack Start SSR and server functions to Vercel; no custom output directory is needed.

## Checks

```bash
pnpm typecheck
pnpm build
```
