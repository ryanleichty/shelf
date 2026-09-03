import { slugify, yearFromDate } from "@/lib/catalog"
import { bookGenreOptions } from "@/lib/item-input"
import type { ProviderPerson } from "./item-joins"
import type { LookupResult } from "./providers"
import type { SyncedFields } from "./item-sync"

export function normalizeOpenLibraryWorkKey(key: string) {
  const workId = key
    .trim()
    .replace(/^\/?works\//, "")
    .replace(/^\//, "")
  const workKey = `/works/${workId}`
  if (!/^\/works\/OL\d+W$/.test(workKey))
    throw new Error("Invalid Open Library key.")
  return workKey
}

export function normalizeOpenLibraryAuthorKey(key?: string) {
  if (!key?.trim()) return undefined
  const authorId = key
    .trim()
    .replace(/^\/?authors\//, "")
    .replace(/^\//, "")
  const authorKey = `/authors/${authorId}`
  // Provider responses carry well-formed keys; drop an odd one rather than
  // failing the whole search or sync it arrived in.
  if (!/^\/authors\/OL\d+A$/.test(authorKey)) return undefined
  return authorKey
}

export async function lookupOpenLibraryAuthor(key: string) {
  const response = await fetch(`https://openlibrary.org${key}.json`, {
    signal: AbortSignal.timeout(10_000),
    headers: { "User-Agent": "Shelf (https://github.com/ryanleichty/shelf)" },
  })
  if (!response.ok) return ""
  const author = (await response.json()) as { name?: string }
  return author.name ?? ""
}

export async function lookupBooks(query: string): Promise<LookupResult[]> {
  const url = new URL("https://openlibrary.org/search.json")
  url.searchParams.set("q", query)
  url.searchParams.set(
    "fields",
    "key,title,author_name,author_key,first_publish_year,cover_i"
  )
  url.searchParams.set("limit", "6")
  const response = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
    headers: { "User-Agent": "Shelf (https://github.com/ryanleichty/shelf)" },
  })
  if (!response.ok)
    throw new Error("Open Library could not complete that search.")
  const body = (await response.json()) as {
    docs?: Array<{
      key?: string
      title?: string
      author_name?: string[]
      author_key?: string[]
      first_publish_year?: number
      cover_i?: number
      subject?: string[]
    }>
  }
  return (body.docs ?? []).flatMap((book) =>
    book.key && book.title
      ? [
          {
            id: book.key,
            type: "book" as const,
            title: book.title,
            creator: book.author_name?.[0] ?? "Unknown author",
            creatorPeople:
              book.author_name?.flatMap((name, index) =>
                name
                  ? [
                      {
                        name,
                        providerId: normalizeOpenLibraryAuthorKey(
                          book.author_key?.[index]
                        ),
                      },
                    ]
                  : []
              ) ?? [],
            year: book.first_publish_year ?? null,
            coverImageUrl: book.cover_i
              ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`
              : "",
            genres: curatedBookGenres(book.subject),
          },
        ]
      : []
  )
}

export async function getBookResultById(
  key: string
): Promise<LookupResult & { slug: string }> {
  const id = normalizeOpenLibraryWorkKey(key)
  const response = await fetch(`https://openlibrary.org${id}.json`, {
    signal: AbortSignal.timeout(10_000),
    headers: { "User-Agent": "Shelf (https://github.com/ryanleichty/shelf)" },
  })
  if (response.status === 404)
    throw new Error(`Provider 404: Open Library work ${id} was not found.`)
  if (!response.ok) throw new Error(`Open Library could not load ${id}.`)
  const book = (await response.json()) as {
    title?: string
    first_publish_date?: string
    subjects?: string[]
    description?: string | { value?: string }
    authors?: Array<{ author?: { key?: string }; name?: string }>
  }
  const authorPeople = await openLibraryAuthors(book.authors)
  const title = book.title ?? "Untitled"
  return {
    id,
    type: "book",
    title,
    creator: authorPeople[0]?.name ?? "Unknown author",
    creatorPeople: authorPeople,
    year: yearFromDate(book.first_publish_date),
    coverImageUrl: "",
    genres: curatedBookGenres(book.subjects),
    description: openLibraryDescription(book.description),
    slug: slugify(title),
  }
}

export async function bookCoverOptions(
  openLibraryKey: string
): Promise<string[]> {
  const workId = openLibraryKey.replace(/^\/?works\//, "")
  const response = await fetch(
    `https://openlibrary.org/works/${workId}/editions.json?limit=100`,
    {
      signal: AbortSignal.timeout(10_000),
      headers: {
        "User-Agent": "Shelf (https://github.com/ryanleichty/shelf)",
      },
    }
  )
  if (!response.ok)
    throw new Error("Open Library could not load edition covers.")
  const body = (await response.json()) as {
    entries?: Array<{
      covers?: number[]
      languages?: Array<{ key?: string }>
    }>
  }
  const editions = body.entries ?? []
  const allCovers = [
    ...new Set(editions.flatMap((edition) => edition.covers ?? [])),
  ]
  const englishCovers = [
    ...new Set(
      editions
        .filter((edition) =>
          edition.languages?.some((language) => language.key?.endsWith("/eng"))
        )
        .flatMap((edition) => edition.covers ?? [])
    ),
  ]
  const covers = (englishCovers.length ? englishCovers : allCovers).slice(0, 18)
  return covers.map((id) => `https://covers.openlibrary.org/b/id/${id}-L.jpg`)
}

export async function getBookSyncMetadata(
  openLibraryKey: string,
  coverImageUrl?: string | null,
  isbn13?: string | null
): Promise<SyncedFields> {
  const response = await fetch(
    `https://openlibrary.org${openLibraryKey}.json`,
    {
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "Shelf (https://github.com/ryanleichty/shelf)" },
    }
  )
  if (response.status === 404)
    throw new Error(
      `Provider 404: Open Library work ${openLibraryKey} was not found.`
    )
  if (!response.ok)
    throw new Error(`Open Library could not load ${openLibraryKey}.`)
  const book = (await response.json()) as {
    title?: string
    first_publish_date?: string
    subjects?: string[]
    description?: string | { value?: string }
    authors?: Array<{ author?: { key?: string }; name?: string }>
  }
  const authorPeople = await openLibraryAuthors(book.authors)
  const year = yearFromDate(book.first_publish_date)
  const edition = await openLibraryEditionForCopy(
    openLibraryKey,
    coverImageUrl,
    isbn13
  )
  return {
    ...(book.title ? { title: book.title } : {}),
    ...(authorPeople.length
      ? {
          creator: authorPeople.map((author) => author.name).join(", "),
          creatorPeople: authorPeople,
        }
      : {}),
    ...(year !== null ? { year } : {}),
    genres: curatedBookGenres(book.subjects),
    ...(openLibraryDescription(book.description) !== undefined
      ? { description: openLibraryDescription(book.description) }
      : {}),
    ...edition,
  }
}

type OpenLibraryEdition = {
  works?: Array<{ key?: string }>
  covers?: number[]
  subtitle?: string
  number_of_pages?: number
  publishers?: string[]
  isbn_13?: string[]
  series?: string | string[]
}

async function openLibraryEditionForCopy(
  workKey: string,
  coverImageUrl?: string | null,
  isbn13?: string | null
): Promise<
  Pick<
    SyncedFields,
    "subtitle" | "pageCount" | "publisher" | "isbn13" | "collection"
  >
> {
  const normalizedWorkKey = normalizeOpenLibraryWorkKey(workKey)
  const existingIsbn = normalizeIsbn13(isbn13)
  let edition: OpenLibraryEdition | undefined

  if (existingIsbn) {
    const response = await fetch(
      `https://openlibrary.org/isbn/${existingIsbn}.json`,
      {
        signal: AbortSignal.timeout(10_000),
        headers: {
          "User-Agent": "Shelf (https://github.com/ryanleichty/shelf)",
        },
      }
    )
    if (response.ok) {
      const candidate = (await response.json()) as OpenLibraryEdition
      if (
        candidate.works?.some(
          (work) =>
            work.key &&
            normalizeOpenLibraryWorkKey(work.key) === normalizedWorkKey
        )
      )
        edition = candidate
    }
  }

  if (!edition) {
    const coverId = openLibraryCoverId(coverImageUrl)
    if (!coverId) return {}
    const response = await fetch(
      `https://openlibrary.org${normalizedWorkKey}/editions.json?limit=1000`,
      {
        signal: AbortSignal.timeout(10_000),
        headers: {
          "User-Agent": "Shelf (https://github.com/ryanleichty/shelf)",
        },
      }
    )
    if (!response.ok)
      throw new Error(
        `Open Library could not load editions for ${normalizedWorkKey}.`
      )
    const body = (await response.json()) as { entries?: OpenLibraryEdition[] }
    edition = body.entries?.find((candidate) =>
      candidate.covers?.includes(coverId)
    )
    if (!edition) return {}
  }

  const subtitle = edition.subtitle?.trim()
  const publisher = edition.publishers?.find((value) => value.trim())?.trim()
  const editionIsbn = [
    ...(edition.isbn_13 ?? []),
    ...(existingIsbn ? [existingIsbn] : []),
  ]
    .map(normalizeIsbn13)
    .find(Boolean)
  const series = Array.isArray(edition.series)
    ? edition.series[0]
    : edition.series
  const seriesName = series?.trim()
  return {
    subtitle: subtitle || null,
    pageCount:
      typeof edition.number_of_pages === "number" &&
      Number.isInteger(edition.number_of_pages) &&
      edition.number_of_pages > 0
        ? edition.number_of_pages
        : null,
    publisher: publisher || null,
    isbn13: editionIsbn ?? null,
    collection: seriesName ? { name: seriesName } : null,
  }
}

function openLibraryCoverId(url?: string | null) {
  const match = url?.match(/covers\.openlibrary\.org\/b\/id\/(\d+)-/i)
  return match ? Number(match[1]) : undefined
}

function normalizeIsbn13(value?: string | null) {
  const normalized = value?.replace(/[\s-]/g, "")
  return normalized && /^\d{13}$/.test(normalized) ? normalized : undefined
}

async function openLibraryAuthors(
  authorsForWork?: Array<{ author?: { key?: string }; name?: string }>
): Promise<ProviderPerson[]> {
  return (
    await Promise.all(
      (authorsForWork ?? []).map(async (author) => {
        const providerId = normalizeOpenLibraryAuthorKey(author.author?.key)
        if (author.name?.trim()) return { name: author.name.trim(), providerId }
        if (!providerId) return undefined
        const response = await fetch(
          `https://openlibrary.org${providerId}.json`,
          {
            signal: AbortSignal.timeout(10_000),
            headers: {
              "User-Agent": "Shelf (https://github.com/ryanleichty/shelf)",
            },
          }
        )
        if (!response.ok) return undefined
        const name = ((await response.json()) as { name?: string }).name?.trim()
        return name ? { name, providerId } : undefined
      })
    )
  ).flatMap((person) => (person ? [person] : []))
}

function curatedBookGenres(subjects?: string[]) {
  const subjectSet = new Set(
    (subjects ?? []).map((subject) => subject.toLocaleLowerCase())
  )
  return bookGenreOptions.filter((genre) =>
    subjectSet.has(genre.toLocaleLowerCase())
  )
}

function openLibraryDescription(
  description?: string | { value?: string }
): string | undefined {
  if (typeof description === "string") return description
  return description?.value
}
