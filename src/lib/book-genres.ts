import { bookGenreOptions } from "./item-input"

export type BookGenre = (typeof bookGenreOptions)[number]

// Open Library subjects that name a shelf genre without repeating its label.
// Keys are normalized the same way incoming subjects are (see
// `normalizeSubject`), so compare lowercase, single-spaced, no trailing dot.
const subjectAliases: Record<string, BookGenre> = {
  theology: "Theology",
  "theology, doctrinal": "Theology",
  "doctrinal theology": "Theology",
  "systematic theology": "Theology",
  "biblical theology": "Theology",
  "practical theology": "Theology",
  "pastoral theology": "Theology",
  "christian theology": "Theology",
  religion: "Theology",
  religions: "Theology",
  christianity: "Theology",
  "christian life": "Theology",
  "christian living": "Theology",
  "christian ethics": "Theology",
  "christian doctrine": "Theology",
  "christian apologetics": "Theology",
  apologetics: "Theology",
  "religious life": "Theology",
  "spiritual life": "Theology",
  spirituality: "Theology",
  bible: "Theology",
  "bible study": "Theology",
  "biblical studies": "Theology",
  church: "Theology",
  faith: "Theology",
  god: "Theology",
  "god (christianity)": "Theology",
  "jesus christ": "Theology",
  prayer: "Theology",
  worship: "Theology",
  "reformed church": "Theology",
  calvinism: "Theology",
}

const genreByLabel = new Map<string, BookGenre>(
  bookGenreOptions.map((genre) => [genre.toLocaleLowerCase(), genre])
)

export function normalizeSubject(subject: string) {
  return subject
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.$/, "")
}

export function bookGenreForSubject(subject: string): BookGenre | undefined {
  const key = normalizeSubject(subject)
  return genreByLabel.get(key) ?? subjectAliases[key]
}

// The shelf genres a work's subjects name, in `bookGenreOptions` order.
export function bookGenresFromSubjects(subjects?: string[]): BookGenre[] {
  const matched = new Set<BookGenre>()
  for (const subject of subjects ?? []) {
    const genre = bookGenreForSubject(subject)
    if (genre) matched.add(genre)
  }
  return bookGenreOptions.filter((genre) => matched.has(genre))
}
