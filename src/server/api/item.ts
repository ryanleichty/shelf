import { eq } from "drizzle-orm"
import { z } from "zod"
import { isAgentRequest } from "@/server/auth"
import { db } from "@/server/db"
import { storeCover } from "@/server/covers"
import { hasBookEditionFields, itemPatchInput } from "@/lib/item-patch"
import { itemExists, uniqueSlug } from "@/server/items"
import { replaceItemCreators } from "@/server/item-joins"
import { items } from "@/server/schema"

const unauthorized = () =>
  Response.json({ error: "Unauthorized" }, { status: 401 })
const idParam = z.coerce.number().int().positive()

type ApiContext = { request: Request; params: Record<string, string> }

// Handlers live outside the route file so the client bundle never sees
// the database, auth, or provider code they import.
export const handlers = {
  PATCH: async ({ request, params }: ApiContext) => {
    if (!isAgentRequest(request)) return unauthorized()
    const data = itemPatchInput.safeParse(await request.json())
    if (!data.success)
      return Response.json(
        {
          error: "Invalid body",
          issues: data.error.issues.map((issue) =>
            issue.code === "unrecognized_keys"
              ? {
                  path: issue.keys.join(", "),
                  message: `Unknown field: ${issue.keys.join(", ")}`,
                }
              : { path: issue.path.join("."), message: issue.message }
          ),
        },
        { status: 400 }
      )
    if (data.data.status === "borrowed")
      return Response.json(
        { error: "Lending is managed through the app's loan actions" },
        { status: 400 }
      )
    // Reading/watching are per-member state (src/server/user-items.ts), not a
    // property of the item — narrowing itemStatuses already makes them
    // unrepresentable here, so `itemPatchInput.safeParse` above rejects them
    // with the generic "Invalid body" 400 before this line runs.
    const parsedId = idParam.safeParse(params.id)
    if (!parsedId.success)
      return Response.json({ error: "Invalid id" }, { status: 400 })
    const id = parsedId.data
    const [current] = await db.select().from(items).where(eq(items.id, id))
    if (!current) return Response.json({ error: "Not found" }, { status: 404 })
    if (current.type === "book" && data.data.edition)
      return Response.json(
        { error: "Only movies and TV shows can have an edition" },
        { status: 400 }
      )
    if (current.type !== "book" && hasBookEditionFields(data.data))
      return Response.json(
        {
          error:
            "Only books can have a subtitle, page count, publisher or ISBN",
        },
        { status: 400 }
      )
    if (
      (data.data.title !== undefined ||
        data.data.year !== undefined ||
        data.data.edition !== undefined) &&
      (await itemExists({
        id,
        type: current.type,
        title: data.data.title ?? current.title,
        year: data.data.year ?? current.year,
        providerId:
          current.type === "book" ? current.openLibraryKey : current.tmdbId,
        edition: data.data.edition ?? current.edition,
      }))
    ) {
      return Response.json(
        { error: "This edition is already on your shelf" },
        { status: 409 }
      )
    }
    if (
      data.data.slug !== undefined &&
      (await uniqueSlug(
        data.data.slug,
        data.data.edition ?? current.edition,
        id
      )) !== data.data.slug
    ) {
      return Response.json({ error: "Slug is already in use" }, { status: 409 })
    }
    const coverImageUrl =
      data.data.coverImageUrl === undefined
        ? current.coverImageUrl
        : data.data.coverImageUrl
          ? await storeCover(
              data.data.coverImageUrl,
              data.data.slug ?? current.slug
            )
          : null
    const [updated] = await db
      .update(items)
      .set({
        ...data.data,
        coverImageUrl,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(items.id, id))
      .returning()
    if (
      data.data.creator !== undefined &&
      data.data.creator !== current.creator
    )
      await replaceItemCreators(id, current.type, data.data.creator)
    return Response.json(updated)
  },
  DELETE: async ({ request, params }: ApiContext) => {
    if (!isAgentRequest(request)) return unauthorized()
    const parsedId = idParam.safeParse(params.id)
    if (!parsedId.success)
      return Response.json({ error: "Invalid id" }, { status: 400 })
    const id = parsedId.data
    const found = await db
      .delete(items)
      .where(eq(items.id, id))
      .returning({ id: items.id })
    return found.length
      ? Response.json({ ok: true })
      : Response.json({ error: "Not found" }, { status: 404 })
  },
}
