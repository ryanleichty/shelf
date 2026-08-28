import { sql } from "drizzle-orm"
import { db } from "../src/server/db"
import { sampleItems } from "../src/server/sample-items"
import { items } from "../src/server/schema"

const now = new Date().toISOString()

await db
  .insert(items)
  .values(sampleItems.map((item) => ({ ...item, createdAt: now, updatedAt: now })))
  .onConflictDoUpdate({
    target: items.slug,
    set: {
      status: sql`excluded.status`,
      coverImageUrl: sql`coalesce(items.cover_image_url, excluded.cover_image_url)`,
      updatedAt: now,
    },
  })

console.log("Sample shelf content added.")
