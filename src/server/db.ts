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
    if (!isEphemeral) return
    const now = new Date().toISOString()
    const count = await getClient().execute("SELECT COUNT(*) AS count FROM items")
    if (Number(count.rows[0]?.count ?? 0) === 0) {
      await db
        .insert(schema.items)
        .values(
          sampleItems.map((item) => ({
            ...item,
            createdAt: now,
            updatedAt: now,
          }))
        )
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
  })()
  return setupPromise
}
