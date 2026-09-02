// One-off: fill tagline/logo/trailer on movies and TV, and part order on
// collections, so the home billboard needs no runtime TMDB calls.
import { createClient } from "@libsql/client"
import { fetchTmdbCollectionPartIds, fetchTmdbExtras } from "../src/server/tmdb"

const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "file:/tmp/shelf.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
})

const screen = await client.execute(
  "SELECT id, type, tmdb_id FROM items WHERE type IN ('movie','tv') AND tmdb_id IS NOT NULL AND trailer_key IS NULL AND logo_image_url IS NULL AND tagline IS NULL"
)
let filled = 0
for (const row of screen.rows) {
  const extras = await fetchTmdbExtras(
    row.type as "movie" | "tv",
    String(row.tmdb_id)
  )
  await client.execute({
    sql: "UPDATE items SET tagline = ?, logo_image_url = ?, trailer_key = ? WHERE id = ?",
    args: [
      extras.tagline,
      extras.logoImageUrl,
      extras.trailerKey,
      Number(row.id),
    ],
  })
  filled++
}
const collections = await client.execute(
  "SELECT id, tmdb_collection_id FROM collections WHERE tmdb_collection_id IS NOT NULL AND part_ids IS NULL"
)
let parts = 0
for (const row of collections.rows) {
  const partIds = await fetchTmdbCollectionPartIds(
    String(row.tmdb_collection_id)
  )
  if (!partIds.length) continue
  await client.execute({
    sql: "UPDATE collections SET part_ids = ? WHERE id = ?",
    args: [JSON.stringify(partIds), Number(row.id)],
  })
  parts++
}
console.log(`Filled ${filled} items and ${parts} collections.`)
