import { useEffect, useState } from "react"
import { Link, useRouter } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  Combobox,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
} from "@/components/ui/combobox"
import {
  getCollectionResult,
  getCoverOptions,
  saveItem,
  searchCollection,
  bookGenreOptions,
  screenGenreOptions,
  type ItemInput,
  type LookupResult,
} from "@/server/items"
import type { Item } from "@/server/schema"

export function ItemForm({
  item,
  initialType,
}: {
  item?: Item
  initialType?: "book" | "movie" | "tv"
}) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [type, setType] = useState<"book" | "movie" | "tv">(
    item?.type ?? initialType ?? "book"
  )
  const [status, setStatus] = useState<
    "" | "borrowed" | "reading" | "watching"
  >(
    item?.status === "reading" ||
      item?.status === "borrowed" ||
      item?.status === "watching"
      ? item.status
      : ""
  )
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<LookupResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState("")
  const [selected, setSelected] = useState(false)
  const [coverOptions, setCoverOptions] = useState<string[]>([])
  const [coverError, setCoverError] = useState("")
  const [coversLoading, setCoversLoading] = useState(
    Boolean(item?.openLibraryKey || item?.tmdbId)
  )
  const [slugWasAutoFilled, setSlugWasAutoFilled] = useState(false)
  const [values, setValues] = useState({
    title: item?.title ?? "",
    creator: item?.creator ?? "",
    slug: item?.slug ?? "",
    year: item?.year ? String(item.year) : "",
    coverImageUrl: item?.coverImageUrl ?? "",
    openLibraryKey: item?.openLibraryKey ?? "",
    tmdbId: item?.tmdbId ?? "",
    borrower: item?.borrower ?? "",
    loanedAt: item?.loanedAt ?? "",
    format: item?.format ?? "",
    edition: item?.edition ?? "",
    genres: item?.genres ?? [],
    description: item?.description ?? "",
  })
  const genreOptions = type === "book" ? bookGenreOptions : screenGenreOptions

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      setSearchError("")
      return
    }
    const timer = window.setTimeout(async () => {
      setSearching(true)
      setSearchError("")
      try {
        setResults(await searchCollection({ data: { query, type } }))
      } catch (cause) {
        setResults([])
        setSearchError(
          cause instanceof Error ? cause.message : "Search is unavailable."
        )
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query, type])

  useEffect(() => {
    const providerId = type === "book" ? values.openLibraryKey : values.tmdbId
    if (!providerId) {
      setCoverOptions([])
      setCoverError("")
      setCoversLoading(false)
      return
    }
    let cancelled = false
    setCoversLoading(true)
    setCoverError("")
    getCoverOptions({
      data: {
        type,
        openLibraryKey: values.openLibraryKey,
        tmdbId: values.tmdbId,
      },
    })
      .then((options) => {
        if (!cancelled) setCoverOptions(options)
      })
      .catch((cause) => {
        if (cancelled) return
        setCoverOptions([])
        setCoverError(
          cause instanceof Error
            ? cause.message
            : "Could not load cover options."
        )
      })
      .finally(() => {
        if (!cancelled) setCoversLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [type, values.openLibraryKey, values.tmdbId])

  function updateValue(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    if (field === "slug") setSlugWasAutoFilled(false)
  }
  function changeType(nextType: "book" | "movie" | "tv") {
    setType(nextType)
    setQuery("")
    setResults([])
    setSearchError("")
    setSelected(false)
    setCoversLoading(false)
    updateValue("format", "")
    updateValue("edition", "")
    if ((nextType === "movie" || nextType === "tv") && status === "reading")
      setStatus("")
  }

  async function choose(result: LookupResult) {
    setSearchError("")
    try {
      const resolved = await getCollectionResult({
        data: { id: result.id, type: result.type },
      })
      setValues((current) => ({
        ...current,
        title: resolved.title,
        creator:
          resolved.creator === "Unknown author"
            ? result.creator
            : resolved.creator,
        year: resolved.year ? String(resolved.year) : "",
        coverImageUrl:
          current.coverImageUrl ||
          resolved.coverImageUrl ||
          result.coverImageUrl,
        slug: !current.slug || slugWasAutoFilled ? resolved.slug : current.slug,
        genres: resolved.genres,
        description: resolved.description ?? "",
        openLibraryKey: result.type === "book" ? result.id : "",
        tmdbId: result.type === "book" ? "" : result.id,
      }))
      setCoversLoading(true)
      if (!values.slug || slugWasAutoFilled) setSlugWasAutoFilled(true)
      setSelected(true)
      setResults([])
      setQuery("")
    } catch (cause) {
      setSearchError(
        cause instanceof Error ? cause.message : "Could not load that item."
      )
    }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError("")
    try {
      const result = await saveItem({
        data: {
          id: item?.id,
          title: values.title,
          slug: values.slug,
          type,
          status: status || "owned",
          creator: values.creator,
          year: Number(values.year),
          coverImageUrl: values.coverImageUrl,
          openLibraryKey: values.openLibraryKey,
          tmdbId: values.tmdbId,
          borrower: values.borrower,
          loanedAt: values.loanedAt,
          format: values.format as ItemInput["format"],
          edition: values.edition as ItemInput["edition"],
          genres: values.genres,
          description: values.description,
        } satisfies ItemInput,
      })
      await router.navigate({
        to: "/item/$slug",
        params: { slug: result.slug },
      })
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save this item."
      )
    } finally {
      setSaving(false)
    }
  }
  return (
    <form className="item-form" onSubmit={submit}>
      <Tabs
        onValueChange={(value) => changeType(value as "book" | "movie")}
        value={type}
      >
        <TabsList aria-label="Item type">
          <TabsTrigger value="book">Book</TabsTrigger>
          <TabsTrigger value="movie">Movie</TabsTrigger>
          <TabsTrigger value="tv">TV</TabsTrigger>
        </TabsList>
      </Tabs>
      <section className="collection-search">
        <div className="lookup-heading">
          <span>Find a {type}</span>
          <small>Search fills the form; review before saving.</small>
        </div>
        <Input
          onChange={(event) => {
            setQuery(event.target.value)
            setSelected(false)
          }}
          placeholder={type === "book" ? "Search Open Library" : "Search TMDB"}
          value={query}
        />
        {searching && (
          <p className="lookup-status">Looking through the stacks…</p>
        )}
        {searchError && (
          <p className="form-error" role="alert">
            {searchError}
          </p>
        )}
        {results.length > 0 && (
          <div className="lookup-results" role="listbox">
            {results.map((result) => (
              <button
                key={result.id}
                onClick={() => choose(result)}
                role="option"
                type="button"
              >
                {result.coverImageUrl ? (
                  <img alt="" src={result.coverImageUrl} />
                ) : (
                  <span className="tiny-cover" />
                )}
                <span>
                  <strong>{result.title}</strong>
                  <small>
                    {result.creator} {result.year ? `· ${result.year}` : ""}
                  </small>
                </span>
              </button>
            ))}
          </div>
        )}
        {selected && (
          <p className="lookup-status">Details added below. Make them yours.</p>
        )}
      </section>
      <FieldGroup className="form-grid">
        <Field>
          <FieldLabel htmlFor="title">Title</FieldLabel>
          <Input
            id="title"
            name="title"
            onChange={(event) => updateValue("title", event.target.value)}
            required
            value={values.title}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="creator">
            {type === "movie" ? "Director" : "Author / creator"}
          </FieldLabel>
          <Input
            id="creator"
            name="creator"
            onChange={(event) => updateValue("creator", event.target.value)}
            required
            value={values.creator}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="slug">Slug</FieldLabel>
          <Input
            id="slug"
            name="slug"
            onChange={(event) => updateValue("slug", event.target.value)}
            required
            value={values.slug}
          />
          <FieldDescription>
            Lowercase words separated by hyphens.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="status">Status</FieldLabel>
          <Select
            onValueChange={(value) => {
              const nextStatus = (value ?? "") as
                "" | "borrowed" | "reading" | "watching"
              setStatus(nextStatus)
              if (nextStatus !== "borrowed")
                setValues((current) => ({
                  ...current,
                  borrower: "",
                  loanedAt: "",
                }))
            }}
            value={status}
          >
            <SelectTrigger id="status" name="status">
              <SelectValue placeholder="Unspecified" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Unspecified</SelectItem>
              {type === "book" && (
                <SelectItem value="reading">Reading</SelectItem>
              )}
              {type === "tv" && (
                <SelectItem value="watching">Watching</SelectItem>
              )}
              <SelectItem value="borrowed">Borrowed</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="year">Year</FieldLabel>
          <Input
            id="year"
            min="0"
            name="year"
            onChange={(event) => updateValue("year", event.target.value)}
            required
            type="number"
            value={values.year}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="format">Format</FieldLabel>
          <Select
            onValueChange={(value) => updateValue("format", value ?? "")}
            value={values.format}
          >
            <SelectTrigger id="format" name="format">
              <SelectValue placeholder="Unspecified" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Unspecified</SelectItem>
              {type === "book" ? (
                <>
                  <SelectItem value="hardcover">Hardcover</SelectItem>
                  <SelectItem value="paperback">Paperback</SelectItem>
                </>
              ) : (
                <>
                  <SelectItem value="blu-ray">Blu-ray</SelectItem>
                  <SelectItem value="dvd">DVD</SelectItem>
                </>
              )}
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {type !== "book" && (
          <Field>
            <FieldLabel htmlFor="edition">Edition</FieldLabel>
            <Select
              onValueChange={(value) => updateValue("edition", value ?? "")}
              value={values.edition}
            >
              <SelectTrigger id="edition" name="edition">
                <SelectValue placeholder="Unspecified" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Unspecified</SelectItem>
                <SelectItem value="theatrical">Theatrical</SelectItem>
                <SelectItem value="extended">Extended</SelectItem>
                <SelectItem value="director-cut">
                  Director&apos;s Cut
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="genres">Genres</FieldLabel>
          <Combobox
            items={genreOptions}
            multiple
            onValueChange={(genres) =>
              setValues((current) => ({ ...current, genres }))
            }
            value={values.genres}
          >
            <ComboboxChips>
              <ComboboxValue>
                {values.genres.map((genre) => (
                  <ComboboxChip key={genre}>{genre}</ComboboxChip>
                ))}
              </ComboboxValue>
              <ComboboxChipsInput id="genres" placeholder="Select genres…" />
            </ComboboxChips>
            <ComboboxContent>
              <ComboboxEmpty>No genres found.</ComboboxEmpty>
              <ComboboxList>
                {(genre) => (
                  <ComboboxItem key={genre} value={genre}>
                    {genre}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="description">Description</FieldLabel>
          <Textarea
            id="description"
            name="description"
            onChange={(event) => updateValue("description", event.target.value)}
            placeholder="A short overview of this title…"
            rows={5}
            value={values.description}
          />
          <FieldDescription>
            Provider syncs may refresh this overview.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="coverImageUrl">Cover image URL</FieldLabel>
          <Input
            disabled={
              coversLoading &&
              Boolean(type === "book" ? values.openLibraryKey : values.tmdbId)
            }
            id="coverImageUrl"
            name="coverImageUrl"
            onChange={(event) =>
              updateValue("coverImageUrl", event.target.value)
            }
            type="url"
            value={values.coverImageUrl}
          />
        </Field>
        {(type === "book" ? values.openLibraryKey : values.tmdbId) && (
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-medium">Choose a cover</p>
            {coversLoading ? (
              <div className="grid grid-cols-6 gap-2 sm:grid-cols-9">
                {Array.from({ length: 9 }, (_, index) => (
                  <Skeleton
                    className="aspect-[2/3] w-full rounded-md"
                    key={index}
                  />
                ))}
              </div>
            ) : coverOptions.length > 0 ? (
              <div className="grid grid-cols-6 gap-2 sm:grid-cols-9">
                {coverOptions.map((url) => (
                  <button
                    aria-label="Use this cover"
                    className={`aspect-[2/3] overflow-hidden rounded-md border ${values.coverImageUrl === url ? "ring-2 ring-ring ring-offset-2" : "hover:border-foreground/40"}`}
                    key={url}
                    onClick={() => updateValue("coverImageUrl", url)}
                    type="button"
                  >
                    <img
                      alt=""
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                      src={url}
                    />
                  </button>
                ))}
              </div>
            ) : null}
            {coverError && (
              <p className="mt-2 text-sm text-destructive">{coverError}</p>
            )}
          </div>
        )}
        {type === "book" ? (
          <Field>
            <FieldLabel htmlFor="openLibraryKey">
              Open Library work key
            </FieldLabel>
            <Input
              id="openLibraryKey"
              name="openLibraryKey"
              onChange={(event) =>
                updateValue("openLibraryKey", event.target.value)
              }
              value={values.openLibraryKey}
            />
            <FieldDescription>Stored for future refreshes.</FieldDescription>
          </Field>
        ) : (
          <Field>
            <FieldLabel htmlFor="tmdbId">TMDB ID</FieldLabel>
            <Input
              id="tmdbId"
              name="tmdbId"
              onChange={(event) => updateValue("tmdbId", event.target.value)}
              value={values.tmdbId}
            />
            <FieldDescription>Stored for future refreshes.</FieldDescription>
          </Field>
        )}
        {status === "borrowed" && (
          <>
            <Field>
              <FieldLabel htmlFor="borrower">With whom</FieldLabel>
              <Input
                id="borrower"
                name="borrower"
                onChange={(event) =>
                  updateValue("borrower", event.target.value)
                }
                required
                value={values.borrower}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="loanedAt">Loaned out</FieldLabel>
              <Input
                id="loanedAt"
                name="loanedAt"
                onChange={(event) =>
                  updateValue("loanedAt", event.target.value)
                }
                type="date"
                value={values.loanedAt}
              />
            </Field>
          </>
        )}
      </FieldGroup>
      {error && <FieldError>{error}</FieldError>}
      <div className="form-footer">
        <Button render={<Link to="/admin" />} variant="outline">
          Cancel
        </Button>
        <Button disabled={saving} type="submit">
          {saving ? "Saving…" : item ? "Save changes" : "Add to shelf"}
        </Button>
      </div>
    </form>
  )
}
