import { describe, expect, test } from "vitest"
import type { Item } from "@/server/schema"
import { changedFields, hasCuratedValue } from "./sync-fields"

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: 1,
    slug: "true-grit",
    type: "movie",
    status: "owned",
    title: "True Grit",
    creator: "Joel Coen",
    year: 2010,
    coverImageUrl: null,
    backdropImageUrl: null,
    openLibraryKey: null,
    tmdbId: "44264",
    barcode: null,
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
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    genres: [],
    keywords: [],
    authors: [],
    directors: [],
    actors: [],
    isInSystemList: false,
    ...overrides,
  }
}

describe("hasCuratedValue", () => {
  test("blank strings, provider placeholders and a zero year read as empty", () => {
    expect(hasCuratedValue("title", "")).toBe(false)
    expect(hasCuratedValue("title", "  ")).toBe(false)
    expect(hasCuratedValue("title", "Untitled")).toBe(false)
    expect(hasCuratedValue("creator", "Unknown author")).toBe(false)
    expect(hasCuratedValue("creator", "Director unavailable")).toBe(false)
    expect(hasCuratedValue("creator", "Creator unavailable")).toBe(false)
    expect(hasCuratedValue("year", 0)).toBe(false)
    expect(hasCuratedValue("year", null)).toBe(false)
  })
  test("anything a member typed counts as curated", () => {
    expect(hasCuratedValue("title", "The Justification of God")).toBe(true)
    expect(hasCuratedValue("creator", "John Garth")).toBe(true)
    expect(hasCuratedValue("year", 1983)).toBe(true)
  })
})

describe("changedFields", () => {
  test("never overwrites a curated title, creator or year", () => {
    const changes = changedFields(item(), {
      title: "True grit",
      creator: "Ethan Coen",
      creatorPeople: [{ name: "Ethan Coen", providerId: "1224" }],
      year: 2011,
    })
    expect(changes).toEqual({})
  })
  test("fills a blank title, creator or year from the provider", () => {
    const changes = changedFields(
      item({ title: "Untitled", creator: "Director unavailable", year: 0 }),
      { title: "True Grit", creator: "Joel Coen", year: 2010 }
    )
    expect(changes).toEqual({
      title: { before: "Untitled", after: "True Grit" },
      creator: { before: "Director unavailable", after: "Joel Coen" },
      year: { before: 0, after: 2010 },
    })
  })
  test("still refreshes the provider-owned fields around a curated core", () => {
    const changes = changedFields(
      item({
        type: "book",
        tmdbId: null,
        openLibraryKey: "/works/OL1W",
        title: "Leadership and Emotional Sabotage",
        creator: "Joe Rigney",
        year: 2024,
      }),
      {
        title: "Leadership and emotional sabotage",
        creator: "Joseph Rigney",
        year: 2023,
        genres: ["Theology"],
        publisher: "Canon Press",
        isbn13: "9781591280408",
        pageCount: 128,
        subtitle: null,
        description: "A field guide.",
      }
    )
    expect(Object.keys(changes).sort()).toEqual([
      "description",
      "genres",
      "isbn13",
      "pageCount",
      "publisher",
    ])
    expect(changes.publisher).toEqual({ before: null, after: "Canon Press" })
    expect(changes.genres).toEqual({ before: [], after: ["Theology"] })
  })
  test("ignores screen-only fields on a book and cast on a book", () => {
    const changes = changedFields(
      item({ type: "book", tmdbId: null, openLibraryKey: "/works/OL1W" }),
      {
        runtime: 90,
        certification: "PG",
        tagline: "x",
        logoImageUrl: "x",
        trailerKey: "x",
        cast: ["Someone"],
      }
    )
    expect(changes).toEqual({})
  })
})
