import { eq } from "drizzle-orm"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import {
  getCurrentUser,
  hashPassword,
  isAdmin,
  requireAdmin,
  requireSignedIn,
  startUserSession,
} from "./auth"
import { db, ensureDatabase } from "./db"
import { sessions, users, userRoles } from "./schema"

const profileInput = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(256).optional().or(z.literal("")),
})

const userInput = profileInput.extend({
  id: z.number().int().optional(),
  role: z.enum(userRoles),
})

async function adminCount() {
  return (
    await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"))
  ).length
}

export const getSettings = createServerFn({ method: "GET" }).handler(async () => {
  await requireSignedIn()
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return {
      profile: {
        id: null,
        firstName: "",
        lastName: "",
        email: "",
        role: "admin" as const,
      },
      bootstrap: true,
      isAdmin: true,
      users: [],
    }
  }
  const admin = await isAdmin()
  return {
    profile: currentUser,
    bootstrap: false,
    isAdmin: admin,
    users: admin
      ? await db.select().from(users).orderBy(users.firstName, users.lastName)
      : [],
  }
})

export const saveProfile = createServerFn({ method: "POST" })
  .validator(profileInput)
  .handler(async ({ data }) => {
    await requireSignedIn()
    await ensureDatabase()
    const currentUser = await getCurrentUser()
    const email = data.email.toLowerCase()
    const now = new Date().toISOString()

    if (!currentUser) {
      await requireAdmin()
      if (!data.password) throw new Error("Choose a password for the first admin.")
      const [created] = await db
        .insert(users)
        .values({
          firstName: data.firstName,
          lastName: data.lastName,
          email,
          role: "admin",
          passwordHash: await hashPassword(data.password),
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: users.id })
      await startUserSession(created.id)
      return { ok: true }
    }

    await db
      .update(users)
      .set({
        firstName: data.firstName,
        lastName: data.lastName,
        email,
        ...(data.password ? { passwordHash: await hashPassword(data.password) } : {}),
        updatedAt: now,
      })
      .where(eq(users.id, currentUser.id))
    return { ok: true }
  })

export const saveUser = createServerFn({ method: "POST" })
  .validator(userInput)
  .handler(async ({ data }) => {
    await requireAdmin()
    await ensureDatabase()
    const email = data.email.toLowerCase()
    const now = new Date().toISOString()
    if (!data.id) {
      if (!data.password) throw new Error("A password is required for a new user.")
      await db.insert(users).values({
        firstName: data.firstName,
        lastName: data.lastName,
        email,
        role: data.role,
        passwordHash: await hashPassword(data.password),
        createdAt: now,
        updatedAt: now,
      })
      return { ok: true }
    }

    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.id, data.id))
      .limit(1)
    if (!existing) throw new Error("User not found.")
    if (existing.role === "admin" && data.role !== "admin" && (await adminCount()) === 1)
      throw new Error("Shelf needs at least one admin.")
    await db
      .update(users)
      .set({
        firstName: data.firstName,
        lastName: data.lastName,
        email,
        role: data.role,
        ...(data.password ? { passwordHash: await hashPassword(data.password) } : {}),
        updatedAt: now,
      })
      .where(eq(users.id, data.id))
    return { ok: true }
  })

export const deleteUser = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    await requireAdmin()
    await ensureDatabase()
    const [user] = await db.select().from(users).where(eq(users.id, data.id)).limit(1)
    if (!user) return { ok: true }
    if (user.role === "admin" && (await adminCount()) === 1)
      throw new Error("Shelf needs at least one admin.")
    await db.delete(sessions).where(eq(sessions.userId, data.id))
    await db.delete(users).where(eq(users.id, data.id))
    return { ok: true }
  })
