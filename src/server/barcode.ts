import { and, eq, or } from "drizzle-orm"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { normalizeTitle, yearFromDate } from "@/lib/catalog"
import { type ItemInput } from "@/lib/item-input"
import { db } from "./db"
import { requireAdmin, requireSignedIn } from "./auth"
import {
  lookupOpenLibraryAuthor,
  normalizeOpenLibraryAuthorKey,
  normalizeOpenLibraryWorkKey,
} from "./openlibrary"
import {
  getCollectionResultById,
  lookupCollection,
  type LookupResult,
} from "./providers"
import { items, itemTypes, type Item, type ItemRecord } from "./schema"

const barcodeInput = z
  .string()
  .max(80)
  .transform((value) => value.replace(/\s/g, "").toUpperCase())
  .refine(
    (value) => /^\d{12,13}$/.test(value) || /^\d{9}[\dX]$/.test(value),
    "Enter an EAN-13, UPC-A, ISBN-10, or ISBN-13 code."
  )

type CheckResult =
  | { status: "owned"; item: ItemRecord }
  | { status: "not-owned"; title?: string; year?: number; format?: string }

type BarcodeResolution =
  | { status: "owned"; item: ItemRecord }
  | {
      status: "resolved"
      result: LookupResult
      format: ItemInput["format"]
    }

export const checkBarcode = createServerFn({ method: "POST" })
  .inputValidator(z.object({ code: barcodeInput }))
  .handler(async ({ data }): Promise<CheckResult> => {
    await requireAdmin()

    const stored = await itemForBarcode(data.code)
    if (stored) return { status: "owned", item: stored }

    const book = await itemForIsbn(data.code)
    if (book) {
      await saveBarcode(book.id, data.code)
      return { status: "owned", item: book }
    }

    const disc = await lookupDiscBarcode(data.code)
    if (!disc) return { status: "not-owned" }

    const catalogItem = await itemForDisc(disc.title, disc.year)
    if (!catalogItem)
      return {
        status: "not-owned",
        title: disc.title,
        year: disc.year,
        format: disc.format,
      }

    await saveBarcode(catalogItem.id, data.code)
    return { status: "owned", item: catalogItem }
  })

export const resolveBarcode = createServerFn({ method: "POST" })
  .inputValidator(z.object({ code: barcodeInput, type: z.enum(itemTypes) }))
  .handler(async ({ data }): Promise<BarcodeResolution> => {
    await requireSignedIn()

    const stored = await itemForBarcode(data.code)
    if (stored) return { status: "owned", item: stored }

    const book = await lookupBookBarcode(data.code)
    if (book) {
      const owned = await itemForBookWork(book.id)
      if (owned) return { status: "owned", item: owned }
      return { status: "resolved", result: book, format: "" }
    }

    const disc = await lookupDiscBarcode(data.code)
    if (!disc)
      throw new Error(
        "We couldn't look up that barcode. You can still complete the form manually."
      )

    const owned = await itemForDisc(disc.title, disc.year)
    if (owned) return { status: "owned", item: owned }

    const result = await lookupDiscResult(disc, data.type)
    if (!result)
      throw new Error(
        "We found the barcode but couldn't match it in the catalog. You can still complete the form manually."
      )
    return { status: "resolved", result, format: discFormat(disc.format) }
  })

async function itemForBarcode(barcode: string) {
  const [item] = await db
    .select()
    .from(items)
    .where(eq(items.barcode, barcode))
    .limit(1)
  return item
}

async function itemForIsbn(isbn: string) {
  const response = await fetch(`https://openlibrary.org/isbn/${isbn}.json`, {
    signal: AbortSignal.timeout(10_000),
    headers: { "User-Agent": "Shelf (https://github.com/ryanleichty/shelf)" },
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error("Open Library could not look up that ISBN.")
  const edition = (await response.json()) as {
    works?: Array<{ key?: string }>
  }
  const key = edition.works?.[0]?.key
  if (!key) return null
  const workKey = normalizeOpenLibraryWorkKey(key)
  return itemForBookWork(workKey)
}

async function itemForBookWork(workKey: string) {
  const [item] = await db
    .select()
    .from(items)
    .where(and(eq(items.type, "book"), eq(items.openLibraryKey, workKey)))
    .limit(1)
  return item
}

async function lookupBookBarcode(isbn: string): Promise<LookupResult | null> {
  const response = await fetch(`https://openlibrary.org/isbn/${isbn}.json`, {
    signal: AbortSignal.timeout(10_000),
    headers: { "User-Agent": "Shelf (https://github.com/ryanleichty/shelf)" },
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error("Open Library could not look up that ISBN.")
  const edition = (await response.json()) as {
    works?: Array<{ key?: string }>
    authors?: Array<{ key?: string; name?: string }>
    covers?: number[]
    publish_date?: string
  }
  const workKey = edition.works?.[0]?.key
  if (!workKey) return null

  const result = await getCollectionResultById({ id: workKey, type: "book" })
  const author = edition.authors?.[0]
  const authorName =
    author?.name ??
    (author?.key ? await lookupOpenLibraryAuthor(author.key) : "")
  const providerId = normalizeOpenLibraryAuthorKey(author?.key)
  return {
    ...result,
    creator: authorName || result.creator,
    creatorPeople: authorName
      ? [{ name: authorName, providerId }]
      : result.creatorPeople,
    year: yearFromDate(edition.publish_date) ?? result.year,
    coverImageUrl: edition.covers?.[0]
      ? `https://covers.openlibrary.org/b/id/${edition.covers[0]}-L.jpg`
      : result.coverImageUrl,
  }
}

async function lookupDiscBarcode(barcode: string) {
  const apiKey = process.env.UPCMDB_API_KEY?.trim()
  if (!apiKey) return null
  const response = await fetch(`https://upcmdb.com/api/v1/lookup/${barcode}`, {
    signal: AbortSignal.timeout(10_000),
    headers: { "x-api-key": apiKey },
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error("UPCMDb could not look up that barcode.")
  const body = (await response.json()) as {
    status?: string
    data?: { title?: string; year?: string | number; format?: string }
  }
  const title = body.data?.title?.trim()
  const year =
    typeof body.data?.year === "number"
      ? body.data.year
      : Number(body.data?.year)
  if (body.status !== "success" || !title || !Number.isInteger(year))
    return null
  return { title, year, format: body.data?.format }
}

async function lookupDiscResult(
  disc: { title: string; year: number },
  currentType: Item["type"]
) {
  const types =
    currentType === "movie" || currentType === "tv"
      ? [currentType]
      : (["movie", "tv"] as const)
  const matches = (
    await Promise.all(
      types.map(async (type) => {
        const results = await lookupCollection({ query: disc.title, type })
        return results.find((result) => result.year === disc.year)
      })
    )
  ).filter((result): result is LookupResult => Boolean(result))
  return matches.length === 1 ? matches[0] : null
}

function discFormat(format?: string): ItemInput["format"] {
  const normalized = format?.toLowerCase() ?? ""
  if (normalized.includes("blu")) return "blu-ray"
  if (normalized.includes("dvd")) return "dvd"
  return ""
}

async function itemForDisc(title: string, year: number) {
  const candidates = await db
    .select()
    .from(items)
    .where(
      and(
        or(eq(items.type, "movie"), eq(items.type, "tv")),
        eq(items.year, year)
      )
    )
  return candidates.find(
    (item) => normalizeTitle(item.title) === normalizeTitle(title)
  )
}

async function saveBarcode(itemId: number, barcode: string) {
  await db
    .update(items)
    .set({ barcode, updatedAt: new Date().toISOString() })
    .where(eq(items.id, itemId))
}
