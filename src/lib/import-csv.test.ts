import { describe, expect, test } from "vitest"
import { planCsvImport } from "./import-csv"

const now = new Date("2026-09-02")

const goodreadsHeader =
  "Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating," +
  "Average Rating,Publisher,Binding,Number of Pages,Year Published," +
  "Original Publication Year,Date Read,Date Added,Bookshelves," +
  "Bookshelves with positions,Exclusive Shelf,My Review,Spoiler," +
  "Private Notes,Read Count,Owned Copies"

function goodreadsRow(fields: {
  title: string
  yearPublished?: string
  originalYear?: string
  shelf?: string
}): string {
  const cols = [
    "1", // Book Id
    `"${fields.title}"`, // Title
    "Frank Herbert", // Author
    '"Herbert, Frank"', // Author l-f
    "", // Additional Authors
    '="0441172719"', // ISBN
    '="9780441172719"', // ISBN13
    "5", // My Rating
    "4.25", // Average Rating
    "Ace Books", // Publisher
    "Paperback", // Binding
    "412", // Number of Pages
    fields.yearPublished ?? "", // Year Published
    fields.originalYear ?? "", // Original Publication Year
    "", // Date Read
    "2020/01/01", // Date Added
    "", // Bookshelves
    "", // Bookshelves with positions
    fields.shelf ?? "read", // Exclusive Shelf
    "", // My Review
    "", // Spoiler
    "", // Private Notes
    "1", // Read Count
    "1", // Owned Copies
  ]
  return cols.join(",")
}

describe("planCsvImport — Goodreads", () => {
  test("prefers Original Publication Year over Year Published", () => {
    const csv = [
      goodreadsHeader,
      goodreadsRow({
        title: "Dune",
        originalYear: "1965",
        yearPublished: "1990",
      }),
    ].join("\n")
    const plan = planCsvImport(csv, now)
    expect(plan.source).toBe("goodreads")
    expect(plan.type).toBe("book")
    expect(plan.entries).toEqual([{ query: "Dune (1965)" }])
  })

  test("falls back to Year Published when Original Publication Year is empty", () => {
    const csv = [
      goodreadsHeader,
      goodreadsRow({ title: "Dune", originalYear: "", yearPublished: "1990" }),
    ].join("\n")
    expect(planCsvImport(csv, now).entries).toEqual([{ query: "Dune (1990)" }])
  })

  test("omits the year when both year columns are empty", () => {
    const csv = [
      goodreadsHeader,
      goodreadsRow({ title: "Dune", originalYear: "", yearPublished: "" }),
    ].join("\n")
    expect(planCsvImport(csv, now).entries).toEqual([{ query: "Dune" }])
  })

  test("skips a to-read row instead of importing it", () => {
    const csv = [
      goodreadsHeader,
      goodreadsRow({ title: "Dune", originalYear: "1965", shelf: "to-read" }),
    ].join("\n")
    const plan = planCsvImport(csv, now)
    expect(plan.entries).toEqual([])
    expect(plan.skipped).toEqual([
      { row: "Dune", reason: "On your to-read shelf, not owned" },
    ])
  })

  test("skips a duplicate query once, keeping the first occurrence", () => {
    const csv = [
      goodreadsHeader,
      goodreadsRow({ title: "Dune", originalYear: "1965" }),
      goodreadsRow({ title: "Dune", originalYear: "1965" }),
    ].join("\n")
    const plan = planCsvImport(csv, now)
    expect(plan.entries).toEqual([{ query: "Dune (1965)" }])
    expect(plan.skipped).toEqual([{ row: "Dune", reason: "Duplicate row" }])
  })

  test("drops an implausible year from the query", () => {
    const csv = [
      goodreadsHeader,
      goodreadsRow({ title: "Dune", originalYear: "3999" }),
    ].join("\n")
    expect(planCsvImport(csv, now).entries).toEqual([{ query: "Dune" }])
  })

  test("does not truncate a short title's query", () => {
    const csv = [
      goodreadsHeader,
      goodreadsRow({ title: "Dune", originalYear: "1965" }),
    ].join("\n")
    expect(planCsvImport(csv, now).entries).toEqual([{ query: "Dune (1965)" }])
  })

  test("truncates a long title so the year suffix still fits", () => {
    const longTitle = "A".repeat(250)
    const csv = [
      goodreadsHeader,
      goodreadsRow({ title: longTitle, originalYear: "1965" }),
    ].join("\n")
    const plan = planCsvImport(csv, now)
    expect(plan.entries).toHaveLength(1)
    const query = plan.entries[0].query
    expect(query.length).toBeLessThanOrEqual(200)
    expect(query.endsWith("(1965)")).toBe(true)
  })
})

describe("planCsvImport — Letterboxd", () => {
  const letterboxdHeader = "Date,Name,Year,Letterboxd URI"

  test("detects the format and parses a comma-containing title", () => {
    const csv = [
      letterboxdHeader,
      '2024-01-01,"Paris, Texas",1984,https://boxd.it/abc',
    ].join("\n")
    const plan = planCsvImport(csv, now)
    expect(plan.source).toBe("letterboxd")
    expect(plan.type).toBe("movie")
    expect(plan.entries).toEqual([{ query: "Paris, Texas (1984)" }])
  })
})

describe("planCsvImport — errors", () => {
  test("throws a readable error naming both supported exports for unrecognized headers", () => {
    expect(() => planCsvImport("Foo,Bar\n1,2", now)).toThrow(/Goodreads/)
    expect(() => planCsvImport("Foo,Bar\n1,2", now)).toThrow(/Letterboxd/)
  })
})
