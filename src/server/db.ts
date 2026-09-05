import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import { readSchemaVersion, runMigrations, schemaVersion } from "./migrate"
import { seedSampleItems } from "./seed-samples"
import * as schema from "./schema"

const isEphemeral = !process.env.TURSO_DATABASE_URL
const url = process.env.TURSO_DATABASE_URL || "file:/tmp/shelf.db"

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
