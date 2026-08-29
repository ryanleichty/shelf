import { createClient } from "@libsql/client"

const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "file:/tmp/shelf.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
})

await client.execute(`
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
    notes TEXT NOT NULL DEFAULT '',
    acquired_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`)
const columns = await client.execute("PRAGMA table_info(items)")
if (!columns.rows.some((column) => column.name === "status")) {
  await client.execute(
    "ALTER TABLE items ADD COLUMN status TEXT NOT NULL DEFAULT 'owned'"
  )
}
if (!columns.rows.some((column) => column.name === "open_library_key")) {
  await client.execute("ALTER TABLE items ADD COLUMN open_library_key TEXT")
}
if (!columns.rows.some((column) => column.name === "tmdb_id")) {
  await client.execute("ALTER TABLE items ADD COLUMN tmdb_id TEXT")
}
if (!columns.rows.some((column) => column.name === "borrower")) {
  await client.execute("ALTER TABLE items ADD COLUMN borrower TEXT")
}
if (!columns.rows.some((column) => column.name === "loaned_at")) {
  await client.execute("ALTER TABLE items ADD COLUMN loaned_at TEXT")
}
if (!columns.rows.some((column) => column.name === "format")) {
  await client.execute("ALTER TABLE items ADD COLUMN format TEXT")
}
if (!columns.rows.some((column) => column.name === "edition")) {
  await client.execute("ALTER TABLE items ADD COLUMN edition TEXT")
}
if (!columns.rows.some((column) => column.name === "genres")) {
  await client.execute(
    "ALTER TABLE items ADD COLUMN genres TEXT NOT NULL DEFAULT '[]'"
  )
}
const now = new Date().toISOString()
await client.execute(`
  CREATE TABLE IF NOT EXISTS lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`)
await client.execute(`
  CREATE TABLE IF NOT EXISTS list_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    added_at TEXT NOT NULL,
    UNIQUE(list_id, item_id)
  )
`)
await client.execute({
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

console.log("Database is ready.")
