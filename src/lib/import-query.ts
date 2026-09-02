import { normalizeTitle } from "@/lib/catalog"

const YEAR_MIN = 1880

// "Dune (2021)", "Dune 2021" → { title: "Dune", year: 2021 }. A trailing
// number is only a year when it is plausible, so "Blade Runner 2049" keeps
// its title.
export function parseImportQuery(query: string, now = new Date()) {
  const match = query.match(/(?:\(|\s)(\d{4})\)?\s*$/)
  const year = match ? Number(match[1]) : undefined
  const plausible =
    year !== undefined && year >= YEAR_MIN && year <= now.getFullYear() + 2
  return {
    title: plausible
      ? query.replace(/(?:\(|\s)\d{4}\)?\s*$/, "").trim()
      : query.trim(),
    year: plausible ? year : undefined,
  }
}

export type ImportCandidate = {
  id: string
  title: string
  year?: number | null
}

// Picks the single unambiguous match, or returns the ranked candidates for
// review.
export function rankImportCandidates<T extends ImportCandidate>(
  matches: T[],
  title: string,
  year: number | undefined
): { top: T | undefined; ranked: T[] } {
  const wanted = normalizeTitle(title)
  const ranked = [...matches].sort(
    (a, b) =>
      Number(b.year === year) - Number(a.year === year) ||
      Number(normalizeTitle(b.title) === wanted) -
        Number(normalizeTitle(a.title) === wanted)
  )
  const exactTitles = ranked.filter((c) => normalizeTitle(c.title) === wanted)
  const yearMatches =
    year === undefined ? exactTitles : exactTitles.filter((c) => c.year === year)
  const top =
    yearMatches.length === 1
      ? yearMatches[0]
      : year === undefined && exactTitles.length === 1
        ? exactTitles[0]
        : undefined
  return { top, ranked }
}
