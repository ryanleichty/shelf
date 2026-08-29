import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const itemTypes = ["book", "movie", "tv"] as const
export type ItemType = (typeof itemTypes)[number]
export const itemStatuses = ["owned", "borrowed", "reading", "watching"] as const
export type ItemStatus = (typeof itemStatuses)[number]
export const itemEditions = ["theatrical", "extended", "director-cut"] as const
export type ItemEdition = (typeof itemEditions)[number]

export const items = sqliteTable("items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  type: text("type", { enum: itemTypes }).notNull(),
  status: text("status", { enum: itemStatuses }).notNull().default("owned"),
  title: text("title").notNull(),
  creator: text("creator").notNull(),
  year: integer("year").notNull(),
  coverImageUrl: text("cover_image_url"),
  openLibraryKey: text("open_library_key"),
  tmdbId: text("tmdb_id"),
  borrower: text("borrower"),
  loanedAt: text("loaned_at"),
  format: text("format"),
  edition: text("edition", { enum: itemEditions }),
  genres: text("genres", { mode: "json" }).$type<string[]>().notNull().default([]),
  notes: text("notes").notNull().default(""),
  acquiredAt: text("acquired_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
})

export type Item = typeof items.$inferSelect
