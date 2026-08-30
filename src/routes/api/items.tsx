import { createFileRoute } from "@tanstack/react-router"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { isAgentRequest } from "@/server/auth"
import { db, ensureDatabase, refreshSearchIndex } from "@/server/db"
import {
  getCollectionResultById,
  itemExists,
  lookupCollection,
  normalizeTitle,
  normalizeOpenLibraryWorkKey,
  replaceItemCollection,
  replaceItemCast,
  replaceItemCreators,
  upsertTags,
  uniqueSlug,
} from "@/server/items"
import { storeCover } from "@/server/covers"
import { items, itemTypes } from "@/server/schema"

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
  tmdbId: items.tmdbId,
  openLibraryKey: items.openLibraryKey,
  coverImageUrl: items.coverImageUrl,
  backdropImageUrl: items.backdropImageUrl,
}

export const Route = createFileRoute("/api/items")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAgentRequest(request)) return unauthorized()
        await ensureDatabase()
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
      POST: async ({ request }) => {
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
                  edition: z
                    .enum(["theatrical", "extended", "director-cut"])
                    .optional()
                    .or(z.literal("")),
                  status: z
                    .enum(["", "reading", "watching", "borrowed"])
                    .optional(),
                  year: z.number().optional(),
                  tmdbId: z.string().optional(),
                  openLibraryKey: z.string().optional(),
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
            const parsed = input.query.match(/(?:\(|\s)(\d{4})\)?\s*$/)
            const year = input.year ?? (parsed ? Number(parsed[1]) : undefined)
            const title = input.query
              .replace(/(?:\(|\s)\d{4}\)?\s*$/, "")
              .trim()
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
              const ranked = [...matches].sort(
                (a, b) =>
                  Number(b.year === year) - Number(a.year === year) ||
                  Number(normalizeTitle(a.title) === normalizeTitle(title)) -
                    Number(normalizeTitle(b.title) === normalizeTitle(title))
              )
              const exactTitles = ranked.filter(
                (candidate) =>
                  normalizeTitle(candidate.title) === normalizeTitle(title)
              )
              const yearMatches =
                year === undefined
                  ? exactTitles
                  : exactTitles.filter((candidate) => candidate.year === year)
              top =
                yearMatches.length === 1
                  ? yearMatches[0]
                  : year === undefined && exactTitles.length === 1
                    ? exactTitles[0]
                    : undefined
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
            const resolved = {
              ...providerResult,
              creator:
                providerResult.creator === "Unknown author"
                  ? top.creator
                  : providerResult.creator,
              coverImageUrl: providerResult.coverImageUrl || top.coverImageUrl,
              slug: await uniqueSlug(
                slugify(providerResult.title),
                input.edition
              ),
            }
            if (body.data.dryRun) {
              added.push({ title: resolved.title, slug: resolved.slug })
              continue
            }
            const now = new Date().toISOString()
            const [created] = await db
              .insert(items)
              .values({
                slug: resolved.slug,
                type: input.type,
                status: input.status || "owned",
                title: resolved.title,
                creator: resolved.creator,
                year: resolved.year ?? 0,
                format: input.format || null,
                edition: input.edition || null,
                description: resolved.description || null,
                certification: resolved.certification ?? null,
                runtime: resolved.runtime ?? null,
                coverImageUrl:
                  (await storeCover(resolved.coverImageUrl, resolved.slug)) ||
                  null,
                backdropImageUrl: resolved.backdropImageUrl || null,
                tmdbId: input.type === "book" ? null : providerId,
                openLibraryKey: input.type === "book" ? providerId : null,
                notes: "",
                createdAt: now,
                updatedAt: now,
              })
              .returning({ id: items.id, title: items.title, slug: items.slug })
            await upsertTags(created.id, "genre", resolved.genres)
            await upsertTags(created.id, "keyword", resolved.keywords ?? [])
            await replaceItemCreators(
              created.id,
              input.type,
              resolved.creatorPeople ?? resolved.creator
            )
            if (input.type !== "book" && resolved.cast !== undefined)
              await replaceItemCast(
                created.id,
                resolved.castPeople ?? resolved.cast.map((name) => ({ name }))
              )
            if (input.type === "movie")
              await replaceItemCollection(
                created.id,
                resolved.collection ?? null
              )
            await refreshSearchIndex()
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
    },
  },
})

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}
