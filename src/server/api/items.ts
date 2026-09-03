import { eq } from "drizzle-orm"
import { z } from "zod"
import { isAgentRequest } from "@/server/auth"
import { db } from "@/server/db"
import { createItemFromProvider, itemExists, uniqueSlug } from "@/server/items"
import { normalizeOpenLibraryWorkKey } from "@/server/openlibrary"
import { getCollectionResultById, lookupCollection } from "@/server/providers"
import { slugify } from "@/lib/catalog"
import { parseImportQuery, rankImportCandidates } from "@/lib/import-query"
import { items, itemEditions, itemTypes } from "@/server/schema"

const unauthorized = () =>
  Response.json({ error: "Unauthorized" }, { status: 401 })
const output = {
  id: items.id,
  slug: items.slug,
  type: items.type,
  status: items.status,
  title: items.title,
  creator: items.creator,
  year: items.year,
  format: items.format,
  edition: items.edition,
  certification: items.certification,
  runtime: items.runtime,
  subtitle: items.subtitle,
  pageCount: items.pageCount,
  publisher: items.publisher,
  isbn13: items.isbn13,
  tmdbId: items.tmdbId,
  openLibraryKey: items.openLibraryKey,
  coverImageUrl: items.coverImageUrl,
  backdropImageUrl: items.backdropImageUrl,
}

type ApiContext = { request: Request; params: Record<string, string> }

// Handlers live outside the route file so the client bundle never sees
// the database, auth, or provider code they import.
export const handlers = {
  GET: async ({ request }: ApiContext) => {
    if (!isAgentRequest(request)) return unauthorized()
    const type = new URL(request.url).searchParams.get("type")
    if (type && !itemTypes.includes(type as (typeof itemTypes)[number]))
      return Response.json({ error: "Invalid type" }, { status: 400 })
    return Response.json(
      await db
        .select(output)
        .from(items)
        .where(type ? eq(items.type, type as "book" | "movie") : undefined)
    )
  },
  POST: async ({ request }: ApiContext) => {
    if (!isAgentRequest(request)) return unauthorized()
    const body = z
      .object({
        dryRun: z.boolean().optional(),
        items: z
          .array(
            z.object({
              type: z.enum(itemTypes).default("movie"),
              query: z.string().min(1),
              format: z.string().optional(),
              edition: z.enum(itemEditions).optional().or(z.literal("")),
              status: z.enum(["owned"]).or(z.literal("")).optional(),
              year: z.number().optional(),
              tmdbId: z.string().regex(/^\d+$/).optional(),
              openLibraryKey: z.string().max(120).optional(),
            })
          )
          .max(40),
      })
      .safeParse(await request.json())
    if (!body.success)
      return Response.json({ error: "Invalid body" }, { status: 400 })
    const added: Array<{ title: string; slug: string; id?: number }> = [],
      skipped: Array<{ query: string; reason: string }> = [],
      failed: Array<{ query: string; reason: string }> = [],
      needsReview: Array<{ query: string; candidates: unknown[] }> = []
    for (const input of body.data.items) {
      try {
        if (input.type === "book" && input.edition) {
          failed.push({
            query: input.query,
            reason: "Only movies and TV shows can have an edition.",
          })
          continue
        }
        const pinnedId =
          input.type === "book"
            ? input.openLibraryKey?.trim()
              ? normalizeOpenLibraryWorkKey(input.openLibraryKey)
              : undefined
            : input.tmdbId?.trim() || undefined
        const { title, year: parsedYear } = parseImportQuery(input.query)
        const year = input.year ?? parsedYear
        let top
        if (pinnedId) {
          top = await getCollectionResultById({
            type: input.type,
            id: pinnedId,
          })
        } else {
          const matches = await lookupCollection({
            type: input.type,
            query: title,
          })
          const { top: best, ranked } = rankImportCandidates(
            matches,
            title,
            year
          )
          top = best
          if (!top) {
            needsReview.push({
              query: input.query,
              candidates: ranked.slice(0, 5),
            })
            continue
          }
        }
        const providerId = pinnedId ?? top.id
        if (
          await itemExists({
            type: input.type,
            title: top.title,
            year: top.year ?? 0,
            providerId,
            edition: input.edition,
          })
        ) {
          skipped.push({ query: input.query, reason: "Already on Shelf" })
          continue
        }
        const providerResult = pinnedId
          ? top
          : await getCollectionResultById({
              type: input.type,
              id: providerId,
            })
        if (body.data.dryRun) {
          added.push({
            title: providerResult.title,
            slug: await uniqueSlug(
              slugify(providerResult.title),
              input.edition
            ),
          })
          continue
        }
        const created = await createItemFromProvider({
          type: input.type,
          providerId,
          result: providerResult,
          fallbackCreator: top.creator,
          fallbackCoverImageUrl: top.coverImageUrl,
          format: input.format,
          edition: input.edition,
          status: input.status,
        })
        added.push(created)
      } catch (error) {
        failed.push({
          query: input.query,
          reason: error instanceof Error ? error.message : "Import failed",
        })
      }
    }
    return Response.json({ added, skipped, failed, needsReview })
  },
}
