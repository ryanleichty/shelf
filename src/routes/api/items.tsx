import { createFileRoute } from "@tanstack/react-router"
import { eq, or } from "drizzle-orm"
import { z } from "zod"
import { isAgentRequest } from "@/server/auth"
import { db, ensureDatabase } from "@/server/db"
import { lookupCollection } from "@/server/items"
import { storeCover } from "@/server/covers"
import { items, itemTypes } from "@/server/schema"

const unauthorized = () => Response.json({ error: "Unauthorized" }, { status: 401 })
const output = { id: items.id, slug: items.slug, type: items.type, status: items.status, title: items.title, creator: items.creator, year: items.year, format: items.format, tmdbId: items.tmdbId, openLibraryKey: items.openLibraryKey, coverImageUrl: items.coverImageUrl }

export const Route = createFileRoute("/api/items")({
  server: { handlers: {
    GET: async ({ request }) => {
      if (!isAgentRequest(request)) return unauthorized()
      await ensureDatabase()
      const type = new URL(request.url).searchParams.get("type")
      if (type && !itemTypes.includes(type as (typeof itemTypes)[number])) return Response.json({ error: "Invalid type" }, { status: 400 })
      return Response.json(await db.select(output).from(items).where(type ? eq(items.type, type as "book" | "movie") : undefined))
    },
    POST: async ({ request }) => {
      if (!isAgentRequest(request)) return unauthorized()
      const body = z.object({ dryRun: z.boolean().optional(), items: z.array(z.object({ type: z.enum(itemTypes).default("movie"), query: z.string().min(1), format: z.string().optional(), status: z.enum(["", "reading", "borrowed"]).optional(), year: z.number().optional(), tmdbId: z.string().optional(), openLibraryKey: z.string().optional() })).max(40) }).safeParse(await request.json())
      if (!body.success) return Response.json({ error: "Invalid body" }, { status: 400 })
      const added: Array<{ title: string; slug: string; id?: number }> = [], skipped: Array<{ query: string; reason: string }> = [], failed: Array<{ query: string; reason: string }> = [], needsReview: Array<{ query: string; candidates: unknown[] }> = []
      for (const input of body.data.items) {
        try {
          const parsed = input.query.match(/(?:\(|\s)(\d{4})\)?\s*$/)
          const year = input.year ?? (parsed ? Number(parsed[1]) : undefined)
          const title = input.query.replace(/(?:\(|\s)\d{4}\)?\s*$/, "").trim()
          const matches = await lookupCollection({ type: input.type, query: title })
          const ranked = [...matches].sort((a, b) => Number(b.year === year) - Number(a.year === year) || Number(normalize(a.title) === normalize(title)) - Number(normalize(b.title) === normalize(title)))
          const exactTitles = ranked.filter((candidate) => normalize(candidate.title) === normalize(title))
          const yearMatches = year === undefined ? exactTitles : exactTitles.filter((candidate) => candidate.year === year)
          const top = yearMatches.length === 1 ? yearMatches[0] : year === undefined && exactTitles.length === 1 ? exactTitles[0] : undefined
          if (!top) {
            needsReview.push({ query: input.query, candidates: ranked.slice(0, 5) }); continue
          }
          const providerId = input.type === "movie" ? (input.tmdbId ?? top.id) : (input.openLibraryKey ?? top.id)
          const existing = await db.select({ id: items.id }).from(items).where(or(eq(items.slug, slugify(top.title)), input.type === "movie" ? eq(items.tmdbId, providerId) : eq(items.openLibraryKey, providerId))).limit(1)
          const sameTitle = await db.select({ title: items.title, year: items.year }).from(items).where(eq(items.type, input.type))
          const duplicate = sameTitle.some((item) => normalize(item.title) === normalize(top.title) && item.year === top.year)
          if (existing.length || duplicate) { skipped.push({ query: input.query, reason: "Already on Shelf" }); continue }
          const resolved = { ...top, slug: slugify(top.title) }
          if (body.data.dryRun) { added.push({ title: resolved.title, slug: resolved.slug }); continue }
          const now = new Date().toISOString()
          const [created] = await db.insert(items).values({ slug: resolved.slug, type: input.type, status: input.status || "owned", title: resolved.title, creator: resolved.creator, year: resolved.year ?? 0, format: input.format || null, coverImageUrl: (await storeCover(resolved.coverImageUrl, resolved.slug)) || null, tmdbId: input.type === "movie" ? providerId : null, openLibraryKey: input.type === "book" ? providerId : null, notes: "", createdAt: now, updatedAt: now }).returning({ id: items.id, title: items.title, slug: items.slug })
          added.push(created)
        } catch (error) { failed.push({ query: input.query, reason: error instanceof Error ? error.message : "Import failed" }) }
      }
      return Response.json({ added, skipped, failed, needsReview })
    },
  } },
})

function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9]/g, "") }
function slugify(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") }
