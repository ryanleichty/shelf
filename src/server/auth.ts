import { createHash, timingSafeEqual } from "node:crypto"
import { getCookie, setCookie } from "@tanstack/react-start/server"

const COOKIE_NAME = "shelf-admin"
const sessionSecret = () => process.env.SESSION_SECRET ?? process.env.ADMIN_PASSWORD

function sessionToken() {
  const secret = sessionSecret()
  if (!secret) throw new Error("SESSION_SECRET or ADMIN_PASSWORD is required.")
  return createHash("sha256").update(`shelf-admin:${secret}`).digest("hex")
}

export function isAdmin() {
  const cookie = getCookie(COOKIE_NAME)
  if (!cookie || !sessionSecret()) return false
  const expected = sessionToken()
  return (
    cookie.length === expected.length &&
    timingSafeEqual(Buffer.from(cookie), Buffer.from(expected))
  )
}

export function requireAdmin() {
  if (!isAdmin()) throw new Error("Unauthorized")
}

export function verifyPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) return false
  return (
    password.length === expected.length &&
    timingSafeEqual(Buffer.from(password), Buffer.from(expected))
  )
}

export function startAdminSession() {
  setCookie(COOKIE_NAME, sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  })
}

export function endAdminSession() {
  setCookie(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
}
