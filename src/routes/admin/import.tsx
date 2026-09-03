import { useRef, useState } from "react"
import {
  Link,
  createFileRoute,
  redirect,
  useRouter,
} from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import type { CsvImportPlan } from "@/lib/import-csv"
import { planCsvImport } from "@/lib/import-csv"
import { importItems } from "@/server/items"
import { getSignedInStatus } from "@/server/session"

export const Route = createFileRoute("/admin/import")({
  beforeLoad: async () => {
    if (!(await getSignedInStatus())) throw redirect({ to: "/admin/login" })
  },
  component: Import,
})

type ImportResult = Awaited<ReturnType<typeof importItems>>

const CSV_CHUNK = 25

function Import() {
  const router = useRouter()
  const [type, setType] = useState<"book" | "movie" | "tv">("movie")
  const [format, setFormat] = useState<
    "" | "hardcover" | "paperback" | "blu-ray" | "dvd" | "other"
  >("blu-ray")
  const [edition, setEdition] = useState<
    "" | "theatrical" | "extended" | "director-cut"
  >("")
  const [queries, setQueries] = useState("")
  const [plan, setPlan] = useState<CsvImportPlan | null>(null)
  const [progress, setProgress] = useState<{
    done: number
    total: number
  } | null>(null)
  const cancelled = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [lastRunWasPreview, setLastRunWasPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  async function run(dryRun: boolean) {
    setBusy(true)
    setResult(null)
    setError("")
    try {
      setResult(
        await importItems({
          data: {
            type,
            format,
            edition,
            dryRun,
            items: queries
              .split("\n")
              .map((q) => q.trim())
              .filter(Boolean)
              .map((query) => ({ query })),
          },
        })
      )
      setLastRunWasPreview(dryRun)
      if (!dryRun) await router.invalidate()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Import failed.")
    } finally {
      setBusy(false)
    }
  }
  async function runCsv(dryRun: boolean) {
    if (!plan) return
    setBusy(true)
    setResult(null)
    setError("")
    cancelled.current = false
    const totals: ImportResult = {
      added: [],
      skipped: [],
      failed: [],
      needsReview: [],
    }
    setProgress({ done: 0, total: plan.entries.length })
    try {
      for (let index = 0; index < plan.entries.length; index += CSV_CHUNK) {
        if (cancelled.current) break
        const slice = plan.entries.slice(index, index + CSV_CHUNK)
        const response = await importItems({
          data: { type, format, edition, dryRun, items: slice },
        })
        totals.added.push(...response.added)
        totals.skipped.push(...response.skipped)
        totals.failed.push(...response.failed)
        totals.needsReview.push(...response.needsReview)
        setResult({ ...totals })
        setProgress({
          done: Math.min(index + CSV_CHUNK, plan.entries.length),
          total: plan.entries.length,
        })
      }
      setLastRunWasPreview(dryRun)
      if (!dryRun) await router.invalidate()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Import failed.")
    } finally {
      setBusy(false)
    }
  }
  async function handleFile(file: File | undefined) {
    if (!file) return
    setError("")
    try {
      const text = await file.text()
      const nextPlan = planCsvImport(text)
      setPlan(nextPlan)
      setResult(null)
      setProgress(null)
      setType(nextPlan.type)
      setFormat(nextPlan.type === "book" ? "hardcover" : "blu-ray")
    } catch (cause) {
      setPlan(null)
      setError(cause instanceof Error ? cause.message : "Could not read CSV.")
    }
  }
  function clearFile() {
    setPlan(null)
    setProgress(null)
    setError("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }
  async function addCandidate(query: string, providerId: string) {
    setBusy(true)
    setError("")
    try {
      const response = await importItems({
        data: { type, format, edition, items: [{ query, providerId }] },
      })
      setResult((current) =>
        current
          ? {
              added: [...current.added, ...response.added],
              skipped: [...current.skipped, ...response.skipped],
              failed: [...current.failed, ...response.failed],
              needsReview: current.needsReview.filter(
                (entry) => entry.query !== query
              ),
            }
          : response
      )
      await router.invalidate()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Import failed.")
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="container mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Bulk import</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        One title per line, optionally with a year like <code>Dune (2021)</code>
        , or upload a Goodreads or Letterboxd CSV export. Ambiguous titles are
        listed for you to pick.
      </p>
      <form
        className="mt-6 grid gap-5"
        onSubmit={(event) => {
          event.preventDefault()
          if (!plan && !queries.trim()) return
          if (plan) void runCsv(false)
          else void run(false)
        }}
      >
        <Tabs
          onValueChange={(value) => {
            const next = value as "book" | "movie" | "tv"
            setType(next)
            setFormat(next === "book" ? "hardcover" : "blu-ray")
            setEdition("")
          }}
          value={type}
        >
          <TabsList>
            <TabsTrigger value="book">Books</TabsTrigger>
            <TabsTrigger value="movie">Movies</TabsTrigger>
            <TabsTrigger value="tv">TV</TabsTrigger>
          </TabsList>
        </Tabs>
        <label className="grid gap-2 text-sm font-medium">
          Format
          <select
            className="h-8 rounded-lg border bg-transparent px-2.5 text-sm"
            onChange={(e) => setFormat(e.target.value as typeof format)}
            value={format}
          >
            {type === "book" ? (
              <>
                <option value="hardcover">Hardcover</option>
                <option value="paperback">Paperback</option>
              </>
            ) : (
              <>
                <option value="blu-ray">Blu-ray</option>
                <option value="dvd">DVD</option>
              </>
            )}
            <option value="other">Other</option>
          </select>
        </label>
        {type !== "book" && (
          <label className="grid gap-2 text-sm font-medium">
            Edition
            <select
              className="h-8 rounded-lg border bg-transparent px-2.5 text-sm"
              onChange={(e) => setEdition(e.target.value as typeof edition)}
              value={edition}
            >
              <option value="">Unspecified</option>
              <option value="theatrical">Theatrical</option>
              <option value="extended">Extended</option>
              <option value="director-cut">Director&apos;s Cut</option>
            </select>
          </label>
        )}
        <label className="grid gap-2 text-sm font-medium">
          Goodreads or Letterboxd CSV
          <input
            accept=".csv,text/csv"
            className="text-sm"
            disabled={busy}
            onChange={(e) => void handleFile(e.target.files?.[0])}
            ref={fileInputRef}
            type="file"
          />
        </label>
        {plan && (
          <div className="rounded-lg border p-3 text-sm">
            <p>
              Detected <strong>{plan.source}</strong> export —{" "}
              {plan.entries.length} row
              {plan.entries.length === 1 ? "" : "s"} to import.
            </p>
            {plan.skipped.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-muted-foreground">
                  {plan.skipped.length} row
                  {plan.skipped.length === 1 ? "" : "s"} skipped
                </summary>
                <ul className="mt-2 grid gap-1">
                  {plan.skipped.map((entry, index) => (
                    <li key={`${entry.row}-${index}`}>
                      {entry.row} — {entry.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <Button
              className="mt-3"
              disabled={busy}
              onClick={clearFile}
              size="sm"
              type="button"
              variant="outline"
            >
              Clear file
            </Button>
          </div>
        )}
        <Textarea
          disabled={!!plan}
          onChange={(e) => setQueries(e.target.value)}
          placeholder={"Blade Runner\nParis, Texas"}
          rows={12}
          value={queries}
        />
        <div className="flex items-center justify-end gap-2">
          {progress && (
            <p className="mr-auto flex items-center gap-2 text-sm text-muted-foreground">
              {busy && <Spinner />}
              Imported {progress.done} of {progress.total}
            </p>
          )}
          {busy && progress && (
            <Button
              onClick={() => {
                cancelled.current = true
              }}
              type="button"
              variant="outline"
            >
              Stop
            </Button>
          )}
          <Button render={<Link to="/admin" />} variant="outline">
            Cancel
          </Button>
          <Button
            disabled={busy || (!plan && !queries.trim())}
            onClick={() => void (plan ? runCsv(true) : run(true))}
            type="button"
            variant="outline"
          >
            Preview
          </Button>
          <Button disabled={busy || (!plan && !queries.trim())} type="submit">
            {busy ? "Importing…" : "Import items"}
          </Button>
        </div>
        {error && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {error}
            {progress &&
              progress.done < progress.total &&
              ` Imported ${progress.done} of ${progress.total} before the error.`}
          </p>
        )}
      </form>
      {result && (
        <div className="mt-8 space-y-4 text-sm">
          {result.added.length > 0 && (
            <section>
              <h2 className="font-medium">
                {lastRunWasPreview ? "Would add" : "Added"}
              </h2>
              {result.added.map((item) => (
                <p key={item.slug}>{item.title}</p>
              ))}
            </section>
          )}
          {result.needsReview.map((entry) => (
            <section key={entry.query}>
              <h2 className="font-medium">Which “{entry.query}”?</h2>
              <ul className="mt-2 grid gap-2">
                {entry.candidates.map((candidate) => (
                  <li className="flex items-center gap-3" key={candidate.id}>
                    {candidate.coverImageUrl && (
                      <img
                        alt=""
                        className="h-12 w-8 rounded-sm object-cover"
                        loading="lazy"
                        src={candidate.coverImageUrl}
                      />
                    )}
                    <span className="flex-1">
                      {candidate.title}
                      {candidate.year ? ` (${candidate.year})` : ""}
                      {candidate.creator ? ` — ${candidate.creator}` : ""}
                    </span>
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void addCandidate(entry.query, candidate.id)
                      }
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Add this
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {result.skipped.length > 0 && (
            <section>
              <h2 className="font-medium">Skipped</h2>
              {result.skipped.map((item) => (
                <p key={item.query}>
                  {item.query} — {item.reason}
                </p>
              ))}
            </section>
          )}
          {result.failed.length > 0 && (
            <section>
              <h2 className="font-medium">Failed</h2>
              {result.failed.map((item) => (
                <p key={item.query}>
                  {item.query} — {item.reason}
                </p>
              ))}
            </section>
          )}
        </div>
      )}
    </main>
  )
}
