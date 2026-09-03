import { createServerFn } from "@tanstack/react-start"
import { getRequestHeader } from "@tanstack/react-start/server"
import { z } from "zod"
import { isAgentToken, requireSignedIn } from "./auth"
import {
  bookCoverOptions,
  getBookResultById,
  lookupBooks,
  normalizeOpenLibraryWorkKey,
} from "./openlibrary"
import { getScreenResultById, lookupScreen, screenCoverOptions } from "./tmdb"
import { itemTypes } from "./schema"
import type { ProviderPerson } from "./item-joins"

export type { ProviderPerson }

const lookupInput = z.object({
  query: z.string().trim().min(2).max(160),
  type: z.enum(itemTypes),
})

export type LookupResult = {
  id: string
  type: "book" | "movie" | "tv"
  title: string
  creator: string
  year: number | null
  coverImageUrl: string
  backdropImageUrl?: string
  genres: string[]
  description?: string
  keywords?: string[]
  cast?: string[]
  castPeople?: ProviderPerson[]
  creatorPeople?: ProviderPerson[]
  collection?: CollectionInput
  certification?: string
  runtime?: number
  subtitle?: string
  pageCount?: number
  publisher?: string
  isbn13?: string
}

export type CollectionInput = {
  tmdbCollectionId?: string
  name: string
  overview?: string
}

export async function lookupCollection(data: {
  query: string
  type: "book" | "movie" | "tv"
}): Promise<LookupResult[]> {
  return data.type === "book"
    ? lookupBooks(data.query)
    : lookupScreen(data.type, data.query)
}

export async function getCollectionResultById(data: {
  id: string
  type: "book" | "movie" | "tv"
}): Promise<LookupResult & { slug: string }> {
  return data.type === "book"
    ? getBookResultById(data.id)
    : getScreenResultById(data.type, data.id)
}

export const getCoverOptions = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      type: z.enum(itemTypes),
      openLibraryKey: z.string().optional(),
      tmdbId: z.string().regex(/^\d+$/).optional().or(z.literal("")),
    })
  )
  .handler(async ({ data }): Promise<string[]> => {
    await requireSignedIn()
    if (data.type === "book" && data.openLibraryKey)
      return bookCoverOptions(data.openLibraryKey)
    if ((data.type === "movie" || data.type === "tv") && data.tmdbId)
      return screenCoverOptions(data.type, data.tmdbId)
    return []
  })

export const searchCollection = createServerFn({ method: "GET" })
  .inputValidator(lookupInput)
  .handler(async ({ data }): Promise<LookupResult[]> => {
    if (!isAgentToken(getRequestHeader("authorization")))
      await requireSignedIn()
    return lookupCollection(data)
  })

export const getCollectionResult = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({ id: z.string().min(1).max(120), type: z.enum(itemTypes) })
  )
  .handler(async ({ data }): Promise<LookupResult & { slug: string }> => {
    if (!isAgentToken(getRequestHeader("authorization")))
      await requireSignedIn()
    if (data.type === "book") normalizeOpenLibraryWorkKey(data.id)
    else if (!/^\d+$/.test(data.id)) throw new Error("Invalid provider id.")
    return getCollectionResultById(data)
  })
