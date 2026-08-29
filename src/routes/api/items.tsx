import { createFileRoute } from "@tanstack/react-router"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { isAgentRequest } from "@/server/auth"
import { db, ensureDatabase } from "@/server/db"
import { importItems } from "@/server/items"
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
      if (body.data.dryRun) return Response.json({ added: [], skipped: [], failed: [], needsReview: body.data.items.map((item) => ({ query: item.query, candidates: [] })) })
      const result = await importItems({ data: { type: body.data.items[0]?.type ?? "movie", format: (body.data.items[0]?.format ?? "") as "" | "hardcover" | "paperback" | "blu-ray" | "dvd" | "other", queries: body.data.items.map((item) => item.query) } })
      return Response.json({ ...result, added: result.added, needsReview: [] })
    },
  } },
})
