import { parseCsv, parseCsvRecords } from "@/lib/csv"

// Same plausibility window as src/lib/import-query.ts:3 — re-derived locally
// rather than exported from there, per plan.
const YEAR_MIN = 1880
const YEAR_MAX_OFFSET = 2

export type CsvImportSource = "goodreads" | "letterboxd"

export type CsvImportPlan = {
  source: CsvImportSource
  type: "book" | "movie"
  entries: Array<{ query: string }>
  skipped: Array<{ row: string; reason: string }>
}

function plausibleYear(raw: string, now: Date): number | undefined {
  const trimmed = raw.trim()
  if (!/^\d+$/.test(trimmed)) return undefined
  const year = Number(trimmed)
  if (year < YEAR_MIN || year > now.getFullYear() + YEAR_MAX_OFFSET)
    return undefined
  return year
}

function buildQuery(title: string, year: number | undefined): string {
  const suffix = year ? ` (${year})` : ""
  const trimmedTitle = title.trim().slice(0, 200 - suffix.length)
  return `${trimmedTitle}${suffix}`.trim()
}

function headerSet(headerRow: string[]): Set<string> {
  return new Set(headerRow.map((header) => header.trim().toLowerCase()))
}

// Records are keyed by the file's own header casing; look up case-insensitively
// since neither export format's casing is guaranteed.
function field(record: Record<string, string>, name: string): string {
  if (name in record) return record[name]
  const lower = name.toLowerCase()
  const key = Object.keys(record).find(
    (candidate) => candidate.trim().toLowerCase() === lower
  )
  return key ? record[key] : ""
}

export function planCsvImport(input: string, now = new Date()): CsvImportPlan {
  const rows = parseCsv(input)
  const headers = rows.length > 0 ? headerSet(rows[0]) : new Set<string>()
  const isGoodreads =
    headers.has("title") &&
    (headers.has("exclusive shelf") || headers.has("book id"))
  const isLetterboxd =
    headers.has("name") && headers.has("year") && headers.has("letterboxd uri")

  if (!isGoodreads && !isLetterboxd) {
    throw new Error(
      "Unrecognized CSV. Shelf can import a Goodreads library export or a Letterboxd films/watched/watchlist export."
    )
  }

  const source: CsvImportSource = isGoodreads ? "goodreads" : "letterboxd"
  const type: "book" | "movie" = isGoodreads ? "book" : "movie"
  const entries: Array<{ query: string }> = []
  const skipped: Array<{ row: string; reason: string }> = []
  const seen = new Set<string>()

  for (const record of parseCsvRecords(input)) {
    const title = (
      isGoodreads ? field(record, "Title") : field(record, "Name")
    ).trim()
    if (!title) {
      skipped.push({ row: title, reason: "No title" })
      continue
    }
    if (isGoodreads) {
      const shelf = field(record, "Exclusive Shelf").trim().toLowerCase()
      if (shelf === "to-read") {
        skipped.push({
          row: title,
          reason: "On your to-read shelf, not owned",
        })
        continue
      }
    }
    const yearRaw = isGoodreads
      ? field(record, "Original Publication Year") ||
        field(record, "Year Published")
      : field(record, "Year")
    const query = buildQuery(title, plausibleYear(yearRaw, now))
    if (seen.has(query)) {
      skipped.push({ row: title, reason: "Duplicate row" })
      continue
    }
    seen.add(query)
    entries.push({ query })
  }

  return { source, type, entries, skipped }
}
