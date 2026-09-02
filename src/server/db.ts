import { createClient, type Client } from "@libsql/client"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/libsql"
import { SCHEMA_VERSION, readSchemaVersion, runMigrations } from "./migrate"
import { sampleItems } from "./sample-items"
import * as schema from "./schema"

const isEphemeral = !process.env.TURSO_DATABASE_URL
const url = process.env.TURSO_DATABASE_URL ?? "file:/tmp/shelf.db"

const rawClient = import.meta.env.SSR
  ? createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN })
  : null

let ready: Promise<void> | undefined

// One query per process; migrations only run when the schema version moved.
function ensureReady() {
  ready ??= (async () => {
    const client = rawClient!
    if ((await readSchemaVersion(client)) === SCHEMA_VERSION) return
    await runMigrations(client)
    if (isEphemeral) await seedSamples(client)
  })()
  return ready
}

async function seedSamples(client: Client) {
  const rawDb = drizzle({ client, schema })
  const now = new Date().toISOString()
  const count = await client.execute("SELECT COUNT(*) AS count FROM items")
  if (Number(count.rows[0]?.count ?? 0) === 0) {
    await rawDb
      .insert(schema.items)
      .values(
        sampleItems.map((item) => ({ ...item, createdAt: now, updatedAt: now }))
      )
  } else {
    await Promise.all(
      sampleItems.map((item) =>
        rawDb
          .update(schema.items)
          .set({
            status: item.status,
            coverImageUrl: item.coverImageUrl,
            updatedAt: now,
          })
          .where(eq(schema.items.slug, item.slug))
      )
    )
  }
}

const gated = new Set(["execute", "batch", "transaction", "executeMultiple"])

// Every query waits for the schema check first, so callers never have to.
const client = rawClient
  ? new Proxy(rawClient, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver)
        if (typeof value !== "function" || !gated.has(String(property)))
          return value
        return async (...args: unknown[]) => {
          await ensureReady()
          return (value as (...input: unknown[]) => unknown).apply(target, args)
        }
      },
    })
  : null

export const db = import.meta.env.SSR
  ? drizzle({ client: client!, schema })
  : (undefined as unknown as ReturnType<typeof drizzle<typeof schema>>)
