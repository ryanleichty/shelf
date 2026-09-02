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
import { and, eq, gt, sql } from "drizzle-orm"
import { db } from "./db"
import { loginAttempts, sessions, users, type UserRole } from "./schema"

const COOKIE_NAME = "shelf-session"
const SESSION_MAX_AGE = 60 * 60 * 24 * 14
const scrypt = promisify(scryptCallback)
const LOCKOUT_AFTER = 5
const LOCKOUT_BASE_MS = 30_000
const LOCKOUT_MAX_MS = 15 * 60_000

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

export function isBootstrapSession() {
  const cookie = getCookie(COOKIE_NAME)
  const expected = bootstrapToken()
  if (!cookie || !expected) return false
  return (
    cookie.length === expected.length &&
    timingSafeEqual(Buffer.from(cookie), Buffer.from(expected))
  )
}

async function hasStoredAdmin() {
  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1)
  return Boolean(admin)
}

// Session id from the cookie, or null when there is none or it is the
// bootstrap token. Lets callers batch the session lookup with other queries.
export function getSessionId() {
  const sessionId = getCookie(COOKIE_NAME)
  return sessionId && !isBootstrapSession() ? sessionId : null
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
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
  return [
    request.headers.get("authorization"),
    getRequestHeader("authorization"),
  ].some((header) => isAgentToken(header))
}

export function isAgentToken(value: string | null | undefined) {
  const token = process.env.SHELF_AGENT_TOKEN?.trim()
  const presented = value
    ?.trim()
    .replace(/^Bearer\s+/i, "")
    .trim()
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

// Seconds the caller must still wait, or 0 when the key is not locked.
export async function loginLockoutSeconds(key: string) {
  const [row] = await db
    .select()
    .from(loginAttempts)
    .where(eq(loginAttempts.key, key))
    .limit(1)
  if (!row || row.failures < LOCKOUT_AFTER) return 0
  const wait = Math.min(
    LOCKOUT_BASE_MS * 2 ** (row.failures - LOCKOUT_AFTER),
    LOCKOUT_MAX_MS
  )
  const remaining = new Date(row.lastFailedAt).getTime() + wait - Date.now()
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0
}

export async function recordLoginFailure(key: string) {
  const now = new Date().toISOString()
  await db
    .insert(loginAttempts)
    .values({ key, failures: 1, lastFailedAt: now })
    .onConflictDoUpdate({
      target: loginAttempts.key,
      set: { failures: sql`${loginAttempts.failures} + 1`, lastFailedAt: now },
    })
}

export async function clearLoginFailures(key: string) {
  await db.delete(loginAttempts).where(eq(loginAttempts.key, key))
}

export function passwordsMatch(presented: string, expected: string) {
  const left = Buffer.from(presented)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

// A syntactically valid hash that matches nothing, so unknown-account logins
// cost the same scrypt work as wrong-password logins.
export const DUMMY_PASSWORD_HASH = `00000000-0000-4000-8000-000000000000:${"0".repeat(128)}`

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
