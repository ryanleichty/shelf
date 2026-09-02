import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import { describe, expect, test } from "vitest"
import { seedSampleItems } from "./db"
import { runMigrations } from "./migrate"
import { sampleItems } from "./sample-items"
import * as schema from "./schema"

describe("seedSampleItems", () => {
  test("inserts samples once and keeps an existing cover on re-run", async () => {
    const client = createClient({ url: ":memory:" })
    await runMigrations(client)
    const database = drizzle({ client, schema })
    await seedSampleItems(database)
    const first = sampleItems[0]!
    await client.execute({
      sql: "UPDATE items SET cover_image_url = 'https://example.test/custom.jpg' WHERE slug = ?",
      args: [first.slug],
    })
    await seedSampleItems(database)
    const rows = await client.execute({
      sql: "SELECT cover_image_url, (SELECT COUNT(*) FROM items) AS total FROM items WHERE slug = ?",
      args: [first.slug],
    })
    expect(rows.rows[0]?.cover_image_url).toBe(
      "https://example.test/custom.jpg"
    )
    expect(Number(rows.rows[0]?.total)).toBe(sampleItems.length)
  })
})
