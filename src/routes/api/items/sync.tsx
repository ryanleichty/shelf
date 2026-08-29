import { createFileRoute } from "@tanstack/react-router"
import { eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { isAgentRequest } from "@/server/auth"
import { db, ensureDatabase } from "@/server/db"
import { syncItemFromProvider, type ProviderSyncResult } from "@/server/items"
import { items, itemTypes } from "@/server/schema"

const input = z.object({
  dryRun: z.boolean().optional(),
  ids: z.array(z.number().int().positive()).max(40).optional(),
  type: z.enum(itemTypes).optional(),
})

export const Route = createFileRoute("/api/items/sync")({
  server: { handlers: {
    POST: async ({ request }) => {
      if (!isAgentRequest(request)) return Response.json({ error: "Unauthorized" }, { status: 401 })
      const body = input.safeParse(await request.json())
      if (!body.success) return Response.json({ error: "Invalid body" }, { status: 400 })
      await ensureDatabase()
      const selected = body.data.ids
        ? body.data.ids.length
          ? await db.select().from(items).where(inArray(items.id, body.data.ids)).limit(40)
          : []
        : await db.select().from(items).where(body.data.type ? eq(items.type, body.data.type) : undefined).limit(40)
      const requested = body.data.ids ? new Set(body.data.ids) : undefined
      const selectedItems = requested ? selected.filter((item) => requested.has(item.id)) : selected
      const updated: ProviderSyncResult[] = []
      const skipped: ProviderSyncResult[] = []
      const failed: Array<{ itemId: number; slug: string; reason: string }> = []
      for (const item of selectedItems) {
        try {
          const result = await syncItemFromProvider(item, body.data.dryRun)
          if (result.skipped) skipped.push(result)
          else updated.push(result)
        } catch (cause) {
          failed.push({ itemId: item.id, slug: item.slug, reason: cause instanceof Error ? cause.message : "Provider sync failed." })
        }
      }
      return Response.json({ updated, skipped, failed })
    },
  } },
})
