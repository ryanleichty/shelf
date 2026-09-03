import { asc, eq } from "drizzle-orm"
import { buildExport } from "@/lib/export"
import { isAgentRequest, isSignedIn } from "@/server/auth"
import { db } from "@/server/db"
import { enrichItems } from "@/server/items"
import { items, listItems, lists, loans } from "@/server/schema"

type ApiContext = { request: Request; params: Record<string, string> }

// Handlers live outside the route file so the client bundle never sees
// the database, auth, or provider code they import.
export const handlers = {
  GET: async ({ request }: ApiContext) => {
    if (!isAgentRequest(request) && !(await isSignedIn()))
      return Response.json({ error: "Unauthorized" }, { status: 401 })

    const [itemRecords, listRows, membershipRows, loanRows] = await db.batch([
      db.select().from(items).orderBy(asc(items.slug)),
      db
        .select({
          id: lists.id,
          slug: lists.slug,
          name: lists.name,
          system: lists.system,
        })
        .from(lists)
        .orderBy(asc(lists.slug)),
      db
        .select({
          listSlug: lists.slug,
          itemSlug: items.slug,
          position: listItems.position,
        })
        .from(listItems)
        .innerJoin(lists, eq(listItems.listId, lists.id))
        .innerJoin(items, eq(listItems.itemId, items.id))
        .orderBy(asc(lists.slug), asc(listItems.position)),
      db
        .select({
          itemSlug: items.slug,
          borrowerName: loans.borrowerName,
          lentAt: loans.lentAt,
          dueAt: loans.dueAt,
          returnedAt: loans.returnedAt,
        })
        .from(loans)
        .innerJoin(items, eq(loans.itemId, items.id))
        .orderBy(asc(items.slug), asc(loans.lentAt)),
    ])

    const payload = buildExport({
      items: await enrichItems(itemRecords),
      lists: listRows,
      listItems: membershipRows,
      loans: loanRows,
      exportedAt: new Date().toISOString(),
    })

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="shelf-${new Date()
          .toISOString()
          .slice(0, 10)}.json"`,
        "cache-control": "no-store",
      },
    })
  },
}
