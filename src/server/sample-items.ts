import type { ItemStatus, ItemType } from "./schema"

export const sampleItems: Array<{
  slug: string
  type: ItemType
  status: ItemStatus
  title: string
  creator: string
  year: number
  notes: string
  coverImageUrl: string
}> = [
  {
    slug: "the-left-hand-of-darkness",
    type: "book",
    status: "reading",
    title: "The Left Hand of Darkness",
    creator: "Ursula K. Le Guin",
    year: 1969,
    notes: "A winter journey across Gethen. An enduring favorite.",
    coverImageUrl: "https://covers.openlibrary.org/b/id/10618463-L.jpg",
  },
  {
    slug: "beloved",
    type: "book",
    status: "borrowed",
    title: "Beloved",
    creator: "Toni Morrison",
    year: 1987,
    notes:
      "A novel of memory, love, and the things that refuse to stay buried.",
    coverImageUrl: "https://covers.openlibrary.org/b/id/8261367-L.jpg",
  },
  {
    slug: "the-dispossessed",
    type: "book",
    status: "owned",
    title: "The Dispossessed",
    creator: "Ursula K. Le Guin",
    year: 1974,
    notes: "An ambiguous utopia, continually revealing more with each return.",
    coverImageUrl: "https://covers.openlibrary.org/b/id/6979680-L.jpg",
  },
  {
    slug: "in-the-mood-for-love",
    type: "movie",
    status: "owned",
    title: "In the Mood for Love",
    creator: "Wong Kar-wai",
    year: 2000,
    notes:
      "Two neighbors, a shared suspicion, and every unsaid thing in between.",
    coverImageUrl:
      "https://upload.wikimedia.org/wikipedia/en/4/45/In_the_Mood_for_Love_movie.jpg",
  },
  {
    slug: "the-third-man",
    type: "movie",
    status: "borrowed",
    title: "The Third Man",
    creator: "Carol Reed",
    year: 1949,
    notes:
      "Vienna in ruins; shadows, zither, and a friend who is not quite gone.",
    coverImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/7/77/The_Third_Man_%281949_American_theatrical_poster%29.jpg",
  },
  {
    slug: "paris-texas",
    type: "movie",
    status: "owned",
    title: "Paris, Texas",
    creator: "Wim Wenders",
    year: 1984,
    notes: "A road home through the American desert.",
    coverImageUrl:
      "https://upload.wikimedia.org/wikipedia/en/d/db/Paris%2C_Texas_%281984_film_poster%29.png",
  },
]
