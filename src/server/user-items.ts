import { and, eq } from "drizzle-orm"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { requireSignedIn } from "./auth"
import { db } from "./db"
import { items, itemProgressStates, userItems } from "./schema"

export const setItemState = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      itemId: z.number().int().positive(),
      state: z.enum(itemProgressStates),
    })
  )
  .handler(async ({ data }) => {
    await requireSignedIn()
    // Imported here so node:crypto never reaches the client bundle.
    const { getCurrentUser } = await import("./auth")
    const user = await getCurrentUser()
    if (!user) throw new Error("Finish setting up your profile first.")
    const [item] = await db
      .select({ type: items.type })
      .from(items)
      .where(eq(items.id, data.itemId))
      .limit(1)
    if (!item) throw new Error("That item does not exist.")
    if (data.state === "reading" && item.type !== "book")
      throw new Error("Only books can be marked as reading.")
    if (data.state === "watching" && item.type === "book")
      throw new Error("Only movies and TV shows can be marked as watching.")
    const now = new Date().toISOString()
    await db
      .insert(userItems)
      .values({
        userId: user.id,
        itemId: data.itemId,
        state: data.state,
        startedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [userItems.userId, userItems.itemId],
        set: { state: data.state, updatedAt: now },
      })
    return { ok: true }
  })

export const clearItemState = createServerFn({ method: "POST" })
  .inputValidator(z.object({ itemId: z.number().int().positive() }))
  .handler(async ({ data }) => {
    await requireSignedIn()
    // Imported here so node:crypto never reaches the client bundle.
    const { getCurrentUser } = await import("./auth")
    const user = await getCurrentUser()
    if (!user) throw new Error("Finish setting up your profile first.")
    await db
      .delete(userItems)
      .where(
        and(eq(userItems.userId, user.id), eq(userItems.itemId, data.itemId))
      )
    return { ok: true }
  })
