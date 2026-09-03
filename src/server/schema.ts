import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"
import {
  itemProgressStates,
  itemStatuses,
  itemTypes,
  placementKinds,
  userRoles,
} from "@/lib/catalog"

export {
  itemEditions,
  itemProgressStates,
  itemStatuses,
  itemTypes,
  userRoles,
  type ItemEdition,
  type ItemProgressState,
  type ItemStatus,
  type ItemType,
  type UserRole,
} from "@/lib/catalog"

export const users = /* #__PURE__ */ sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    avatarUrl: text("avatar_url"),
    role: text("role", { enum: userRoles }).notNull().default("member"),
    passwordHash: text("password_hash").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)]
)

export const sessions = /* #__PURE__ */ sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)]
)

export const loginAttempts = /* #__PURE__ */ sqliteTable("login_attempts", {
  key: text("key").primaryKey(),
  failures: integer("failures").notNull().default(0),
  lastFailedAt: text("last_failed_at").notNull(),
})

export const bootstrapSessions = /* #__PURE__ */ sqliteTable(
  "bootstrap_sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
  }
)

export const items = /* #__PURE__ */ sqliteTable("items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  type: text("type", { enum: itemTypes }).notNull(),
  status: text("status", { enum: itemStatuses }).notNull().default("owned"),
  title: text("title").notNull(),
  creator: text("creator").notNull(),
  year: integer("year").notNull(),
  coverImageUrl: text("cover_image_url"),
  backdropImageUrl: text("backdrop_image_url"),
  openLibraryKey: text("open_library_key"),
  tmdbId: text("tmdb_id"),
  barcode: text("barcode").unique(),
  format: text("format"),
  edition: text("edition"),
  description: text("description"),
  certification: text("certification"),
  runtime: integer("runtime"),
  subtitle: text("subtitle"),
  pageCount: integer("page_count"),
  publisher: text("publisher"),
  isbn13: text("isbn_13"),
  tagline: text("tagline"),
  logoImageUrl: text("logo_image_url"),
  trailerKey: text("trailer_key"),
  notes: text("notes").notNull().default(""),
  acquiredAt: text("acquired_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
})

// A row means "a member is reading or watching this right now" — no history,
// no rating, no progress. Finishing removes the row (see AGENTS.md).
export const userItems = /* #__PURE__ */ sqliteTable(
  "user_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    state: text("state", { enum: itemProgressStates }).notNull(),
    startedAt: text("started_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("user_items_user_id_item_id_unique").on(
      table.userId,
      table.itemId
    ),
    index("user_items_item_id_idx").on(table.itemId),
  ]
)

// The unique partial index enforcing one open loan per item (WHERE
// returned_at IS NULL) cannot be expressed in Drizzle's builder, so it is
// created as raw SQL in runMigrations instead.
export const loans = /* #__PURE__ */ sqliteTable(
  "loans",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    borrowerUserId: integer("borrower_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    borrowerName: text("borrower_name").notNull(),
    lentAt: text("lent_at").notNull(),
    dueAt: text("due_at"),
    returnedAt: text("returned_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("loans_item_id_idx").on(table.itemId)]
)

export const genres = /* #__PURE__ */ sqliteTable("genres", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
})

export const itemGenres = /* #__PURE__ */ sqliteTable(
  "item_genres",
  {
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    genreId: integer("genre_id")
      .notNull()
      .references(() => genres.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("item_genres_item_id_genre_id_unique").on(
      table.itemId,
      table.genreId
    ),
  ]
)

export const keywords = /* #__PURE__ */ sqliteTable("keywords", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
})

export const itemKeywords = /* #__PURE__ */ sqliteTable(
  "item_keywords",
  {
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    keywordId: integer("keyword_id")
      .notNull()
      .references(() => keywords.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("item_keywords_item_id_keyword_id_unique").on(
      table.itemId,
      table.keywordId
    ),
  ]
)

export const authors = /* #__PURE__ */ sqliteTable("authors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  openLibraryKey: text("open_library_key").unique(),
})

export const itemAuthors = /* #__PURE__ */ sqliteTable(
  "item_authors",
  {
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    authorId: integer("author_id")
      .notNull()
      .references(() => authors.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("item_authors_item_id_author_id_unique").on(
      table.itemId,
      table.authorId
    ),
  ]
)

export const directors = /* #__PURE__ */ sqliteTable("directors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  tmdbPersonId: text("tmdb_person_id").unique(),
})

export const itemDirectors = /* #__PURE__ */ sqliteTable(
  "item_directors",
  {
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    directorId: integer("director_id")
      .notNull()
      .references(() => directors.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("item_directors_item_id_director_id_unique").on(
      table.itemId,
      table.directorId
    ),
  ]
)

export const actors = /* #__PURE__ */ sqliteTable("actors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  tmdbPersonId: text("tmdb_person_id").unique(),
})

export const itemActors = /* #__PURE__ */ sqliteTable(
  "item_actors",
  {
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    actorId: integer("actor_id")
      .notNull()
      .references(() => actors.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
  },
  (table) => [
    uniqueIndex("item_actors_item_id_actor_id_unique").on(
      table.itemId,
      table.actorId
    ),
  ]
)

export const collections = /* #__PURE__ */ sqliteTable("collections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  tmdbCollectionId: text("tmdb_collection_id").unique(),
  overview: text("overview"),
  partIds: text("part_ids", { mode: "json" }).$type<string[]>(),
})

export const itemCollections = /* #__PURE__ */ sqliteTable(
  "item_collections",
  {
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    collectionId: integer("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("item_collections_item_id_unique").on(table.itemId),
    uniqueIndex("item_collections_item_id_collection_id_unique").on(
      table.itemId,
      table.collectionId
    ),
  ]
)

export const lists = /* #__PURE__ */ sqliteTable("lists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  system: integer("system", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
})

export const listPlacements = /* #__PURE__ */ sqliteTable(
  "list_placements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    listId: integer("list_id").references(() => lists.id, {
      onDelete: "cascade",
    }),
    kind: text("kind", { enum: placementKinds }).notNull(),
    sourceSlug: text("source_slug").notNull(),
    type: text("type", { enum: itemTypes }).notNull(),
    position: integer("position").notNull(),
    visible: integer("visible", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [
    uniqueIndex("list_placements_list_id_type_unique").on(
      table.listId,
      table.type
    ),
    uniqueIndex("list_placements_type_kind_source_slug_unique").on(
      table.type,
      table.kind,
      table.sourceSlug
    ),
  ]
)

export const listItems = /* #__PURE__ */ sqliteTable(
  "list_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    listId: integer("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    addedAt: text("added_at").notNull(),
  },
  (table) => [
    uniqueIndex("list_items_list_id_item_id_unique").on(
      table.listId,
      table.itemId
    ),
  ]
)

export type ItemRecord = typeof items.$inferSelect
export type Collection = typeof collections.$inferSelect
export type Item = ItemRecord & {
  genres: string[]
  keywords: string[]
  authors: string[]
  directors: string[]
  actors: string[]
  isInSystemList: boolean
  collection?: Collection
  borrower?: string | null
  loanDueAt?: string | null
}
