import { createClient } from "@libsql/client"
import { sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/libsql"
import { readSchemaVersion, runMigrations, schemaVersion } from "./migrate"
import { sampleItems } from "./sample-items"
import * as schema from "./schema"

const isEphemeral = !process.env.TURSO_DATABASE_URL
const url = process.env.TURSO_DATABASE_URL ?? "file:/tmp/shelf.db"

const rawClient = import.meta.env.SSR
  ? createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN })
  : null

let ready: Promise<void> | undefined

// One query per process; migrations only run when the schema version moved.
// A failed check is forgotten so the next request retries instead of the
// process staying broken until redeploy.
function ensureReady() {
  ready ??= (async () => {
    const client = rawClient!
    if ((await readSchemaVersion(client)) === schemaVersion()) return
    await runMigrations(client)
    if (isEphemeral) await seedSampleItems(drizzle({ client, schema }))
  })().catch((error: unknown) => {
    ready = undefined
    throw error
  })
  return ready
}

// Inserts the sample classics, or refreshes their status while keeping any
// cover an admin already replaced. Shared by the ephemeral boot path and
// `pnpm db:seed`.
export async function seedSampleItems(
  database: ReturnType<typeof drizzle<typeof schema>>
) {
  const now = new Date().toISOString()
  await database
    .insert(schema.items)
    .values(
      sampleItems.map((item) => ({ ...item, createdAt: now, updatedAt: now }))
    )
    .onConflictDoUpdate({
      target: schema.items.slug,
      set: {
        status: sql`excluded.status`,
        coverImageUrl: sql`coalesce(${schema.items.coverImageUrl}, excluded.cover_image_url)`,
        updatedAt: now,
      },
    })
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
