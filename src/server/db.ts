import { mkdirSync } from "node:fs"
import { createClient } from "@libsql/client"
import { and, eq, isNull } from "drizzle-orm"
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
        .set({ coverImageUrl: item.coverImageUrl, updatedAt: now })
        .where(and(eq(schema.items.slug, item.slug), isNull(schema.items.coverImageUrl))),
    ))
  })()
  return setupPromise
}
