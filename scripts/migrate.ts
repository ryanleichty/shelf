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
    notes TEXT NOT NULL DEFAULT '',
    acquired_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`)
const columns = await client.execute("PRAGMA table_info(items)")
if (!columns.rows.some((column) => column.name === "status")) {
  await client.execute("ALTER TABLE items ADD COLUMN status TEXT NOT NULL DEFAULT 'owned'")
}

console.log("Database is ready.")
