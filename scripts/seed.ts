import { db, seedSampleItems } from "../src/server/db"

await seedSampleItems(db)
console.log("Sample shelf content added.")
