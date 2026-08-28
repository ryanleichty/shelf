import { mkdirSync } from "node:fs"
import { createClient } from "@libsql/client"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/libsql"
import { sampleItems } from "./sample-items"
import * as schema from "./schema"

const isEphemeral = !process.env.TURSO_DATABASE_URL
if (isEphemeral) mkdirSync("/tmp", { recursive: true })
const url = process.env.TURSO_DATABASE_URL ?? "file:/tmp/shelf.db"

const client = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

export const db = drizzle({ client, schema })

let setupPromise: Promise<void> | undefined

export function ensureDatabase() {
  if (!isEphemeral) return Promise.resolve()
  setupPromise ??= (async () => {
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
    const now = new Date().toISOString()
    const count = await client.execute("SELECT COUNT(*) AS count FROM items")
    if (Number(count.rows[0]?.count ?? 0) === 0) {
      await db.insert(schema.items).values(
        sampleItems.map((item) => ({ ...item, createdAt: now, updatedAt: now })),
      )
      return
    }
    await Promise.all(sampleItems.map((item) =>
      db.update(schema.items)
        .set({
          status: item.status,
          coverImageUrl: item.coverImageUrl,
          updatedAt: now,
        })
        .where(eq(schema.items.slug, item.slug)),
    ))
  })()
  return setupPromise
}
