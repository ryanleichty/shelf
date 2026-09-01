import { useState } from "react"
import {
  Link,
  createFileRoute,
  redirect,
  useRouter,
} from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { importItems, getSignedInStatus } from "@/server/items"

export const Route = createFileRoute("/admin/import")({
  beforeLoad: async () => { if (!(await getSignedInStatus())) throw redirect({ to: "/admin/login" }) },
  component: Import,
})

function Import() {
  const router = useRouter()
  const [type, setType] = useState<"book" | "movie">("movie")
  const [format, setFormat] = useState<"" | "hardcover" | "paperback" | "blu-ray" | "dvd" | "other">("blu-ray")
  const [edition, setEdition] = useState<"" | "theatrical" | "extended" | "director-cut">("")
  const [queries, setQueries] = useState("")
  const [result, setResult] = useState<Awaited<ReturnType<typeof importItems>> | null>(null)
  const [busy, setBusy] = useState(false)
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setResult(null)
    setResult(await importItems({ data: { type, format, edition, queries: queries.split("\n").map((q) => q.trim()).filter(Boolean) } }))
    await router.invalidate()
    setBusy(false)
  }
  return <main className="container mx-auto max-w-3xl px-4 py-10"><h1 className="text-3xl font-semibold tracking-tight">Bulk import</h1><p className="mt-2 text-sm text-muted-foreground">One title per line. Shelf finds and adds the first matching item.</p>
    <form className="mt-6 grid gap-5" onSubmit={submit}><Tabs onValueChange={(value) => { const next = value as "book" | "movie"; setType(next); setFormat(next === "movie" ? "blu-ray" : "hardcover"); setEdition("") }} value={type}><TabsList><TabsTrigger value="book">Books</TabsTrigger><TabsTrigger value="movie">Movies</TabsTrigger></TabsList></Tabs>
      <label className="grid gap-2 text-sm font-medium">Format<select className="h-8 rounded-lg border bg-transparent px-2.5 text-sm" onChange={(e) => setFormat(e.target.value as typeof format)} value={format}>{type === "movie" ? <><option value="blu-ray">Blu-ray</option><option value="dvd">DVD</option></> : <><option value="hardcover">Hardcover</option><option value="paperback">Paperback</option></>}<option value="other">Other</option></select></label>
      {type === "movie" && <label className="grid gap-2 text-sm font-medium">Edition<select className="h-8 rounded-lg border bg-transparent px-2.5 text-sm" onChange={(e) => setEdition(e.target.value as typeof edition)} value={edition}><option value="">Unspecified</option><option value="theatrical">Theatrical</option><option value="extended">Extended</option><option value="director-cut">Director&apos;s Cut</option></select></label>}
      <Textarea onChange={(e) => setQueries(e.target.value)} placeholder={"Blade Runner\nParis, Texas"} required rows={12} value={queries} />
      <div className="flex justify-end gap-2"><Button render={<Link to="/admin" />} variant="outline">Cancel</Button><Button disabled={busy} type="submit">{busy ? "Importing…" : "Import items"}</Button></div>
    </form>
    {result && <div className="mt-8 space-y-4 text-sm">{result.added.length > 0 && <section><h2 className="font-medium">Added</h2>{result.added.map((item) => <p key={item.slug}>{item.title}</p>)}</section>}{result.skipped.length > 0 && <section><h2 className="font-medium">Skipped</h2>{result.skipped.map((item) => <p key={item.query}>{item.query} — {item.reason}</p>)}</section>}{result.failed.length > 0 && <section><h2 className="font-medium">Failed</h2>{result.failed.map((item) => <p key={item.query}>{item.query} — {item.reason}</p>)}</section>}</div>}
  </main>
}
