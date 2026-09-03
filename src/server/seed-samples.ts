import { inArray, sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/libsql"
import { sampleItems } from "./sample-items"
import * as schema from "./schema"

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
      sampleItems.map(({ borrowedBy: _borrowedBy, ...item }) => ({
        ...item,
        createdAt: now,
        updatedAt: now,
      }))
    )
    .onConflictDoUpdate({
      target: schema.items.slug,
      set: {
        status: sql`excluded.status`,
        coverImageUrl: sql`coalesce(${schema.items.coverImageUrl}, excluded.cover_image_url)`,
        updatedAt: now,
      },
    })

  const borrowedRows = sampleItems.filter((item) => item.borrowedBy)
  if (borrowedRows.length) {
    const itemRows = await database
      .select({ id: schema.items.id, slug: schema.items.slug })
      .from(schema.items)
      .where(
        inArray(
          schema.items.slug,
          borrowedRows.map((item) => item.slug)
        )
      )
    const idBySlug = new Map(itemRows.map((row) => [row.slug, row.id]))
    const loanRows = borrowedRows.flatMap((item) => {
      const itemId = idBySlug.get(item.slug)
      return itemId
        ? [
            {
              itemId,
              borrowerName: item.borrowedBy!,
              lentAt: now.slice(0, 10),
              createdAt: now,
            },
          ]
        : []
    })
    if (loanRows.length)
      await database.insert(schema.loans).values(loanRows).onConflictDoNothing()
  }
}
