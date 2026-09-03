import type { Client } from "@libsql/client"
import { parseCreatorNames, slugify } from "@/lib/catalog"
import { READLIST_NAME, READLIST_SLUG } from "@/lib/system-lists"

// Derived from the migration source, so any edit to runMigrations re-runs it
// once per database. db.ts compares it with the schema_meta row so a warm
// schema still costs one query per process. Computed lazily: a top-level
// reference to runMigrations would pull the whole function into client
// bundles, which import this module through db.ts.
export function schemaVersion() {
  return fingerprint(runMigrations.toString())
}

function fingerprint(source: string) {
  let hash = 2166136261
  for (const character of source)
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  return hash >>> 0
}

export async function runMigrations(client: Client) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'owned',
      title TEXT NOT NULL,
      creator TEXT NOT NULL,
      year INTEGER NOT NULL,
      cover_image_url TEXT,
      backdrop_image_url TEXT,
      open_library_key TEXT,
      tmdb_id TEXT,
      barcode TEXT UNIQUE,
      format TEXT,
      edition TEXT,
      genres TEXT NOT NULL DEFAULT '[]',
      description TEXT,
      subtitle TEXT,
      page_count INTEGER,
      publisher TEXT,
      isbn_13 TEXT,
      notes TEXT NOT NULL DEFAULT '',
      acquired_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  const columns = await client.execute("PRAGMA table_info(items)")
  if (!columns.rows.some((column) => column.name === "status")) {
    await client.execute(
      "ALTER TABLE items ADD COLUMN status TEXT NOT NULL DEFAULT 'owned'"
    )
  }
  if (!columns.rows.some((column) => column.name === "open_library_key")) {
    await client.execute("ALTER TABLE items ADD COLUMN open_library_key TEXT")
  }
  if (!columns.rows.some((column) => column.name === "tmdb_id")) {
    await client.execute("ALTER TABLE items ADD COLUMN tmdb_id TEXT")
  }
  if (!columns.rows.some((column) => column.name === "barcode")) {
    await client.execute("ALTER TABLE items ADD COLUMN barcode TEXT")
  }
  await client.execute(
    "CREATE UNIQUE INDEX IF NOT EXISTS items_barcode_unique ON items(barcode) WHERE barcode IS NOT NULL"
  )
  if (!columns.rows.some((column) => column.name === "format")) {
    await client.execute("ALTER TABLE items ADD COLUMN format TEXT")
  }
  if (!columns.rows.some((column) => column.name === "edition")) {
    await client.execute("ALTER TABLE items ADD COLUMN edition TEXT")
  }
  if (!columns.rows.some((column) => column.name === "genres"))
    await client.execute(
      "ALTER TABLE items ADD COLUMN genres TEXT NOT NULL DEFAULT '[]'"
    )
  if (!columns.rows.some((column) => column.name === "description"))
    await client.execute("ALTER TABLE items ADD COLUMN description TEXT")
  if (!columns.rows.some((column) => column.name === "backdrop_image_url"))
    await client.execute("ALTER TABLE items ADD COLUMN backdrop_image_url TEXT")
  if (!columns.rows.some((column) => column.name === "certification"))
    await client.execute("ALTER TABLE items ADD COLUMN certification TEXT")
  if (!columns.rows.some((column) => column.name === "runtime"))
    await client.execute("ALTER TABLE items ADD COLUMN runtime INTEGER")
  if (!columns.rows.some((column) => column.name === "subtitle"))
    await client.execute("ALTER TABLE items ADD COLUMN subtitle TEXT")
  if (!columns.rows.some((column) => column.name === "page_count"))
    await client.execute("ALTER TABLE items ADD COLUMN page_count INTEGER")
  if (!columns.rows.some((column) => column.name === "publisher"))
    await client.execute("ALTER TABLE items ADD COLUMN publisher TEXT")
  if (!columns.rows.some((column) => column.name === "isbn_13"))
    await client.execute("ALTER TABLE items ADD COLUMN isbn_13 TEXT")
  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      avatar_url TEXT,
      role TEXT NOT NULL DEFAULT 'member',
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  const userColumns = await client.execute("PRAGMA table_info(users)")
  if (!userColumns.rows.some((column) => column.name === "avatar_url"))
    await client.execute("ALTER TABLE users ADD COLUMN avatar_url TEXT")
  await client.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `)
  await client.execute(
    "CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id)"
  )
  await client.execute(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      key TEXT PRIMARY KEY NOT NULL,
      failures INTEGER NOT NULL DEFAULT 0,
      last_failed_at TEXT NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS bootstrap_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS genres (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS item_genres (
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      genre_id INTEGER NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
      UNIQUE(item_id, genre_id)
    )
  `)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS keywords (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS item_keywords (
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      keyword_id INTEGER NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
      UNIQUE(item_id, keyword_id)
    )
  `)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS authors (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      open_library_key TEXT UNIQUE
    )
  `)
  const authorColumns = await client.execute("PRAGMA table_info(authors)")
  if (!authorColumns.rows.some((column) => column.name === "open_library_key"))
    await client.execute("ALTER TABLE authors ADD COLUMN open_library_key TEXT")
  await client.execute(
    "CREATE UNIQUE INDEX IF NOT EXISTS authors_open_library_key_unique ON authors(open_library_key)"
  )
  await client.execute(`
    CREATE TABLE IF NOT EXISTS item_authors (
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      author_id INTEGER NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
      UNIQUE(item_id, author_id)
    )
  `)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS directors (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      tmdb_person_id TEXT UNIQUE
    )
  `)
  const directorColumns = await client.execute("PRAGMA table_info(directors)")
  if (!directorColumns.rows.some((column) => column.name === "tmdb_person_id"))
    await client.execute("ALTER TABLE directors ADD COLUMN tmdb_person_id TEXT")
  await client.execute(
    "CREATE UNIQUE INDEX IF NOT EXISTS directors_tmdb_person_id_unique ON directors(tmdb_person_id)"
  )
  await client.execute(`
    CREATE TABLE IF NOT EXISTS item_directors (
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      director_id INTEGER NOT NULL REFERENCES directors(id) ON DELETE CASCADE,
      UNIQUE(item_id, director_id)
    )
  `)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS actors (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      tmdb_person_id TEXT UNIQUE
    )
  `)
  const actorColumns = await client.execute("PRAGMA table_info(actors)")
  if (!actorColumns.rows.some((column) => column.name === "tmdb_person_id"))
    await client.execute("ALTER TABLE actors ADD COLUMN tmdb_person_id TEXT")
  await client.execute(
    "CREATE UNIQUE INDEX IF NOT EXISTS actors_tmdb_person_id_unique ON actors(tmdb_person_id)"
  )
  await client.execute(`
    CREATE TABLE IF NOT EXISTS item_actors (
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      actor_id INTEGER NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      UNIQUE(item_id, actor_id)
    )
  `)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      tmdb_collection_id TEXT UNIQUE,
      overview TEXT
    )
  `)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS item_collections (
      item_id INTEGER NOT NULL UNIQUE REFERENCES items(id) ON DELETE CASCADE,
      collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
      UNIQUE(item_id, collection_id)
    )
  `)
  // Legacy FTS index; nothing ever queried it. Dropped in place so existing
  // databases stop carrying it.
  await client.execute("DROP TABLE IF EXISTS item_search")
  await client.execute(`
    CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      borrower_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      borrower_name TEXT NOT NULL,
      lent_at TEXT NOT NULL,
      due_at TEXT,
      returned_at TEXT,
      created_at TEXT NOT NULL
    )
  `)
  await client.execute(
    "CREATE INDEX IF NOT EXISTS loans_item_id_idx ON loans(item_id)"
  )
  // One open loan per item, enforced by the database rather than by callers.
  await client.execute(
    "CREATE UNIQUE INDEX IF NOT EXISTS loans_open_item_unique ON loans(item_id) WHERE returned_at IS NULL"
  )
  await migrateLegacyLoans(client)
  // Read a fresh PRAGMA: the `columns` snapshot above predates the backfill.
  const itemColumnsAfterLoans = await client.execute("PRAGMA table_info(items)")
  for (const column of ["borrower", "loaned_at"]) {
    if (itemColumnsAfterLoans.rows.some((row) => row.name === column))
      await client.execute(`ALTER TABLE items DROP COLUMN ${column}`)
  }
  await client.execute(`
    CREATE TABLE IF NOT EXISTS user_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      state TEXT NOT NULL,
      started_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  await client.execute(
    "CREATE UNIQUE INDEX IF NOT EXISTS user_items_user_id_item_id_unique ON user_items(user_id, item_id)"
  )
  await client.execute(
    "CREATE INDEX IF NOT EXISTS user_items_item_id_idx ON user_items(item_id)"
  )
  await migrateLegacyProgress(client)
  await migrateLegacyGenres(client)
  await migrateLegacyCreators(client)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      system INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `)
  const listColumns = await client.execute("PRAGMA table_info(lists)")
  if (!listColumns.rows.some((column) => column.name === "system")) {
    await client.execute(
      "ALTER TABLE lists ADD COLUMN system INTEGER NOT NULL DEFAULT 0"
    )
  }
  await client.execute(`
    CREATE TABLE IF NOT EXISTS list_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      added_at TEXT NOT NULL,
      UNIQUE(list_id, item_id)
    )
  `)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS list_placements (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      list_id INTEGER REFERENCES lists(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      source_slug TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL,
      position INTEGER NOT NULL,
      visible INTEGER NOT NULL DEFAULT 1,
      UNIQUE(list_id, type)
    )
  `)
  const placementColumns = await client.execute(
    "PRAGMA table_info(list_placements)"
  )
  const needsCatalogPlacementDefaults = !placementColumns.rows.some(
    (column) => column.name === "source_slug"
  )
  if (
    !placementColumns.rows.some((column) => column.name === "kind") ||
    placementColumns.rows.find((column) => column.name === "list_id")?.notnull
  ) {
    await client.execute(`
      CREATE TABLE list_placements_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        list_id INTEGER REFERENCES lists(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        type TEXT NOT NULL,
        position INTEGER NOT NULL,
        visible INTEGER NOT NULL DEFAULT 1,
        UNIQUE(list_id, type)
      );
      INSERT INTO list_placements_new (id, list_id, kind, type, position, visible)
      SELECT id, list_id, 'list', type, position, visible FROM list_placements;
      DROP TABLE list_placements;
      ALTER TABLE list_placements_new RENAME TO list_placements;
    `)
  }
  if (needsCatalogPlacementDefaults) {
    await client.execute(
      "ALTER TABLE list_placements ADD COLUMN source_slug TEXT"
    )
    await client.execute(`
      UPDATE list_placements
      SET source_slug = CASE
        WHEN kind = 'recent' THEN 'recent'
        ELSE coalesce((SELECT slug FROM lists WHERE lists.id = list_placements.list_id), '')
      END
    `)
  }
  await client.execute(
    "CREATE UNIQUE INDEX IF NOT EXISTS list_placements_type_kind_source_slug_unique ON list_placements(type, kind, source_slug)"
  )
  const now = new Date().toISOString()
  await client.execute({
    sql: `
      INSERT INTO lists (slug, name, system, created_at)
      VALUES (?, ?, 1, ?), (?, ?, 1, ?)
      ON CONFLICT(slug) DO UPDATE SET system = 1
    `,
    args: ["watchlist", "Watchlist", now, READLIST_SLUG, READLIST_NAME, now],
  })
  await client.execute(`
    INSERT INTO list_placements (list_id, kind, source_slug, type, position, visible)
    SELECT id, 'list', slug, 'book', 0, 1 FROM lists WHERE slug = '${READLIST_SLUG}'
    ON CONFLICT(list_id, type) DO NOTHING
  `)
  await client.execute(`
    INSERT INTO list_placements (list_id, kind, source_slug, type, position, visible)
    SELECT id, 'list', slug, 'movie', 0, 1 FROM lists WHERE slug = 'watchlist'
    ON CONFLICT(list_id, type) DO NOTHING
  `)
  await client.execute(`
    INSERT INTO list_placements (list_id, kind, source_slug, type, position, visible)
    SELECT id, 'list', slug, 'tv', 0, 1 FROM lists WHERE slug = 'watchlist'
    ON CONFLICT(list_id, type) DO NOTHING
  `)
  for (const type of ["book", "movie", "tv"]) {
    await client.execute({
      sql: `
        INSERT INTO list_placements (list_id, kind, source_slug, type, position, visible)
        SELECT NULL, 'recent', 'recent', ?, 1, 1
        WHERE NOT EXISTS (
          SELECT 1 FROM list_placements WHERE kind = 'recent' AND type = ?
        )
      `,
      args: [type, type],
    })
  }
  if (needsCatalogPlacementDefaults) {
    await client.execute(`
      INSERT INTO list_placements (list_id, kind, source_slug, type, position, visible)
      SELECT NULL, 'genre', slug, type,
        max_position + ROW_NUMBER() OVER (PARTITION BY type ORDER BY name, slug), 1
      FROM (
        SELECT DISTINCT genres.slug, genres.name, items.type,
          COALESCE((
            SELECT MAX(position) FROM list_placements AS placements
            WHERE placements.type = items.type
          ), -1) AS max_position
        FROM item_genres
        INNER JOIN genres ON item_genres.genre_id = genres.id
        INNER JOIN items ON item_genres.item_id = items.id
      )
    `)
  }

  for (const column of ["tagline", "logo_image_url", "trailer_key"]) {
    if (!columns.rows.some((row) => row.name === column))
      await client.execute(`ALTER TABLE items ADD COLUMN ${column} TEXT`)
  }
  const collectionColumns = await client.execute(
    "PRAGMA table_info(collections)"
  )
  if (!collectionColumns.rows.some((column) => column.name === "part_ids"))
    await client.execute("ALTER TABLE collections ADD COLUMN part_ids TEXT")
  for (const [indexName, table, column] of [
    ["items_type_idx", "items", "type"],
    ["items_created_at_idx", "items", "created_at"],
    ["list_items_item_id_idx", "list_items", "item_id"],
    ["item_genres_genre_id_idx", "item_genres", "genre_id"],
    ["item_keywords_keyword_id_idx", "item_keywords", "keyword_id"],
    ["item_authors_author_id_idx", "item_authors", "author_id"],
    ["item_directors_director_id_idx", "item_directors", "director_id"],
    ["item_actors_actor_id_idx", "item_actors", "actor_id"],
  ]) {
    await client.execute(
      `CREATE INDEX IF NOT EXISTS ${indexName} ON ${table}(${column})`
    )
  }
  await client.execute(
    "CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY NOT NULL, value INTEGER NOT NULL)"
  )
  await client.execute({
    sql: "INSERT INTO schema_meta (key, value) VALUES ('version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    args: [schemaVersion()],
  })
}

export function readSchemaVersion(client: Client) {
  return client
    .execute("SELECT value FROM schema_meta WHERE key = 'version'")
    .then(
      (result) => Number(result.rows[0]?.value ?? 0),
      (error: unknown) => {
        if (error instanceof Error && /no such table/i.test(error.message))
          return 0
        throw error
      }
    )
}

async function replaceGenreJoins(
  client: Client,
  itemId: number,
  names: string[]
) {
  for (const name of [
    ...new Set(names.map((value) => value.trim()).filter(Boolean)),
  ]) {
    const slug = slugify(name)
    if (!slug) continue
    await client.execute({
      sql: "INSERT INTO genres (slug, name) VALUES (?, ?) ON CONFLICT(slug) DO NOTHING",
      args: [slug, name],
    })
    await client.execute({
      sql: "INSERT INTO item_genres (item_id, genre_id) SELECT ?, id FROM genres WHERE slug = ? ON CONFLICT DO NOTHING",
      args: [itemId, slug],
    })
  }
}

async function migrateLegacyLoans(client: Client) {
  const columns = await client.execute("PRAGMA table_info(items)")
  if (!columns.rows.some((column) => column.name === "borrower")) return
  await client.execute(`
    INSERT INTO loans (item_id, borrower_user_id, borrower_name, lent_at, created_at)
    SELECT id, NULL, trim(borrower), coalesce(loaned_at, created_at), created_at
    FROM items
    WHERE status = 'borrowed'
      AND borrower IS NOT NULL
      AND trim(borrower) != ''
      AND NOT EXISTS (
        SELECT 1 FROM loans
        WHERE loans.item_id = items.id AND loans.returned_at IS NULL
      )
  `)
  // A 'borrowed' row with no borrower name carries no loan information and
  // would violate the status/open-loan invariant, so it returns to 'owned'.
  await client.execute(`
    UPDATE items SET status = 'owned'
    WHERE status = 'borrowed'
      AND NOT EXISTS (
        SELECT 1 FROM loans
        WHERE loans.item_id = items.id AND loans.returned_at IS NULL
      )
  `)
}

// 'reading'/'watching' used to live on items.status, which meant only one
// person could be reading anything. Existing rows belong to the shelf's
// first admin; on a database with no admin yet (bootstrap flow, no stored
// user), there is nobody to own the state, so those rows simply return to
// 'owned' and the state is dropped. The UPDATE runs unconditionally, so
// re-running this once no reading/watching rows remain is a no-op.
async function migrateLegacyProgress(client: Client) {
  const now = new Date().toISOString()
  await client.execute({
    sql: `
      INSERT INTO user_items (user_id, item_id, state, started_at, updated_at)
      SELECT
        (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1),
        items.id, items.status, ?, ?
      FROM items
      WHERE items.status IN ('reading', 'watching')
        AND EXISTS (SELECT 1 FROM users WHERE role = 'admin')
      ON CONFLICT(user_id, item_id) DO NOTHING
    `,
    args: [now, now],
  })
  await client.execute(
    "UPDATE items SET status = 'owned' WHERE status IN ('reading', 'watching')"
  )
}

async function migrateLegacyGenres(client: Client) {
  const columns = await client.execute("PRAGMA table_info(items)")
  if (!columns.rows.some((column) => column.name === "genres")) return
  const legacyItems = await client.execute(
    "SELECT id, genres FROM items WHERE genres != '[]'"
  )
  for (const row of legacyItems.rows) {
    try {
      const names = JSON.parse(String(row.genres ?? "[]"))
      if (Array.isArray(names))
        await replaceGenreJoins(client, Number(row.id), names)
    } catch {
      // Ignore malformed legacy JSON rather than blocking database startup.
    }
  }
  await client.execute("UPDATE items SET genres = '[]' WHERE genres != '[]'")
}

async function replaceCreatorJoins(
  client: Client,
  itemId: number,
  kind: "author" | "director",
  names: string[]
) {
  const table = kind === "author" ? "authors" : "directors"
  const joinTable = kind === "author" ? "item_authors" : "item_directors"
  const personColumn = kind === "author" ? "author_id" : "director_id"
  for (const name of [...new Set(names)]) {
    const slug = slugify(name)
    if (!slug) continue
    await client.execute({
      sql: `INSERT INTO ${table} (slug, name) VALUES (?, ?) ON CONFLICT(slug) DO NOTHING`,
      args: [slug, name],
    })
    await client.execute({
      sql: `INSERT INTO ${joinTable} (item_id, ${personColumn}) SELECT ?, id FROM ${table} WHERE slug = ? ON CONFLICT DO NOTHING`,
      args: [itemId, slug],
    })
  }
}

async function migrateLegacyCreators(client: Client) {
  const legacyItems = await client.execute(`
    SELECT id, type, creator FROM items
    WHERE
      (type = 'book' AND NOT EXISTS (
        SELECT 1 FROM item_authors WHERE item_authors.item_id = items.id
      ))
      OR
      (type IN ('movie', 'tv') AND NOT EXISTS (
        SELECT 1 FROM item_directors WHERE item_directors.item_id = items.id
      ))
  `)
  for (const row of legacyItems.rows) {
    const kind = row.type === "book" ? "author" : "director"
    await replaceCreatorJoins(
      client,
      Number(row.id),
      kind,
      parseCreatorNames(String(row.creator ?? ""))
    )
  }
}
