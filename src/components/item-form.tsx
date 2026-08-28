import { useEffect, useState } from "react"
import { Link, useRouter } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  getCollectionResult,
  saveItem,
  searchCollection,
  type ItemInput,
  type LookupResult,
} from "@/server/items"
import type { Item } from "@/server/schema"

export function ItemForm({ item }: { item?: Item }) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [type, setType] = useState<"book" | "movie">(item?.type ?? "book")
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
    notes: item?.notes ?? "", acquiredAt: item?.acquiredAt ?? "",
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
          notes: values.notes, acquiredAt: values.acquiredAt,
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
        <label className="field"><span>Type</span><select name="type" onChange={(event) => { const nextType = event.target.value as "book" | "movie"; setType(nextType); if (nextType === "movie" && status === "reading") setStatus("owned") }} value={type}><option value="book">Book</option><option value="movie">Movie</option></select></label>
        <label className="field"><span>Status</span><select name="status" onChange={(event) => setStatus(event.target.value as "owned" | "borrowed" | "reading")} value={status}><option value="owned">Owned</option>{type === "book" && <option value="reading">Reading</option>}<option value="borrowed">Borrowed</option></select></label>
        <Field label="Year" min="0" name="year" onChange={(event) => updateValue("year", event.target.value)} required type="number" value={values.year} />
        <Field label="Cover image URL" name="coverImageUrl" onChange={(event) => updateValue("coverImageUrl", event.target.value)} type="url" value={values.coverImageUrl} />
        <Field label="Acquired date" name="acquiredAt" onChange={(event) => updateValue("acquiredAt", event.target.value)} type="date" value={values.acquiredAt} />
      </div>
      <label className="field"><span>Notes</span><Textarea name="notes" onChange={(event) => updateValue("notes", event.target.value)} placeholder="A thought, a memory, a reason to keep it." rows={6} value={values.notes} /></label>
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
