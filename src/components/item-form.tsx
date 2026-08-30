import { useEffect, useState } from "react"
import { Link, useRouter } from "@tanstack/react-router"
import { ScanBarcodeIcon } from "lucide-react"
import { BarcodeScanner } from "@/components/barcode-scanner"
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
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Spinner } from "@/components/ui/spinner"
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
  getPersonOptions,
  resolveBarcode,
  saveItem,
  searchCollection,
  bookGenreOptions,
  screenGenreOptions,
  type ItemInput,
  type LookupResult,
  type PersonOptions,
} from "@/server/items"
import type { Item } from "@/server/schema"

function namesFromCreator(creator: string) {
  return creator
    .split(/,|\s+and\s+|\s+&\s+/i)
    .map((name) => name.trim())
    .filter(Boolean)
}

function peopleItems(options: string[], selected: string[], query: string) {
  const people = [...new Set([...options, ...selected])]
  const name = query.trim()
  return name &&
    !people.some(
      (person) =>
        person.localeCompare(name, undefined, { sensitivity: "accent" }) === 0
    )
    ? [...people, name]
    : people
}

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
    "unspecified" | "borrowed" | "reading" | "watching"
  >(
    item?.status === "reading" ||
      item?.status === "borrowed" ||
      item?.status === "watching"
      ? item.status
      : "unspecified"
  )
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<LookupResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState("")
  const [scanOpen, setScanOpen] = useState(false)
  const [barcodeCode, setBarcodeCode] = useState("")
  const [barcodeError, setBarcodeError] = useState("")
  const [barcodeResult, setBarcodeResult] = useState<Extract<
    Awaited<ReturnType<typeof resolveBarcode>>,
    { status: "owned" }
  > | null>(null)
  const [resolvingBarcode, setResolvingBarcode] = useState(false)
  const [scannerReset, setScannerReset] = useState(0)
  const [selected, setSelected] = useState(false)
  const [coverOptions, setCoverOptions] = useState<string[]>([])
  const [coverError, setCoverError] = useState("")
  const [coversLoading, setCoversLoading] = useState(
    Boolean(item?.openLibraryKey || item?.tmdbId)
  )
  const [slugWasAutoFilled, setSlugWasAutoFilled] = useState(false)
  const [authorQuery, setAuthorQuery] = useState("")
  const [directorQuery, setDirectorQuery] = useState("")
  const [castQuery, setCastQuery] = useState("")
  const [peopleOptions, setPeopleOptions] = useState<PersonOptions>({
    authors: [],
    directors: [],
    actors: [],
  })
  const [values, setValues] = useState({
    title: item?.title ?? "",
    authors: item?.authors.length
      ? item.authors
      : namesFromCreator(item?.creator ?? ""),
    directors: item?.directors.length
      ? item.directors
      : namesFromCreator(item?.creator ?? ""),
    actors: item?.actors ?? [],
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
    barcode: item?.barcode ?? "",
  })
  const genreOptions = type === "book" ? bookGenreOptions : screenGenreOptions

  useEffect(() => {
    let cancelled = false
    getPersonOptions()
      .then((options) => {
        if (!cancelled) setPeopleOptions(options)
      })
      .catch(() => {
        // Existing people are optional suggestions; new names can still be added.
      })
    return () => {
      cancelled = true
    }
  }, [])

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
      setStatus("unspecified")
  }

  async function choose(
    result: LookupResult,
    options?: { barcode?: string; format?: ItemInput["format"] }
  ) {
    setSearchError("")
    try {
      const resolved = await getCollectionResult({
        data: { id: result.id, type: result.type },
      })
      const creator =
        resolved.creator === "Unknown author"
          ? result.creator
          : resolved.creator
      setValues((current) => ({
        ...current,
        title: resolved.title,
        authors:
          resolved.type === "book"
            ? namesFromCreator(creator)
            : current.authors,
        directors:
          resolved.type === "book"
            ? current.directors
            : namesFromCreator(creator),
        actors:
          resolved.type === "book" ? current.actors : (resolved.cast ?? []),
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
        barcode: options?.barcode ?? current.barcode,
        format: options?.format || current.format,
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
  async function resolveScannedBarcode(code: string) {
    if (resolvingBarcode) return
    setBarcodeCode(code)
    setBarcodeError("")
    setBarcodeResult(null)
    setResolvingBarcode(true)
    try {
      const resolution = await resolveBarcode({ data: { code, type } })
      if (resolution.status === "owned") {
        setBarcodeResult(resolution)
        return
      }
      if (resolution.result.type !== type) changeType(resolution.result.type)
      await choose(resolution.result, {
        barcode: code,
        format: resolution.format,
      })
      setScanOpen(false)
    } catch (cause) {
      setBarcodeError(
        cause instanceof Error
          ? cause.message
          : "Could not look up that barcode. You can still complete the form manually."
      )
    } finally {
      setResolvingBarcode(false)
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
          status: status === "unspecified" ? "owned" : status,
          creator:
            type === "book"
              ? (values.authors[0] ?? "")
              : (values.directors[0] ?? ""),
          authors: values.authors,
          directors: values.directors,
          actors: values.actors,
          year: Number(values.year),
          coverImageUrl: values.coverImageUrl,
          openLibraryKey: values.openLibraryKey,
          tmdbId: values.tmdbId,
          barcode: values.barcode,
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
      <Dialog onOpenChange={setScanOpen} open={scanOpen}>
        <section className="collection-search">
          <Field>
            <FieldLabel htmlFor="collection-search">Find a {type}</FieldLabel>
            <FieldDescription>
              Search fills the form; review before saving.
            </FieldDescription>
            <InputGroup>
              <InputGroupInput
                id="collection-search"
                onChange={(event) => {
                  setQuery(event.target.value)
                  setSelected(false)
                }}
                placeholder={
                  type === "book" ? "Search Open Library" : "Search TMDB"
                }
                value={query}
              />
              <InputGroupAddon align="inline-end">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <DialogTrigger
                        aria-label="Scan barcode"
                        render={<InputGroupButton aria-label="Scan barcode" />}
                      />
                    }
                  >
                    <ScanBarcodeIcon />
                  </TooltipTrigger>
                  <TooltipContent>Scan barcode</TooltipContent>
                </Tooltip>
              </InputGroupAddon>
            </InputGroup>
          </Field>
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
            <p className="lookup-status">
              Details added below. Make them yours.
            </p>
          )}
        </section>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scan barcode</DialogTitle>
            <DialogDescription>
              Scan or type an EAN-13, UPC-A, ISBN-10, or ISBN-13 code.
            </DialogDescription>
          </DialogHeader>
          <BarcodeScanner
            active={scanOpen}
            stopSignal={scannerReset}
            onDetected={(code) => void resolveScannedBarcode(code)}
          />
          <form
            onSubmit={(event) => {
              event.preventDefault()
              setScannerReset((current) => current + 1)
              void resolveScannedBarcode(barcodeCode)
            }}
          >
            <Field data-invalid={Boolean(barcodeError)}>
              <FieldLabel htmlFor="barcode-code">
                Barcode, UPC, or ISBN
              </FieldLabel>
              <InputGroup>
                <InputGroupInput
                  aria-invalid={Boolean(barcodeError)}
                  autoComplete="off"
                  id="barcode-code"
                  inputMode="numeric"
                  onChange={(event) => setBarcodeCode(event.target.value)}
                  placeholder="Type or paste a code"
                  value={barcodeCode}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    disabled={resolvingBarcode || !barcodeCode.trim()}
                    type="submit"
                  >
                    {resolvingBarcode && <Spinner data-icon="inline-start" />}
                    Add details
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              {barcodeError && <FieldError>{barcodeError}</FieldError>}
            </Field>
          </form>
          {barcodeResult && (
            <Field>
              <FieldDescription>Already on Shelf</FieldDescription>
              <Link
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                params={{ slug: barcodeResult.item.slug }}
                to="/item/$slug"
              >
                {barcodeResult.item.title}
              </Link>
            </Field>
          )}
        </DialogContent>
      </Dialog>
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
        {type === "book" ? (
          <Field>
            <FieldLabel htmlFor="authors">Authors</FieldLabel>
            <Combobox
              inputValue={authorQuery}
              items={peopleItems(
                peopleOptions.authors,
                values.authors,
                authorQuery
              )}
              multiple
              onInputValueChange={setAuthorQuery}
              onValueChange={(authors) =>
                setValues((current) => ({ ...current, authors }))
              }
              value={values.authors}
            >
              <ComboboxChips>
                <ComboboxValue>
                  {values.authors.map((author) => (
                    <ComboboxChip key={author}>{author}</ComboboxChip>
                  ))}
                </ComboboxValue>
                <ComboboxChipsInput id="authors" placeholder="Add an author…" />
              </ComboboxChips>
              <ComboboxContent>
                <ComboboxEmpty>No authors found.</ComboboxEmpty>
                <ComboboxList>
                  {(author) => (
                    <ComboboxItem key={author} value={author}>
                      {author === authorQuery.trim() &&
                      !peopleOptions.authors.some(
                        (person) =>
                          person.localeCompare(author, undefined, {
                            sensitivity: "accent",
                          }) === 0
                      )
                        ? `Create "${author}"`
                        : author}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </Field>
        ) : (
          <>
            <Field>
              <FieldLabel htmlFor="directors">Directors</FieldLabel>
              <Combobox
                inputValue={directorQuery}
                items={peopleItems(
                  peopleOptions.directors,
                  values.directors,
                  directorQuery
                )}
                multiple
                onInputValueChange={setDirectorQuery}
                onValueChange={(directors) =>
                  setValues((current) => ({ ...current, directors }))
                }
                value={values.directors}
              >
                <ComboboxChips>
                  <ComboboxValue>
                    {values.directors.map((director) => (
                      <ComboboxChip key={director}>{director}</ComboboxChip>
                    ))}
                  </ComboboxValue>
                  <ComboboxChipsInput
                    id="directors"
                    placeholder="Add a director…"
                  />
                </ComboboxChips>
                <ComboboxContent>
                  <ComboboxEmpty>No directors found.</ComboboxEmpty>
                  <ComboboxList>
                    {(director) => (
                      <ComboboxItem key={director} value={director}>
                        {director === directorQuery.trim() &&
                        !peopleOptions.directors.some(
                          (person) =>
                            person.localeCompare(director, undefined, {
                              sensitivity: "accent",
                            }) === 0
                        )
                          ? `Create "${director}"`
                          : director}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </Field>
            <Field>
              <FieldLabel htmlFor="cast">Cast</FieldLabel>
              <Combobox
                inputValue={castQuery}
                items={peopleItems(
                  peopleOptions.actors,
                  values.actors,
                  castQuery
                )}
                multiple
                onInputValueChange={setCastQuery}
                onValueChange={(actors) =>
                  setValues((current) => ({ ...current, actors }))
                }
                value={values.actors}
              >
                <ComboboxChips>
                  <ComboboxValue>
                    {values.actors.map((actor) => (
                      <ComboboxChip key={actor}>{actor}</ComboboxChip>
                    ))}
                  </ComboboxValue>
                  <ComboboxChipsInput id="cast" placeholder="Add cast…" />
                </ComboboxChips>
                <ComboboxContent>
                  <ComboboxEmpty>No cast members found.</ComboboxEmpty>
                  <ComboboxList>
                    {(actor) => (
                      <ComboboxItem key={actor} value={actor}>
                        {actor === castQuery.trim() &&
                        !peopleOptions.actors.some(
                          (person) =>
                            person.localeCompare(actor, undefined, {
                              sensitivity: "accent",
                            }) === 0
                        )
                          ? `Create "${actor}"`
                          : actor}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </Field>
          </>
        )}
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
              const nextStatus = value ?? "unspecified"
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
              <SelectItem value="unspecified">Unspecified</SelectItem>
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
            onValueChange={(value) =>
              updateValue(
                "format",
                value === "unspecified" ? "" : (value ?? "")
              )
            }
            value={values.format || "unspecified"}
          >
            <SelectTrigger id="format" name="format">
              <SelectValue placeholder="Unspecified" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unspecified">Unspecified</SelectItem>
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
              onValueChange={(value) =>
                updateValue(
                  "edition",
                  value === "unspecified" ? "" : (value ?? "")
                )
              }
              value={values.edition || "unspecified"}
            >
              <SelectTrigger id="edition" name="edition">
                <SelectValue placeholder="Unspecified" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unspecified">Unspecified</SelectItem>
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
