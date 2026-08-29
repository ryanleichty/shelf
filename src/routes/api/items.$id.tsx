import { createFileRoute } from "@tanstack/react-router"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { isAgentRequest } from "@/server/auth"
import { storeCover } from "@/server/covers"
import { db, ensureDatabase } from "@/server/db"
import { items } from "@/server/schema"

const unauthorized = () => Response.json({ error: "Unauthorized" }, { status: 401 })
const patch = z.object({ title: z.string().min(1).optional(), creator: z.string().min(1).optional(), year: z.number().int().optional(), format: z.string().nullable().optional(), status: z.enum(["owned", "reading", "borrowed"]).optional(), coverImageUrl: z.string().url().nullable().optional(), slug: z.string().min(1).optional() })
export const Route = createFileRoute("/api/items/$id")({ server: { handlers: {
  PATCH: async ({ request, params }) => {
    if (!isAgentRequest(request)) return unauthorized(); await ensureDatabase()
    const data = patch.safeParse(await request.json()); if (!data.success) return Response.json({ error: "Invalid body" }, { status: 400 })
    const id = Number(params.id); const [current] = await db.select().from(items).where(eq(items.id, id))
    if (!current) return Response.json({ error: "Not found" }, { status: 404 })
    const coverImageUrl = data.data.coverImageUrl === undefined ? current.coverImageUrl : data.data.coverImageUrl ? await storeCover(data.data.coverImageUrl, data.data.slug ?? current.slug) : null
    const [updated] = await db.update(items).set({ ...data.data, coverImageUrl, updatedAt: new Date().toISOString() }).where(eq(items.id, id)).returning()
    return Response.json(updated)
  },
  DELETE: async ({ request, params }) => {
    if (!isAgentRequest(request)) return unauthorized(); await ensureDatabase()
    const id = Number(params.id); const found = await db.delete(items).where(eq(items.id, id)).returning({ id: items.id })
    return found.length ? Response.json({ ok: true }) : Response.json({ error: "Not found" }, { status: 404 })
  },
} } })
