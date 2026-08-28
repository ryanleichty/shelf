import { db } from "../src/server/db"
import { items } from "../src/server/schema"

const now = new Date().toISOString()

await db
  .insert(items)
  .values([
    {
      slug: "the-left-hand-of-darkness",
      type: "book",
      title: "The Left Hand of Darkness",
      creator: "Ursula K. Le Guin",
      year: 1969,
      notes: "A winter journey across Gethen. An enduring favorite.",
      createdAt: now,
      updatedAt: now,
    },
    {
      slug: "beloved",
      type: "book",
      title: "Beloved",
      creator: "Toni Morrison",
      year: 1987,
      notes: "A novel of memory, love, and the things that refuse to stay buried.",
      createdAt: now,
      updatedAt: now,
    },
    {
      slug: "the-dispossessed",
      type: "book",
      title: "The Dispossessed",
      creator: "Ursula K. Le Guin",
      year: 1974,
      notes: "An ambiguous utopia, continually revealing more with each return.",
      createdAt: now,
      updatedAt: now,
    },
    {
      slug: "in-the-mood-for-love",
      type: "movie",
      title: "In the Mood for Love",
      creator: "Wong Kar-wai",
      year: 2000,
      notes: "Two neighbors, a shared suspicion, and every unsaid thing in between.",
      createdAt: now,
      updatedAt: now,
    },
    {
      slug: "the-third-man",
      type: "movie",
      title: "The Third Man",
      creator: "Carol Reed",
      year: 1949,
      notes: "Vienna in ruins; shadows, zither, and a friend who is not quite gone.",
      createdAt: now,
      updatedAt: now,
    },
    {
      slug: "paris-texas",
      type: "movie",
      title: "Paris, Texas",
      creator: "Wim Wenders",
      year: 1984,
      notes: "A road home through the American desert.",
      createdAt: now,
      updatedAt: now,
    },
  ])
  .onConflictDoNothing()

console.log("Sample shelf content added.")
