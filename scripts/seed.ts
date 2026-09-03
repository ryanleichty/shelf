import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import * as schema from "../src/server/schema"
import { seedSampleItems } from "../src/server/seed-samples"

const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "file:/tmp/shelf.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
})

await seedSampleItems(drizzle({ client, schema }))
console.log("Sample shelf content added.")
