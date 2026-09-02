import { createClient } from "@libsql/client"
import { describe, expect, test } from "vitest"
import { runMigrations } from "./migrate"

describe("merging a provider-linked person into an unlinked one", () => {
  test("clearing the source before updating the survivor avoids the unique index", async () => {
    const client = createClient({ url: ":memory:" })
    await runMigrations(client)
    await client.execute(
      "INSERT INTO directors (id, slug, name, tmdb_person_id) VALUES (1, 'a', 'A', 'tmdb-1'), (2, 'a-2', 'A', NULL)"
    )
    // Old order: update survivor while source still holds the key.
    await expect(
      client.execute(
        "UPDATE directors SET tmdb_person_id = 'tmdb-1' WHERE id = 2"
      )
    ).rejects.toThrow(/UNIQUE/)
    // New order: release the key first.
    await client.execute("DELETE FROM directors WHERE id = 1")
    await client.execute(
      "UPDATE directors SET tmdb_person_id = 'tmdb-1' WHERE id = 2"
    )
    const rows = await client.execute(
      "SELECT id, tmdb_person_id FROM directors"
    )
    expect(rows.rows).toHaveLength(1)
    expect(rows.rows[0]?.tmdb_person_id).toBe("tmdb-1")
  })
})
