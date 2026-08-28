import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./src/server/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL ?? "file:data/shelf.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
})
