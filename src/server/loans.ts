import { and, asc, eq, isNull } from "drizzle-orm"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { requireSignedIn } from "./auth"
import { db } from "./db"
import { items, loans, users } from "./schema"

export const getShelfMembers = createServerFn({ method: "GET" }).handler(
  async () => {
    await requireSignedIn()
    // Names only — the lend picker has no business with emails or roles.
    return db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .orderBy(asc(users.firstName), asc(users.lastName))
  }
)

export const lendItem = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      itemId: z.number().int().positive(),
      borrowerUserId: z.number().int().positive().optional(),
      borrowerName: z.string().trim().min(1).max(120).optional(),
      lentAt: z.string().date().optional(),
      dueAt: z.string().date().optional(),
    })
  )
  .handler(async ({ data }) => {
    await requireSignedIn()
    let borrowerName: string
    if (data.borrowerUserId) {
      const [borrower] = await db
        .select({ firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, data.borrowerUserId))
        .limit(1)
      if (!borrower) throw new Error("That person is not on this shelf.")
      borrowerName = `${borrower.firstName} ${borrower.lastName}`.trim()
    } else {
      if (!data.borrowerName?.trim()) throw new Error("Say who has it.")
      borrowerName = data.borrowerName.trim()
    }
    const [openLoan] = await db
      .select({ id: loans.id })
      .from(loans)
      .where(and(eq(loans.itemId, data.itemId), isNull(loans.returnedAt)))
      .limit(1)
    if (openLoan) throw new Error("That item is already out.")
    const now = new Date().toISOString()
    const lentAt = data.lentAt ?? now.slice(0, 10)
    return db.transaction(async (tx) => {
      const [loan] = await tx
        .insert(loans)
        .values({
          itemId: data.itemId,
          borrowerUserId: data.borrowerUserId,
          borrowerName,
          lentAt,
          dueAt: data.dueAt,
          createdAt: now,
        })
        .returning()
      await tx
        .update(items)
        .set({ status: "borrowed", updatedAt: now })
        .where(eq(items.id, data.itemId))
      return loan
    })
  })

export const returnLoan = createServerFn({ method: "POST" })
  .inputValidator(z.object({ itemId: z.number().int().positive() }))
  .handler(async ({ data }) => {
    await requireSignedIn()
    const [openLoan] = await db
      .select({ id: loans.id })
      .from(loans)
      .where(and(eq(loans.itemId, data.itemId), isNull(loans.returnedAt)))
      .limit(1)
    if (!openLoan) throw new Error("That item is not out.")
    const now = new Date().toISOString()
    await db.transaction(async (tx) => {
      await tx
        .update(loans)
        .set({ returnedAt: now.slice(0, 10) })
        .where(eq(loans.id, openLoan.id))
      await tx
        .update(items)
        .set({ status: "owned", updatedAt: now })
        .where(eq(items.id, data.itemId))
    })
    return { ok: true }
  })
