import { createClient } from "@libsql/client"
import { runMigrations } from "../src/server/migrate"

const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "file:/tmp/shelf.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
})

await runMigrations(client)
console.log("Database is ready.")
