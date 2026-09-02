import { describe, expect, test } from "vitest"
import { parseImportQuery, rankImportCandidates } from "./import-query"

const now = new Date("2026-09-02")

describe("parseImportQuery", () => {
  test("reads a trailing year in either form", () => {
    expect(parseImportQuery("Dune (2021)", now)).toEqual({
      title: "Dune",
      year: 2021,
    })
    expect(parseImportQuery("Dune 2021", now)).toEqual({
      title: "Dune",
      year: 2021,
    })
  })
  test("keeps implausible years as part of the title", () => {
    expect(parseImportQuery("Blade Runner 2049", now)).toEqual({
      title: "Blade Runner 2049",
      year: undefined,
    })
    expect(parseImportQuery("2001: A Space Odyssey", now)).toEqual({
      title: "2001: A Space Odyssey",
      year: undefined,
    })
  })
})

describe("rankImportCandidates", () => {
  const dune84 = { id: "1", title: "Dune", year: 1984 }
  const dune21 = { id: "2", title: "Dune", year: 2021 }
  const other = { id: "3", title: "Dune: Part Two", year: 2024 }
  test("picks the exact title with the requested year", () => {
    expect(
      rankImportCandidates([other, dune84, dune21], "Dune", 2021).top
    ).toBe(dune21)
  })
  test("sends same-title different-year matches to review when no year is given", () => {
    const result = rankImportCandidates(
      [dune84, dune21, other],
      "Dune",
      undefined
    )
    expect(result.top).toBeUndefined()
    expect(result.ranked.slice(0, 2)).toEqual([dune84, dune21])
  })
  test("accepts a single exact title without a year", () => {
    expect(rankImportCandidates([other, dune21], "Dune", undefined).top).toBe(
      dune21
    )
  })
})
