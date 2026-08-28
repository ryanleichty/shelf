# Shelf

A small, personal inventory for books and movies. The public catalog is for browsing; the quiet admin area is for Ryan to maintain the collection.

## Local development

```bash
pnpm install
cp .env.example .env
# Set ADMIN_PASSWORD and SESSION_SECRET in .env
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Visit `http://localhost:3000`. The admin lives at `/admin`; log in using the `ADMIN_PASSWORD` in your local `.env`.

The seed command adds sample classics to make a first run feel complete. They are example content only, not Ryan Leichty’s actual collection. To start over locally:

```bash
pnpm db:reset
```

Or remove the individual examples from `/admin` and add the real collection.

## Data and database

Shelf uses Drizzle ORM with libSQL. Development defaults to the untracked local database at `data/shelf.db`. Production uses Turso-compatible libSQL when both variables below are present:

| Variable | Purpose |
| --- | --- |
| `ADMIN_PASSWORD` | Password that grants access to `/admin` |
| `SESSION_SECRET` | Random 32+ character secret for the signed admin cookie |
| `TMDB_API_KEY` | Free TMDB API key for admin-only movie lookup |
| `TURSO_DATABASE_URL` | Turso/libSQL database URL |
| `TURSO_AUTH_TOKEN` | Token for the production database |

Schema changes are created with `pnpm db:generate`; apply the local schema with `pnpm db:migrate`.

The admin’s book search uses Open Library and requires no key. Movie search uses TMDB and needs `TMDB_API_KEY`; the key is only used by authenticated server functions and never reaches the browser.

## Deploying to Vercel

1. Create a Turso database and apply the schema using `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` with `pnpm db:migrate`.
2. Import this GitHub repository into Vercel.
3. Set the required environment variables above in Vercel’s project settings (include `TMDB_API_KEY` to enable movie lookup).
4. Deploy. The included Nitro Vite plugin supplies TanStack Start SSR and server functions to Vercel; no custom output directory is needed.

## Checks

```bash
pnpm typecheck
pnpm build
```
