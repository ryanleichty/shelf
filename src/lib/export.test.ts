import { describe, expect, test } from "vitest"
import type { Item } from "@/server/schema"
import { buildExport, EXPORT_VERSION } from "./export"

const item = (id: number, overrides: Partial<Item> = {}): Item => ({
  id,
  slug: `item-${id}`,
  type: "movie",
  status: "owned",
  title: `Title ${id}`,
  creator: "Someone",
  year: 1990 + id,
  coverImageUrl: `https://img/${id}.jpg`,
  backdropImageUrl: null,
  openLibraryKey: null,
  tmdbId: null,
  barcode: null,
  borrower: null,
  loanedAt: null,
  format: null,
  edition: null,
  description: null,
  certification: null,
  runtime: null,
  subtitle: null,
  pageCount: null,
  publisher: null,
  isbn13: null,
  tagline: null,
  logoImageUrl: null,
  trailerKey: null,
  notes: "",
  acquiredAt: null,
  createdAt: `2026-01-0${id}`,
  updatedAt: `2026-01-0${id}`,
  genres: [],
  keywords: [],
  authors: [],
  directors: [],
  actors: [],
  isInSystemList: false,
  ...overrides,
})

describe("buildExport", () => {
  test("happy path: items, a list and its membership", () => {
    const payload = buildExport({
      items: [item(1), item(2)],
      lists: [{ id: 10, slug: "watchlist", name: "Watchlist", system: true }],
      listItems: [{ listSlug: "watchlist", itemSlug: "item-1", position: 0 }],
      exportedAt: "2026-09-02T00:00:00.000Z",
    })

    expect(payload.version).toBe(EXPORT_VERSION)
    expect(payload.items).toHaveLength(2)
    expect(payload.listItems).toEqual([
      { listSlug: "watchlist", itemSlug: "item-1", position: 0 },
    ])
  })

  test("notes and acquiredAt never appear in an export entry", () => {
    const payload = buildExport({
      items: [item(1, { notes: "private", acquiredAt: "2020-01-01" })],
      lists: [],
      listItems: [],
      exportedAt: "2026-09-02T00:00:00.000Z",
    })

    const [entry] = payload.items
    expect("notes" in entry).toBe(false)
    expect("acquiredAt" in entry).toBe(false)
  })

  test("an item with no collection exports collection: null", () => {
    const payload = buildExport({
      items: [item(1)],
      lists: [],
      listItems: [],
      exportedAt: "2026-09-02T00:00:00.000Z",
    })

    expect(payload.items[0].collection).toBeNull()
  })

  test("empty join arrays export as [], not undefined", () => {
    const payload = buildExport({
      items: [item(1)],
      lists: [],
      listItems: [],
      exportedAt: "2026-09-02T00:00:00.000Z",
    })

    expect(payload.items[0].genres).toEqual([])
    expect(payload.items[0].keywords).toEqual([])
    expect(payload.items[0].authors).toEqual([])
    expect(payload.items[0].directors).toEqual([])
    expect(payload.items[0].actors).toEqual([])
  })
})
