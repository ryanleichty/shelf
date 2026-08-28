import { useEffect, useState } from "react"
import { Link, useRouter } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  getCollectionResult,
  saveItem,
  searchCollection,
  type ItemInput,
  type LookupResult,
} from "@/server/items"
import type { Item } from "@/server/schema"

export function ItemForm({ item, initialType }: { item?: Item; initialType?: "book" | "movie" }) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [type, setType] = useState<"book" | "movie">(item?.type ?? initialType ?? "book")
  const [status, setStatus] = useState<"owned" | "borrowed" | "reading">(item?.status ?? "owned")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<LookupResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState("")
  const [selected, setSelected] = useState(false)
  const [slugWasAutoFilled, setSlugWasAutoFilled] = useState(false)
  const [values, setValues] = useState({
    title: item?.title ?? "", creator: item?.creator ?? "", slug: item?.slug ?? "",
    year: item?.year ? String(item.year) : "", coverImageUrl: item?.coverImageUrl ?? "",
    openLibraryKey: item?.openLibraryKey ?? "", tmdbId: item?.tmdbId ?? "",
    borrower: item?.borrower ?? "", loanedAt: item?.loanedAt ?? "", format: item?.format ?? "",
  })

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
        setSearchError(cause instanceof Error ? cause.message : "Search is unavailable.")
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query, type])

  function updateValue(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    if (field === "slug") setSlugWasAutoFilled(false)
  }
  function changeType(nextType: "book" | "movie") {
    setType(nextType)
    setQuery("")
    setResults([])
    setSearchError("")
    setSelected(false)
    updateValue("format", "")
    if (nextType === "movie" && status === "reading") setStatus("owned")
  }

  async function choose(result: LookupResult) {
    setSearchError("")
    try {
      const resolved = result.type === "movie"
        ? await getCollectionResult({ data: { id: result.id, type: "movie" } })
        : { ...result, slug: toSlug(result.title) }
      setValues((current) => ({
        ...current,
        title: resolved.title,
        creator: resolved.creator,
        year: resolved.year ? String(resolved.year) : "",
        coverImageUrl: resolved.coverImageUrl,
        slug: !current.slug || slugWasAutoFilled ? resolved.slug : current.slug,
        openLibraryKey: result.type === "book" ? result.id : "",
        tmdbId: result.type === "movie" ? result.id : "",
      }))
      if (!values.slug || slugWasAutoFilled) setSlugWasAutoFilled(true)
      setSelected(true)
      setResults([])
      setQuery("")
    } catch (cause) {
      setSearchError(cause instanceof Error ? cause.message : "Could not load that item.")
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
          title: values.title, slug: values.slug, type, status, creator: values.creator,
          year: Number(values.year), coverImageUrl: values.coverImageUrl,
          openLibraryKey: values.openLibraryKey, tmdbId: values.tmdbId,
          borrower: values.borrower, loanedAt: values.loanedAt,
          format: values.format as ItemInput["format"],
        } satisfies ItemInput,
      })
      await router.navigate({ to: "/item/$slug", params: { slug: result.slug } })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this item.")
    } finally {
      setSaving(false)
    }
  }
  return (
    <form className="item-form" onSubmit={submit}>
      <Tabs onValueChange={(value) => changeType(value as "book" | "movie")} value={type}>
        <TabsList aria-label="Item type"><TabsTrigger value="book">Book</TabsTrigger><TabsTrigger value="movie">Movie</TabsTrigger></TabsList>
      </Tabs>
      <section className="collection-search">
        <div className="lookup-heading"><span>Find a {type}</span><small>Search fills the form; review before saving.</small></div>
        <Input onChange={(event) => { setQuery(event.target.value); setSelected(false) }} placeholder={type === "book" ? "Search Open Library" : "Search TMDB"} value={query} />
        {searching && <p className="lookup-status">Looking through the stacks…</p>}
        {searchError && <p className="form-error" role="alert">{searchError}</p>}
        {results.length > 0 && <div className="lookup-results" role="listbox">
          {results.map((result) => <button key={result.id} onClick={() => choose(result)} role="option" type="button">
            {result.coverImageUrl ? <img alt="" src={result.coverImageUrl} /> : <span className="tiny-cover" />}
            <span><strong>{result.title}</strong><small>{result.creator} {result.year ? `· ${result.year}` : ""}</small></span>
          </button>)}
        </div>}
        {selected && <p className="lookup-status">Details added below. Make them yours.</p>}
      </section>
      <div className="form-grid">
        <Field label="Title" name="title" onChange={(event) => updateValue("title", event.target.value)} required value={values.title} />
        <Field label={type === "movie" ? "Director" : "Author / creator"} name="creator" onChange={(event) => updateValue("creator", event.target.value)} required value={values.creator} />
        <Field hint="Lowercase words separated by hyphens." label="Slug" name="slug" onChange={(event) => updateValue("slug", event.target.value)} required value={values.slug} />
        <label className="field"><span>Status</span><select name="status" onChange={(event) => { const nextStatus = event.target.value as "owned" | "borrowed" | "reading"; setStatus(nextStatus); if (nextStatus !== "borrowed") setValues((current) => ({ ...current, borrower: "", loanedAt: "" })) }} value={status}><option value="owned">Owned</option>{type === "book" && <option value="reading">Reading</option>}<option value="borrowed">Borrowed</option></select></label>
        <Field label="Year" min="0" name="year" onChange={(event) => updateValue("year", event.target.value)} required type="number" value={values.year} />
        <label className="field"><span>Format</span><select name="format" onChange={(event) => updateValue("format", event.target.value)} value={values.format}><option value="">Unspecified</option>{type === "book" ? <><option value="hardcover">Hardcover</option><option value="paperback">Paperback</option></> : <><option value="blu-ray">Blu-ray</option><option value="dvd">DVD</option></>}<option value="other">Other</option></select></label>
        <Field label="Cover image URL" name="coverImageUrl" onChange={(event) => updateValue("coverImageUrl", event.target.value)} type="url" value={values.coverImageUrl} />
        {type === "book" ? <Field hint="Stored for future refreshes." label="Open Library work key" name="openLibraryKey" onChange={(event) => updateValue("openLibraryKey", event.target.value)} value={values.openLibraryKey} /> : <Field hint="Stored for future refreshes." label="TMDB ID" name="tmdbId" onChange={(event) => updateValue("tmdbId", event.target.value)} value={values.tmdbId} />}
        {status === "borrowed" && <><Field label="With whom" name="borrower" onChange={(event) => updateValue("borrower", event.target.value)} required value={values.borrower} /><Field label="Loaned out" name="loanedAt" onChange={(event) => updateValue("loanedAt", event.target.value)} type="date" value={values.loanedAt} /></>}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-footer"><Link className="cancel-link" to="/admin">Cancel</Link><Button disabled={saving} type="submit">{saving ? "Saving…" : item ? "Save changes" : "Add to shelf"}</Button></div>
    </form>
  )
}

function toSlug(title: string) {
  return title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function Field({ hint, label, ...props }: React.ComponentProps<typeof Input> & { label: string; hint?: string }) {
  return <label className="field"><span>{label}</span><Input {...props} />{hint && <small>{hint}</small>}</label>
}
