import { slugify, yearFromDate } from "@/lib/catalog"
import type { ProviderPerson } from "./item-joins"
import type { CollectionInput, LookupResult } from "./providers"
import type { SyncedFields } from "./item-sync"

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
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
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
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
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

export async function lookupScreen(
  type: "movie" | "tv",
  query: string
): Promise<LookupResult[]> {
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey)
    throw new Error(
      "Movie search needs TMDB_API_KEY. Add a free TMDB API key to your environment."
    )
  const url = new URL(
    `https://api.themoviedb.org/3/search/${type === "tv" ? "tv" : "movie"}`
  )
  url.searchParams.set("query", query)
  url.searchParams.set("include_adult", "false")
  url.searchParams.set("language", "en-US")
  url.searchParams.set("api_key", apiKey)
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!response.ok)
    throw new Error("TMDB could not complete that search. Check TMDB_API_KEY.")
  const body = (await response.json()) as {
    results?: Array<{
      id: number
      title?: string
      name?: string
      release_date?: string
      first_air_date?: string
      poster_path?: string | null
      genre_ids?: number[]
    }>
  }
  return (body.results ?? []).flatMap((movie) =>
    (movie.title ?? movie.name)
      ? [
          {
            id: String(movie.id),
            type,
            title: movie.title ?? movie.name!,
            creator:
              type === "tv" ? "Creator unavailable" : "Director unavailable",
            year:
              (movie.release_date ?? movie.first_air_date)
                ? Number(
                    (movie.release_date ?? movie.first_air_date)!.slice(0, 4)
                  )
                : null,
            coverImageUrl: movie.poster_path
              ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
              : "",
            genres: [],
          },
        ]
      : []
  )
}

export async function screenCoverOptions(
  type: "movie" | "tv",
  tmdbId: string
): Promise<string[]> {
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) throw new Error("Movie covers need TMDB_API_KEY.")
  const postersFor = async (includeImageLanguage?: string) => {
    const url = new URL(`https://api.themoviedb.org/3/${type}/${tmdbId}/images`)
    url.searchParams.set("api_key", apiKey)
    if (includeImageLanguage)
      url.searchParams.set("include_image_language", includeImageLanguage)
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw new Error("TMDB could not load poster options.")
    const body = (await response.json()) as {
      posters?: Array<{ file_path?: string }>
    }
    return body.posters ?? []
  }
  let posters = await postersFor("en,null")
  if (!posters.length) posters = await postersFor()
  return [
    ...new Set(
      posters.flatMap((poster) =>
        poster.file_path
          ? [`https://image.tmdb.org/t/p/w500${poster.file_path}`]
          : []
      )
    ),
  ].slice(0, 18)
}

export async function getScreenResultById(
  type: "movie" | "tv",
  id: string
): Promise<LookupResult & { slug: string }> {
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey)
    throw new Error(
      "TMDB lookup needs TMDB_API_KEY. Add a free TMDB API key to your environment."
    )
  const url = new URL(`https://api.themoviedb.org/3/${type}/${id}`)
  url.searchParams.set(
    "append_to_response",
    type === "tv"
      ? "aggregate_credits,keywords,content_ratings"
      : "credits,keywords,release_dates"
  )
  url.searchParams.set("api_key", apiKey)
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (response.status === 404)
    throw new Error(`Provider 404: TMDB ${type} ${id} was not found.`)
  if (!response.ok) throw new Error(`TMDB could not load ${type} ${id}.`)
  const result = (await response.json()) as {
    title?: string
    name?: string
    release_date?: string
    first_air_date?: string
    poster_path?: string | null
    backdrop_path?: string | null
    overview?: string
    runtime?: number
    episode_run_time?: number[]
    genres?: Array<{ name?: string }>
    keywords?: {
      keywords?: Array<{ name?: string }>
      results?: Array<{ name?: string }>
    }
    belongs_to_collection?: {
      id?: number
      name?: string
      overview?: string
    } | null
    created_by?: Array<{ id?: number; name?: string }>
    credits?: {
      cast?: Array<{ id?: number; name?: string; order?: number }>
      crew?: Array<{ id?: number; job?: string; name?: string }>
    }
    aggregate_credits?: {
      cast?: Array<{
        id?: number
        name?: string
        order?: number
        roles?: Array<{ character?: string }>
      }>
    }
    release_dates?: {
      results?: Array<{
        iso_3166_1?: string
        release_dates?: Array<{ certification?: string; type?: number }>
      }>
    }
    content_ratings?: {
      results?: Array<{ iso_3166_1?: string; rating?: string }>
    }
  }
  const title =
    type === "tv" ? (result.name ?? "Untitled") : (result.title ?? "Untitled")
  const creatorPerson =
    type === "tv"
      ? (result.created_by?.[0] ??
        result.credits?.crew?.find(
          (person) => person.job === "Creator" || person.job === "Director"
        ))
      : result.credits?.crew?.find((person) => person.job === "Director")
  const creator =
    creatorPerson?.name ??
    (type === "tv" ? "Creator unavailable" : "Director unavailable")
  return {
    id,
    type,
    title,
    creator,
    creatorPeople: creatorPerson?.name
      ? [
          {
            name: creatorPerson.name,
            providerId:
              typeof creatorPerson.id === "number"
                ? String(creatorPerson.id)
                : undefined,
          },
        ]
      : [],
    year: yearFromDate(
      type === "tv" ? result.first_air_date : result.release_date
    ),
    coverImageUrl: result.poster_path
      ? `https://image.tmdb.org/t/p/w500${result.poster_path}`
      : "",
    backdropImageUrl: result.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${result.backdrop_path}`
      : undefined,
    genres:
      result.genres?.flatMap((genre) => (genre.name ? [genre.name] : [])) ?? [],
    description: result.overview ?? "",
    keywords:
      (type === "tv"
        ? result.keywords?.results
        : result.keywords?.keywords
      )?.flatMap((keyword) => (keyword.name ? [keyword.name] : [])) ?? [],
    ...(tmdbCast(type, result) !== undefined
      ? { cast: tmdbCast(type, result) }
      : {}),
    ...(tmdbCastPeople(type, result) !== undefined
      ? { castPeople: tmdbCastPeople(type, result) }
      : {}),
    ...(type === "movie"
      ? { collection: tmdbCollection(result.belongs_to_collection) }
      : {}),
    ...tmdbScreenMetadata(type, result),
    slug: slugify(title),
  }
}

export async function getTmdbSyncMetadata(
  type: "movie" | "tv",
  tmdbId: string
): Promise<SyncedFields> {
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) throw new Error("TMDB sync needs TMDB_API_KEY.")
  const url = new URL(`https://api.themoviedb.org/3/${type}/${tmdbId}`)
  url.searchParams.set(
    "append_to_response",
    type === "tv"
      ? `aggregate_credits,keywords,content_ratings,${TMDB_EXTRAS_APPEND}`
      : `credits,keywords,release_dates,${TMDB_EXTRAS_APPEND}`
  )
  url.searchParams.set("include_image_language", "en,null")
  url.searchParams.set("api_key", apiKey)
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (response.status === 404)
    throw new Error(`Provider 404: TMDB ${type} ${tmdbId} was not found.`)
  if (!response.ok) throw new Error(`TMDB could not load ${type} ${tmdbId}.`)
  const result = (await response.json()) as TmdbExtrasSource & {
    title?: string
    name?: string
    release_date?: string
    first_air_date?: string
    backdrop_path?: string | null
    overview?: string
    runtime?: number
    episode_run_time?: number[]
    genres?: Array<{ name?: string }>
    keywords?: {
      keywords?: Array<{ name?: string }>
      results?: Array<{ name?: string }>
    }
    belongs_to_collection?: {
      id?: number
      name?: string
      overview?: string
    } | null
    created_by?: Array<{ id?: number; name?: string }>
    credits?: {
      cast?: Array<{ id?: number; name?: string; order?: number }>
      crew?: Array<{ id?: number; job?: string; name?: string }>
    }
    aggregate_credits?: {
      cast?: Array<{
        id?: number
        name?: string
        order?: number
        roles?: Array<{ character?: string }>
      }>
    }
    release_dates?: {
      results?: Array<{
        iso_3166_1?: string
        release_dates?: Array<{ certification?: string; type?: number }>
      }>
    }
    content_ratings?: {
      results?: Array<{ iso_3166_1?: string; rating?: string }>
    }
  }
  const creatorPerson =
    type === "tv"
      ? (result.created_by?.[0] ??
        result.credits?.crew?.find(
          (person) => person.job === "Creator" || person.job === "Director"
        ))
      : result.credits?.crew?.find((person) => person.job === "Director")
  const creator = creatorPerson?.name
  const screenMetadata = tmdbScreenMetadata(type, result)
  return {
    ...(type === "tv"
      ? result.name
        ? { title: result.name }
        : {}
      : result.title
        ? { title: result.title }
        : {}),
    ...(creator ? { creator } : {}),
    ...(creatorPerson?.name
      ? {
          creatorPeople: [
            {
              name: creatorPerson.name,
              providerId:
                typeof creatorPerson.id === "number"
                  ? String(creatorPerson.id)
                  : undefined,
            },
          ],
        }
      : {}),
    ...(yearFromDate(
      type === "tv" ? result.first_air_date : result.release_date
    ) !== null
      ? {
          year: yearFromDate(
            type === "tv" ? result.first_air_date : result.release_date
          )!,
        }
      : {}),
    genres:
      result.genres?.flatMap((genre) => (genre.name ? [genre.name] : [])) ?? [],
    description: result.overview ?? "",
    keywords:
      (type === "tv"
        ? result.keywords?.results
        : result.keywords?.keywords
      )?.flatMap((keyword) => (keyword.name ? [keyword.name] : [])) ?? [],
    ...(tmdbCast(type, result) !== undefined
      ? { cast: tmdbCast(type, result) }
      : {}),
    ...(tmdbCastPeople(type, result) !== undefined
      ? { castPeople: tmdbCastPeople(type, result) }
      : {}),
    ...(type === "movie"
      ? { collection: tmdbCollection(result.belongs_to_collection) ?? null }
      : {}),
    certification: screenMetadata.certification ?? null,
    runtime: screenMetadata.runtime ?? null,
    backdropImageUrl: result.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${result.backdrop_path}`
      : null,
    ...tmdbExtrasFrom(result),
  }
}

function tmdbCollection(
  collection?: { id?: number; name?: string; overview?: string } | null
): CollectionInput | undefined {
  if (typeof collection?.id !== "number" || !collection.name) return undefined
  return {
    tmdbCollectionId: String(collection.id),
    name: collection.name,
    overview: collection.overview,
  }
}

function tmdbCast(
  type: "movie" | "tv",
  result: {
    credits?: { cast?: Array<{ id?: number; name?: string; order?: number }> }
    aggregate_credits?: {
      cast?: Array<{
        id?: number
        name?: string
        order?: number
        roles?: Array<{ character?: string }>
      }>
    }
  }
): string[] | undefined {
  return tmdbCastPeople(type, result)?.map((person) => person.name)
}

function tmdbCastPeople(
  type: "movie" | "tv",
  result: {
    credits?: { cast?: Array<{ id?: number; name?: string; order?: number }> }
    aggregate_credits?: {
      cast?: Array<{
        id?: number
        name?: string
        order?: number
        roles?: Array<{ character?: string }>
      }>
    }
  }
): ProviderPerson[] | undefined {
  const cast =
    type === "movie" ? result.credits?.cast : result.aggregate_credits?.cast
  if (!cast) return undefined
  return cast
    .flatMap((person, index) => {
      const name = person.name?.trim()
      if (!name) return []
      return [
        {
          name,
          ...(typeof person.id === "number"
            ? { providerId: String(person.id) }
            : {}),
          order: person.order ?? index,
        },
      ]
    })
    .sort((a, b) => a.order - b.order)
    .map(({ name, providerId }) => ({ name, providerId }))
}

function tmdbScreenMetadata(
  type: "movie" | "tv",
  result: {
    runtime?: number
    episode_run_time?: number[]
    release_dates?: {
      results?: Array<{
        iso_3166_1?: string
        release_dates?: Array<{ certification?: string; type?: number }>
      }>
    }
    content_ratings?: {
      results?: Array<{ iso_3166_1?: string; rating?: string }>
    }
  }
): { certification?: string; runtime?: number } {
  const certification =
    type === "movie"
      ? tmdbMovieUsCertification(result.release_dates)
      : tmdbTvUsCertification(result.content_ratings)
  const runtime =
    type === "movie"
      ? validRuntime(result.runtime)
      : result.episode_run_time?.map(validRuntime).find(Boolean)

  return {
    certification,
    runtime,
  }
}

function tmdbMovieUsCertification(releaseDates?: {
  results?: Array<{
    iso_3166_1?: string
    release_dates?: Array<{ certification?: string; type?: number }>
  }>
}): string | undefined {
  const releases = releaseDates?.results?.find(
    (country) => country.iso_3166_1 === "US"
  )?.release_dates
  const theatrical = releases?.find(
    (release) => release.type === 3 && release.certification?.trim()
  )
  return (
    theatrical?.certification?.trim() ??
    releases
      ?.find((release) => release.certification?.trim())
      ?.certification?.trim()
  )
}

function tmdbTvUsCertification(contentRatings?: {
  results?: Array<{ iso_3166_1?: string; rating?: string }>
}): string | undefined {
  return contentRatings?.results
    ?.find((country) => country.iso_3166_1 === "US")
    ?.rating?.trim()
}

function validRuntime(value: number | undefined) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined
}
