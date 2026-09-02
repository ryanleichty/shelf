// TMDB extras that never change once an item is saved: stored on the row at
// save/sync time so the home billboard and item page need no runtime fetch.

export type TmdbExtras = {
  tagline: string | null
  logoImageUrl: string | null
  trailerKey: string | null
}

type TmdbLogo = {
  file_path?: string
  iso_639_1?: string | null
  width?: number
}

type TmdbVideo = {
  key?: string
  official?: boolean
  iso_3166_1?: string
  iso_639_1?: string
  site?: string
  type?: string
}

export type TmdbExtrasSource = {
  tagline?: string | null
  images?: { logos?: TmdbLogo[] }
  videos?: { results?: TmdbVideo[] }
}

export const TMDB_EXTRAS_APPEND = "images,videos"

export function tmdbExtrasFrom(result: TmdbExtrasSource): TmdbExtras {
  const englishLogos = (result.images?.logos ?? []).filter(
    (logo) => logo.iso_639_1 === "en" && Boolean(logo.file_path)
  )
  const logo =
    englishLogos.find((image) =>
      image.file_path?.toLowerCase().endsWith(".svg")
    ) ??
    [...englishLogos]
      .filter((image) => image.file_path?.toLowerCase().endsWith(".png"))
      .sort((left, right) => (right.width ?? 0) - (left.width ?? 0))[0] ??
    englishLogos[0] ??
    null
  const trailer = (result.videos?.results ?? []).find(
    (video) =>
      video.official === true &&
      video.type === "Trailer" &&
      video.site === "YouTube" &&
      video.iso_3166_1 === "US" &&
      video.iso_639_1 === "en" &&
      Boolean(video.key?.trim())
  )
  return {
    tagline: result.tagline?.trim() || null,
    logoImageUrl: logo?.file_path
      ? `https://image.tmdb.org/t/p/original${logo.file_path}`
      : null,
    trailerKey: trailer?.key ?? null,
  }
}

export async function fetchTmdbExtras(
  type: "movie" | "tv",
  tmdbId: string
): Promise<TmdbExtras> {
  const apiKey = process.env.TMDB_API_KEY
  const empty = { tagline: null, logoImageUrl: null, trailerKey: null }
  if (!apiKey) return empty
  try {
    const url = new URL(`https://api.themoviedb.org/3/${type}/${tmdbId}`)
    url.searchParams.set("api_key", apiKey)
    url.searchParams.set("language", "en-US")
    url.searchParams.set("append_to_response", TMDB_EXTRAS_APPEND)
    url.searchParams.set("include_image_language", "en,null")
    const response = await fetch(url)
    if (!response.ok) return empty
    return tmdbExtrasFrom((await response.json()) as TmdbExtrasSource)
  } catch {
    return empty
  }
}

export async function fetchTmdbCollectionPartIds(
  tmdbCollectionId: string
): Promise<string[]> {
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) return []
  try {
    const url = new URL(
      `https://api.themoviedb.org/3/collection/${tmdbCollectionId}`
    )
    url.searchParams.set("api_key", apiKey)
    const response = await fetch(url)
    if (!response.ok) return []
    const body = (await response.json()) as {
      parts?: Array<{ id?: number | string; release_date?: string }>
    }
    return [...(body.parts ?? [])]
      .sort((left, right) =>
        (left.release_date ?? "9999").localeCompare(
          right.release_date ?? "9999"
        )
      )
      .flatMap((part) =>
        typeof part.id === "number" || typeof part.id === "string"
          ? [String(part.id)]
          : []
      )
  } catch {
    return []
  }
}
