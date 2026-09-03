import { eq } from "drizzle-orm"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { db } from "./db"
import { users } from "./schema"

export const getSignedInStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    const { isSignedIn } = await import("./auth")
    return isSignedIn()
  }
)

export const getAdminStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    const { isAdmin } = await import("./auth")
    return isAdmin()
  }
)

export const getLoginMode = createServerFn({ method: "GET" }).handler(
  async () => {
    const [admin] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "admin"))
      .limit(1)
    return { requiresEmail: Boolean(admin) }
  }
)

export const login = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().email().optional().or(z.literal("")),
      password: z.string().min(1),
    })
  )
  .handler(async ({ data }) => {
    const {
      clearLoginFailures,
      DUMMY_PASSWORD_HASH,
      loginLockoutSeconds,
      passwordsMatch,
      recordLoginFailure,
      startBootstrapSession,
      startUserSession,
      verifyStoredPassword,
    } = await import("./auth")
    const wrongPassword = {
      ok: false,
      error: "That password doesn’t open this shelf.",
    }
    const lockedOut = (seconds: number) => ({
      ok: false,
      error: `Too many attempts. Try again in ${Math.max(
        1,
        Math.ceil(seconds / 60)
      )} minute${seconds > 60 ? "s" : ""}.`,
    })
    const [storedAdmin] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "admin"))
      .limit(1)
    if (!storedAdmin) {
      if (!process.env.ADMIN_PASSWORD) {
        return {
          ok: false,
          error:
            "Admin access is not configured. Set ADMIN_PASSWORD to enable it.",
        }
      }
      const wait = await loginLockoutSeconds("bootstrap")
      if (wait) return lockedOut(wait)
      if (!passwordsMatch(data.password, process.env.ADMIN_PASSWORD.trim())) {
        await recordLoginFailure("bootstrap")
        return wrongPassword
      }
      await clearLoginFailures("bootstrap")
      await startBootstrapSession()
      return { ok: true, error: "" }
    }
    if (!data.email) {
      return {
        ok: false,
        error: "Enter your email and password.",
      }
    }
    const email = data.email.trim().toLowerCase()
    const key = `email:${email}`
    const wait = await loginLockoutSeconds(key)
    if (wait) return lockedOut(wait)
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
    const valid = await verifyStoredPassword(
      data.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH
    )
    if (!user || !valid) {
      await recordLoginFailure(key)
      return wrongPassword
    }
    await clearLoginFailures(key)
    await startUserSession(user.id)
    return { ok: true, error: "" }
  })

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const { endSession } = await import("./auth")
  await endSession()
  return { ok: true }
})
