import { Link } from "@tanstack/react-router"
import { CoverTile } from "@/components/cover-tile"
import type { Item } from "@/server/schema"

type BrowseType = Item["type"]
type BrowseMode = "year" | "decade"

export function YearBrowse({
  type,
  mode,
  value,
  years,
  items,
}: {
  type: BrowseType
  mode: BrowseMode
  value: number
  years: number[]
  items: Item[]
}) {
  const decades = [
    ...new Set(
      years
        .filter((year) => year >= 1000 && year <= 9999)
        .map((year) => decadeFor(year))
    ),
  ].sort((left, right) => right - left)
  const activeDecade = mode === "decade" ? value : decadeFor(value)
  const yearsInActiveDecade = years
    .filter((year) => decadeFor(year) === activeDecade)
    .sort((left, right) => right - left)
  const activeDecadeIndex = decades.indexOf(activeDecade)
  const newerDecade = decades[activeDecadeIndex - 1]
  const olderDecade = decades[activeDecadeIndex + 1]

  return (
    <main className="container mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm text-muted-foreground">{labelFor(type)}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        {mode === "decade" ? `${value}s` : value}
      </h1>

      <nav aria-label={`${labelFor(type)} by year`} className="mt-6 space-y-3">
        <div className="flex flex-wrap gap-2">
          {decades.map((decade) => (
            <PeriodLink
              active={decade === activeDecade}
              decade={decade}
              key={decade}
              type={type}
            />
          ))}
        </div>
        {yearsInActiveDecade.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-l pl-3">
            {yearsInActiveDecade.map((year) => (
              <YearLink
                active={mode === "year" && year === value}
                key={year}
                type={type}
                year={year}
              />
            ))}
          </div>
        )}
        {(newerDecade || olderDecade) && (
          <div className="flex gap-3 text-sm">
            {newerDecade && (
              <PeriodLink decade={newerDecade} type={type} variant="text" />
            )}
            {olderDecade && (
              <PeriodLink decade={olderDecade} type={type} variant="text" />
            )}
          </div>
        )}
      </nav>

      {items.length ? (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <CoverTile item={item} key={item.id} />
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-lg border border-dashed p-12 text-center">
          <p className="font-medium">Nothing found.</p>
          <span className="mt-1 block text-sm text-muted-foreground">
            No {labelFor(type).toLowerCase()} from this {mode}.
          </span>
        </div>
      )}
    </main>
  )
}

function PeriodLink({
  type,
  decade,
  active = false,
  variant = "pill",
}: {
  type: BrowseType
  decade: number
  active?: boolean
  variant?: "pill" | "text"
}) {
  const className =
    variant === "text"
      ? "text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      : `rounded-md px-2.5 py-1 text-sm font-medium transition-colors ${
          active
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground"
        }`
  const label = variant === "text" ? `${decade}s` : `${decade}s`

  if (type === "movie")
    return (
      <Link className={className} params={{ decade: `${decade}s` }} to="/movies/decade/$decade">
        {label}
      </Link>
    )
  if (type === "tv")
    return (
      <Link className={className} params={{ decade: `${decade}s` }} to="/tv/decade/$decade">
        {label}
      </Link>
    )
  return (
    <Link className={className} params={{ decade: `${decade}s` }} to="/books/decade/$decade">
      {label}
    </Link>
  )
}

function YearLink({
  type,
  year,
  active,
}: {
  type: BrowseType
  year: number
  active: boolean
}) {
  const className = `rounded-md px-2.5 py-1 text-sm font-medium transition-colors ${
    active
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:bg-muted hover:text-foreground"
  }`

  if (type === "movie")
    return (
      <Link className={className} params={{ year: `${year}` }} to="/movies/year/$year">
        {year}
      </Link>
    )
  if (type === "tv")
    return (
      <Link className={className} params={{ year: `${year}` }} to="/tv/year/$year">
        {year}
      </Link>
    )
  return (
    <Link className={className} params={{ year: `${year}` }} to="/books/year/$year">
      {year}
    </Link>
  )
}

function decadeFor(year: number) {
  return Math.floor(year / 10) * 10
}

function labelFor(type: BrowseType) {
  return type === "movie" ? "Movies" : type === "tv" ? "TV" : "Books"
}
