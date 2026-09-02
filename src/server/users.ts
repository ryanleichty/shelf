import { eq } from "drizzle-orm"
import { createServerFn } from "@tanstack/react-start"
import { del, put } from "@vercel/blob"
import { z } from "zod"
import {
  getCurrentUser,
  hashPassword,
  isAdmin,
  requireAdmin,
  requireSignedIn,
  startUserSession,
} from "./auth"
import { db } from "./db"
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

function avatarExtension(fileName: string, contentType: string) {
  const extension = fileName
    .split(".")
    .pop()
    ?.replace(/[^a-z0-9]/gi, "")
  if (extension) return extension
  return contentType.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "jpg"
}

async function adminCount() {
  return (
    await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"))
  ).length
}

export const getCurrentUserProfile = createServerFn({
  method: "GET",
}).handler(async () => getCurrentUser())

export const uploadProfilePhoto = createServerFn({ method: "POST" })
  .inputValidator((data: FormData) => {
    if (!(data instanceof FormData)) throw new Error("Expected form data.")
    return data
  })
  .handler(async ({ data }) => {
    await requireSignedIn()
    const currentUser = await getCurrentUser()
    if (!currentUser) throw new Error("A user account is required.")
    if (!process.env.BLOB_READ_WRITE_TOKEN)
      throw new Error("Photo uploads are not configured.")

    const image = data.get("image")
    let source: File | ReadableStream<Uint8Array>
    let fileName: string
    let contentType: string
    if (image instanceof File) {
      if (!image.type.startsWith("image/"))
        throw new Error("Choose an image file.")
      if (image.size > 5 * 1024 * 1024)
        throw new Error("Choose an image smaller than 5 MB.")
      source = image
      fileName = image.name
      contentType = image.type
    } else if (typeof image === "string") {
      const url = new URL(image)
      if (!["http:", "https:"].includes(url.protocol))
        throw new Error("Choose an image file.")
      const response = await fetch(url)
      if (!response.ok || !response.body)
        throw new Error("Couldn’t download that image.")
      contentType = response.headers.get("content-type") ?? ""
      if (!contentType.startsWith("image/"))
        throw new Error("Choose an image file.")
      source = response.body
      fileName = url.pathname
    } else {
      throw new Error("Choose an image file.")
    }

    const blob = await put(
      `avatars/${currentUser.id}.${avatarExtension(fileName, contentType)}`,
      source,
      {
        access: "public",
        addRandomSuffix: true,
        contentType,
      }
    )
    await db
      .update(users)
      .set({ avatarUrl: blob.url, updatedAt: new Date().toISOString() })
      .where(eq(users.id, currentUser.id))

    if (
      currentUser.avatarUrl &&
      new URL(currentUser.avatarUrl).hostname.endsWith(
        ".blob.vercel-storage.com"
      )
    ) {
      await del(currentUser.avatarUrl).catch(() => undefined)
    }

    return { avatarUrl: blob.url }
  })

export const getSettings = createServerFn({ method: "GET" }).handler(
  async () => {
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
        ? await db
            .select({
              id: users.id,
              firstName: users.firstName,
              lastName: users.lastName,
              email: users.email,
              role: users.role,
            })
            .from(users)
            .orderBy(users.firstName, users.lastName)
        : [],
    }
  }
)

export const saveProfile = createServerFn({ method: "POST" })
  .inputValidator(profileInput)
  .handler(async ({ data }) => {
    await requireSignedIn()
    const currentUser = await getCurrentUser()
    const email = data.email.toLowerCase()
    const now = new Date().toISOString()

    if (!currentUser) {
      await requireAdmin()
      if (!data.password)
        throw new Error("Choose a password for the first admin.")
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
        ...(data.password
          ? { passwordHash: await hashPassword(data.password) }
          : {}),
        updatedAt: now,
      })
      .where(eq(users.id, currentUser.id))
    return { ok: true }
  })

export const saveUser = createServerFn({ method: "POST" })
  .inputValidator(userInput)
  .handler(async ({ data }) => {
    await requireAdmin()
    const email = data.email.toLowerCase()
    const now = new Date().toISOString()
    if (!data.id) {
      if (!data.password)
        throw new Error("A password is required for a new user.")
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
    if (
      existing.role === "admin" &&
      data.role !== "admin" &&
      (await adminCount()) === 1
    )
      throw new Error("Shelf needs at least one admin.")
    await db
      .update(users)
      .set({
        firstName: data.firstName,
        lastName: data.lastName,
        email,
        role: data.role,
        ...(data.password
          ? { passwordHash: await hashPassword(data.password) }
          : {}),
        updatedAt: now,
      })
      .where(eq(users.id, data.id))
    return { ok: true }
  })

export const deleteUser = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    await requireAdmin()
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, data.id))
      .limit(1)
    if (!user) return { ok: true }
    if (user.role === "admin" && (await adminCount()) === 1)
      throw new Error("Shelf needs at least one admin.")
    await db.delete(sessions).where(eq(sessions.userId, data.id))
    await db.delete(users).where(eq(users.id, data.id))
    return { ok: true }
  })
