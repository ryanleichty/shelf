import { createClient } from "@libsql/client"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/libsql"
import { sampleItems } from "./sample-items"
import * as schema from "./schema"

const isEphemeral = !process.env.TURSO_DATABASE_URL
const url = process.env.TURSO_DATABASE_URL ?? "file:/tmp/shelf.db"

const client = import.meta.env.SSR
  ? createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  : null

export const db = import.meta.env.SSR
  ? drizzle({ client: client!, schema })
  : (undefined as unknown as ReturnType<typeof drizzle<typeof schema>>)

function getClient() {
  if (!client)
    throw new Error("Database access is only available on the server.")
  return client
}

let setupPromise: Promise<void> | undefined

export function ensureDatabase() {
  setupPromise ??= (async () => {
    await getClient().execute(`
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'owned',
        title TEXT NOT NULL,
        creator TEXT NOT NULL,
        year INTEGER NOT NULL,
        cover_image_url TEXT,
        open_library_key TEXT,
        tmdb_id TEXT,
        barcode TEXT UNIQUE,
        borrower TEXT,
        loaned_at TEXT,
        format TEXT,
        edition TEXT,
        genres TEXT NOT NULL DEFAULT '[]',
        description TEXT,
        notes TEXT NOT NULL DEFAULT '',
        acquired_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)
    const columns = await getClient().execute("PRAGMA table_info(items)")
    if (!columns.rows.some((column) => column.name === "status")) {
      await getClient().execute(
        "ALTER TABLE items ADD COLUMN status TEXT NOT NULL DEFAULT 'owned'"
      )
    }
    if (!columns.rows.some((column) => column.name === "open_library_key")) {
      await getClient().execute(
        "ALTER TABLE items ADD COLUMN open_library_key TEXT"
      )
    }
    if (!columns.rows.some((column) => column.name === "tmdb_id")) {
      await getClient().execute("ALTER TABLE items ADD COLUMN tmdb_id TEXT")
    }
    if (!columns.rows.some((column) => column.name === "barcode")) {
      await getClient().execute("ALTER TABLE items ADD COLUMN barcode TEXT")
    }
    await getClient().execute(
      "CREATE UNIQUE INDEX IF NOT EXISTS items_barcode_unique ON items(barcode) WHERE barcode IS NOT NULL"
    )
    if (!columns.rows.some((column) => column.name === "borrower")) {
      await getClient().execute("ALTER TABLE items ADD COLUMN borrower TEXT")
    }
    if (!columns.rows.some((column) => column.name === "loaned_at")) {
      await getClient().execute("ALTER TABLE items ADD COLUMN loaned_at TEXT")
    }
    if (!columns.rows.some((column) => column.name === "format")) {
      await getClient().execute("ALTER TABLE items ADD COLUMN format TEXT")
    }
    if (!columns.rows.some((column) => column.name === "edition")) {
      await getClient().execute("ALTER TABLE items ADD COLUMN edition TEXT")
    }
    if (!columns.rows.some((column) => column.name === "genres"))
      await getClient().execute(
        "ALTER TABLE items ADD COLUMN genres TEXT NOT NULL DEFAULT '[]'"
      )
    if (!columns.rows.some((column) => column.name === "description"))
      await getClient().execute("ALTER TABLE items ADD COLUMN description TEXT")
    await getClient().execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL DEFAULT 'member',
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)
    await getClient().execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `)
    await getClient().execute(
      "CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id)"
    )
    await getClient().execute(`
      CREATE TABLE IF NOT EXISTS genres (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL
      )
    `)
    await getClient().execute(`
      CREATE TABLE IF NOT EXISTS item_genres (
        item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        genre_id INTEGER NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
        UNIQUE(item_id, genre_id)
      )
    `)
    await getClient().execute(`
      CREATE TABLE IF NOT EXISTS keywords (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL
      )
    `)
    await getClient().execute(`
      CREATE TABLE IF NOT EXISTS item_keywords (
        item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        keyword_id INTEGER NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
        UNIQUE(item_id, keyword_id)
      )
    `)
    await getClient().execute(`
      CREATE TABLE IF NOT EXISTS authors (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL
      )
    `)
    await getClient().execute(`
      CREATE TABLE IF NOT EXISTS item_authors (
        item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        author_id INTEGER NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
        UNIQUE(item_id, author_id)
      )
    `)
    await getClient().execute(`
      CREATE TABLE IF NOT EXISTS directors (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL
      )
    `)
    await getClient().execute(`
      CREATE TABLE IF NOT EXISTS item_directors (
        item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        director_id INTEGER NOT NULL REFERENCES directors(id) ON DELETE CASCADE,
        UNIQUE(item_id, director_id)
      )
    `)
    await getClient().execute(`
      CREATE TABLE IF NOT EXISTS actors (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL
      )
    `)
    await getClient().execute(`
      CREATE TABLE IF NOT EXISTS item_actors (
        item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        actor_id INTEGER NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        UNIQUE(item_id, actor_id)
      )
    `)
    await getClient().execute(`
      CREATE TABLE IF NOT EXISTS collections (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        tmdb_collection_id TEXT UNIQUE,
        overview TEXT
      )
    `)
    await getClient().execute(`
      CREATE TABLE IF NOT EXISTS item_collections (
        item_id INTEGER NOT NULL UNIQUE REFERENCES items(id) ON DELETE CASCADE,
        collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
        UNIQUE(item_id, collection_id)
      )
    `)
    await getClient().execute(`
      CREATE VIRTUAL TABLE IF NOT EXISTS item_search USING fts5(
        title, creator, description, genres, keywords
      )
    `)
    await migrateLegacyGenres()
    await migrateLegacyCreators()
    await getClient().execute(`
      CREATE TABLE IF NOT EXISTS lists (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        system INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )
    `)
    const listColumns = await getClient().execute("PRAGMA table_info(lists)")
    if (!listColumns.rows.some((column) => column.name === "system")) {
      await getClient().execute(
        "ALTER TABLE lists ADD COLUMN system INTEGER NOT NULL DEFAULT 0"
      )
    }
    await getClient().execute(`
      CREATE TABLE IF NOT EXISTS list_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
        item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        added_at TEXT NOT NULL,
        UNIQUE(list_id, item_id)
      )
    `)
    await getClient().execute(`
      CREATE TABLE IF NOT EXISTS list_placements (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        list_id INTEGER REFERENCES lists(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        type TEXT NOT NULL,
        position INTEGER NOT NULL,
        visible INTEGER NOT NULL DEFAULT 1,
        UNIQUE(list_id, type)
      )
    `)
    const placementColumns = await getClient().execute(
      "PRAGMA table_info(list_placements)"
    )
    if (
      !placementColumns.rows.some((column) => column.name === "kind") ||
      placementColumns.rows.find((column) => column.name === "list_id")?.notnull
    ) {
      await getClient().execute(`
        CREATE TABLE list_placements_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
          list_id INTEGER REFERENCES lists(id) ON DELETE CASCADE,
          kind TEXT NOT NULL,
          type TEXT NOT NULL,
          position INTEGER NOT NULL,
          visible INTEGER NOT NULL DEFAULT 1,
          UNIQUE(list_id, type)
        );
        INSERT INTO list_placements_new (id, list_id, kind, type, position, visible)
        SELECT id, list_id, 'list', type, position, visible FROM list_placements;
        DROP TABLE list_placements;
        ALTER TABLE list_placements_new RENAME TO list_placements;
      `)
    }
    const now = new Date().toISOString()
    await getClient().execute({
      sql: `
        INSERT INTO lists (slug, name, system, created_at)
        VALUES (?, ?, 1, ?), (?, ?, 1, ?)
        ON CONFLICT(slug) DO UPDATE SET system = 1
      `,
      args: [
        "watchlist",
        "Watchlist",
        now,
        "reading-list",
        "Reading list",
        now,
      ],
    })
    await getClient().execute(`
      INSERT INTO list_placements (list_id, kind, type, position, visible)
      SELECT id, 'list', 'book', 1, 1 FROM lists WHERE slug = 'reading-list'
      ON CONFLICT(list_id, type) DO NOTHING
    `)
    await getClient().execute(`
      INSERT INTO list_placements (list_id, kind, type, position, visible)
      SELECT id, 'list', 'movie', 1, 1 FROM lists WHERE slug = 'watchlist'
      ON CONFLICT(list_id, type) DO NOTHING
    `)
    await getClient().execute(`
      INSERT INTO list_placements (list_id, kind, type, position, visible)
      SELECT id, 'list', 'tv', 1, 1 FROM lists WHERE slug = 'watchlist'
      ON CONFLICT(list_id, type) DO NOTHING
    `)
    for (const type of ["book", "movie", "tv"]) {
      await getClient().execute({
        sql: `
          INSERT INTO list_placements (list_id, kind, type, position, visible)
          SELECT NULL, 'recent', ?, 0, 1
          WHERE NOT EXISTS (
            SELECT 1 FROM list_placements WHERE kind = 'recent' AND type = ?
          )
        `,
        args: [type, type],
      })
    }
    if (!isEphemeral) return
    const count = await getClient().execute(
      "SELECT COUNT(*) AS count FROM items"
    )
    if (Number(count.rows[0]?.count ?? 0) === 0) {
      await db.insert(schema.items).values(
        sampleItems.map((item) => ({
          ...item,
          createdAt: now,
          updatedAt: now,
        }))
      )
      await refreshSearchIndex()
      return
    }
    await Promise.all(
      sampleItems.map((item) =>
        db
          .update(schema.items)
          .set({
            status: item.status,
            coverImageUrl: item.coverImageUrl,
            updatedAt: now,
          })
          .where(eq(schema.items.slug, item.slug))
      )
    )
    await refreshSearchIndex()
  })()
  return setupPromise
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

async function replaceGenreJoins(itemId: number, names: string[]) {
  const client = getClient()
  for (const name of [
    ...new Set(names.map((name) => name.trim()).filter(Boolean)),
  ]) {
    const slug = slugify(name)
    if (!slug) continue
    await client.execute({
      sql: "INSERT INTO genres (slug, name) VALUES (?, ?) ON CONFLICT(slug) DO NOTHING",
      args: [slug, name],
    })
    await client.execute({
      sql: "INSERT INTO item_genres (item_id, genre_id) SELECT ?, id FROM genres WHERE slug = ? ON CONFLICT DO NOTHING",
      args: [itemId, slug],
    })
  }
}

async function migrateLegacyGenres() {
  const client = getClient()
  const columns = await client.execute("PRAGMA table_info(items)")
  if (!columns.rows.some((column) => column.name === "genres")) return
  const legacyItems = await client.execute("SELECT id, genres FROM items")
  for (const row of legacyItems.rows) {
    try {
      const names = JSON.parse(String(row.genres ?? "[]"))
      if (Array.isArray(names)) await replaceGenreJoins(Number(row.id), names)
    } catch {
      // Ignore malformed legacy JSON rather than blocking database startup.
    }
  }
}

function parseCreatorNames(creator: string) {
  return creator
    .split(/,|\s+and\s+|\s+&\s+/i)
    .map((name) => name.trim())
    .filter(Boolean)
}

async function replaceCreatorJoins(
  itemId: number,
  kind: "author" | "director",
  names: string[]
) {
  const client = getClient()
  const table = kind === "author" ? "authors" : "directors"
  const joinTable = kind === "author" ? "item_authors" : "item_directors"
  const personColumn = kind === "author" ? "author_id" : "director_id"
  for (const name of [...new Set(names)]) {
    const slug = slugify(name)
    if (!slug) continue
    await client.execute({
      sql: `INSERT INTO ${table} (slug, name) VALUES (?, ?) ON CONFLICT(slug) DO NOTHING`,
      args: [slug, name],
    })
    await client.execute({
      sql: `INSERT INTO ${joinTable} (item_id, ${personColumn}) SELECT ?, id FROM ${table} WHERE slug = ? ON CONFLICT DO NOTHING`,
      args: [itemId, slug],
    })
  }
}

async function migrateLegacyCreators() {
  const client = getClient()
  const legacyItems = await client.execute(`
    SELECT id, type, creator FROM items
    WHERE
      (type = 'book' AND NOT EXISTS (
        SELECT 1 FROM item_authors WHERE item_authors.item_id = items.id
      ))
      OR
      (type IN ('movie', 'tv') AND NOT EXISTS (
        SELECT 1 FROM item_directors WHERE item_directors.item_id = items.id
      ))
  `)
  for (const row of legacyItems.rows) {
    const kind = row.type === "book" ? "author" : "director"
    await replaceCreatorJoins(
      Number(row.id),
      kind,
      parseCreatorNames(String(row.creator ?? ""))
    )
  }
}

export async function refreshSearchIndex() {
  const client = getClient()
  await client.execute("DELETE FROM item_search")
  await client.execute(`
    INSERT INTO item_search (rowid, title, creator, description, genres, keywords)
    SELECT
      items.id,
      items.title,
      items.creator,
      COALESCE(items.description, ''),
      COALESCE((SELECT group_concat(genres.name, ' ') FROM item_genres JOIN genres ON genres.id = item_genres.genre_id WHERE item_genres.item_id = items.id), ''),
      COALESCE((SELECT group_concat(keywords.name, ' ') FROM item_keywords JOIN keywords ON keywords.id = item_keywords.keyword_id WHERE item_keywords.item_id = items.id), '')
    FROM items
  `)
}
