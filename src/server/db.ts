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
  if (!client) throw new Error("Database access is only available on the server.")
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
      CREATE VIRTUAL TABLE IF NOT EXISTS item_search USING fts5(
        title, creator, description, genres, keywords
      )
    `)
    await migrateLegacyGenres()
    await getClient().execute(`
      CREATE TABLE IF NOT EXISTS lists (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `)
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
    const now = new Date().toISOString()
    await getClient().execute({
      sql: `
        INSERT INTO lists (slug, name, created_at)
        VALUES (?, ?, ?), (?, ?, ?)
        ON CONFLICT(slug) DO NOTHING
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
    if (!isEphemeral) return
    const count = await getClient().execute("SELECT COUNT(*) AS count FROM items")
    if (Number(count.rows[0]?.count ?? 0) === 0) {
      await db
        .insert(schema.items)
        .values(
          sampleItems.map(({ genres: _genres, ...item }) => ({
            ...item,
            createdAt: now,
            updatedAt: now,
          }))
        )
      const seededItems = await db.select().from(schema.items)
      await Promise.all(
        sampleItems.map((item) => {
          const seeded = seededItems.find((candidate) => candidate.slug === item.slug)
          return seeded ? replaceGenreJoins(seeded.id, item.genres) : undefined
        })
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
  for (const name of [...new Set(names.map((name) => name.trim()).filter(Boolean))]) {
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
