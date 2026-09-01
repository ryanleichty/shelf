import {
  createHash,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto"
import { promisify } from "node:util"
import {
  getCookie,
  getRequestHeader,
  setCookie,
} from "@tanstack/react-start/server"
import { and, eq, gt } from "drizzle-orm"
import { db, ensureDatabase } from "./db"
import { sessions, users, type UserRole } from "./schema"

const COOKIE_NAME = "shelf-session"
const SESSION_MAX_AGE = 60 * 60 * 24 * 14
const scrypt = promisify(scryptCallback)

export type CurrentUser = {
  id: number
  firstName: string
  lastName: string
  email: string
  avatarUrl: string | null
  role: UserRole
}

function bootstrapToken() {
  const password = process.env.ADMIN_PASSWORD?.trim()
  if (!password) return null
  return createHash("sha256")
    .update(`shelf-bootstrap:${password}`)
    .digest("hex")
}

function isBootstrapSession() {
  const cookie = getCookie(COOKIE_NAME)
  const expected = bootstrapToken()
  if (!cookie || !expected) return false
  return (
    cookie.length === expected.length &&
    timingSafeEqual(Buffer.from(cookie), Buffer.from(expected))
  )
}

async function hasStoredAdmin() {
  await ensureDatabase()
  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1)
  return Boolean(admin)
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  await ensureDatabase()
  const sessionId = getCookie(COOKIE_NAME)
  if (!sessionId || isBootstrapSession()) return null
  const [session] = await db
    .select({
      id: sessions.id,
      userId: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      avatarUrl: users.avatarUrl,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.id, sessionId),
        gt(sessions.expiresAt, new Date().toISOString())
      )
    )
    .limit(1)
  return session
    ? {
        id: session.userId,
        firstName: session.firstName,
        lastName: session.lastName,
        email: session.email,
        avatarUrl: session.avatarUrl,
        role: session.role,
      }
    : null
}

export async function isSignedIn() {
  return Boolean(
    (await getCurrentUser()) ||
    (!(await hasStoredAdmin()) && isBootstrapSession())
  )
}

export async function isAdmin() {
  const user = await getCurrentUser()
  return (
    user?.role === "admin" ||
    (!(await hasStoredAdmin()) && isBootstrapSession())
  )
}

export async function requireSignedIn() {
  if (!(await isSignedIn())) throw new Error("Unauthorized")
}

export async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("Unauthorized")
}

export function isAgentRequest(request: Request) {
  const headers = [
    request.headers.get("authorization")?.trim(),
    getRequestHeader("authorization")?.trim(),
  ]
  return headers.some((header) =>
    isAgentToken(header?.replace(/^Bearer\s+/i, "").trim())
  )
}

export function isAgentToken(value: string | null | undefined) {
  const token = process.env.SHELF_AGENT_TOKEN?.trim()
  const presented = value?.trim()
  return Boolean(
    token &&
    presented &&
    presented.length === token.length &&
    timingSafeEqual(Buffer.from(presented), Buffer.from(token))
  )
}

export async function hashPassword(password: string) {
  const salt = randomUUID()
  const key = (await scrypt(password, salt, 64)) as Buffer
  return `${salt}:${key.toString("hex")}`
}

export async function verifyStoredPassword(
  password: string,
  passwordHash: string
) {
  const [salt, storedKey] = passwordHash.split(":")
  if (!salt || !storedKey) return false
  const key = (await scrypt(password, salt, 64)) as Buffer
  const stored = Buffer.from(storedKey, "hex")
  return stored.length === key.length && timingSafeEqual(stored, key)
}

function setSessionCookie(value: string) {
  setCookie(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  })
}

export async function startUserSession(userId: number) {
  await ensureDatabase()
  const id = randomUUID()
  await db.insert(sessions).values({
    id,
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString(),
  })
  setSessionCookie(id)
}

export function startBootstrapSession() {
  const token = bootstrapToken()
  if (!token) throw new Error("ADMIN_PASSWORD is required.")
  setSessionCookie(token)
}

export async function endSession() {
  const id = getCookie(COOKIE_NAME)
  if (id && !isBootstrapSession()) {
    await ensureDatabase()
    await db.delete(sessions).where(eq(sessions.id, id))
  }
  setCookie(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
}
