import { useState } from "react"
import { Link, useRouter } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { saveItem, type ItemInput } from "@/server/items"
import type { Item } from "@/server/schema"

export function ItemForm({ item }: { item?: Item }) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError("")
    const form = new FormData(event.currentTarget)
    try {
      const result = await saveItem({
        data: {
          id: item?.id,
          title: String(form.get("title")),
          slug: String(form.get("slug")),
          type: form.get("type") as "book" | "movie",
          creator: String(form.get("creator")),
          year: Number(form.get("year")),
          coverImageUrl: String(form.get("coverImageUrl")),
          notes: String(form.get("notes")),
          acquiredAt: String(form.get("acquiredAt")),
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
      <div className="form-grid">
        <Field defaultValue={item?.title} label="Title" name="title" required />
        <Field defaultValue={item?.creator} label={item?.type === "movie" ? "Director" : "Author / creator"} name="creator" required />
        <Field defaultValue={item?.slug} hint="Lowercase words separated by hyphens." label="Slug" name="slug" required />
        <label className="field"><span>Type</span><select defaultValue={item?.type ?? "book"} name="type"><option value="book">Book</option><option value="movie">Movie</option></select></label>
        <Field defaultValue={item?.year} label="Year" min="0" name="year" required type="number" />
        <Field defaultValue={item?.coverImageUrl ?? ""} label="Cover image URL" name="coverImageUrl" type="url" />
        <Field defaultValue={item?.acquiredAt ?? ""} label="Acquired date" name="acquiredAt" type="date" />
      </div>
      <label className="field"><span>Notes</span><Textarea defaultValue={item?.notes} name="notes" placeholder="A thought, a memory, a reason to keep it." rows={6} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-footer"><Link className="cancel-link" to="/admin">Cancel</Link><Button disabled={saving} type="submit">{saving ? "Saving…" : item ? "Save changes" : "Add to shelf"}</Button></div>
    </form>
  )
}

function Field({ hint, label, ...props }: React.ComponentProps<typeof Input> & { label: string; hint?: string }) {
  return <label className="field"><span>{label}</span><Input {...props} />{hint && <small>{hint}</small>}</label>
}
