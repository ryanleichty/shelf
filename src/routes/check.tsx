import { useCallback, useState } from "react"
import { Link, createFileRoute, redirect } from "@tanstack/react-router"
import { BarcodeScanner } from "@/components/barcode-scanner"
import { Field, FieldDescription, FieldError } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { checkBarcode, getAdminStatus } from "@/server/items"

type CheckResult = Awaited<ReturnType<typeof checkBarcode>>

export const Route = createFileRoute("/check")({
  beforeLoad: async () => {
    if (!(await getAdminStatus())) throw redirect({ to: "/admin/login" })
  },
  component: Check,
})

function Check() {
  const [code, setCode] = useState("")
  const [result, setResult] = useState<CheckResult | null>(null)
  const [error, setError] = useState("")
  const [checking, setChecking] = useState(false)

  const submitCode = useCallback(
    async (value: string) => {
      if (checking) return
      setChecking(true)
      setError("")
      setResult(null)
      try {
        setResult(await checkBarcode({ data: { code: value } }))
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not check that barcode. Try again."
        )
      } finally {
        setChecking(false)
      }
    },
    [checking]
  )

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await submitCode(code)
  }

  return (
    <main className="container mx-auto max-w-md px-4 py-6 sm:py-10">
      <p className="text-sm text-muted-foreground">Private index</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Check Shelf
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Scan a barcode before you buy.
      </p>

      <div className="mt-6 flex flex-col gap-5">
        <BarcodeScanner
          onDetected={(value) => {
            setCode(value)
            void submitCode(value)
          }}
        />
        <form onSubmit={submit}>
          <Field>
            <InputGroup>
              <InputGroupInput
                aria-label="Barcode, UPC, or ISBN"
                autoComplete="off"
                inputMode="numeric"
                onChange={(event) => setCode(event.target.value)}
                placeholder="Type or paste a code"
                value={code}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label="Check barcode"
                  disabled={checking || !code.trim()}
                  type="submit"
                >
                  {checking && <Spinner />}
                  Check
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <FieldDescription>
              EAN-13, UPC-A, ISBN-10, or ISBN-13
            </FieldDescription>
          </Field>
        </form>
      </div>

      {error && <FieldError className="mt-5">{error}</FieldError>}
      {result?.status === "owned" && (
        <article className="mt-6 flex gap-4 rounded-lg border p-4">
          <div className="size-20 shrink-0 overflow-hidden rounded-md bg-muted">
            {result.item.coverImageUrl ? (
              <img
                alt=""
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
                src={result.item.coverImageUrl}
              />
            ) : null}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary">Already on Shelf</p>
            <h2 className="mt-1 truncate font-semibold">{result.item.title}</h2>
            <p className="text-sm text-muted-foreground">
              {result.item.year}
              {result.item.format
                ? ` · ${formatLabel(result.item.format)}`
                : ""}
            </p>
            <Link
              className="mt-2 inline-block text-sm text-primary underline-offset-4 hover:underline"
              params={{ slug: result.item.slug }}
              to="/item/$slug"
            >
              View item
            </Link>
          </div>
        </article>
      )}
      {result?.status === "not-owned" && (
        <article className="mt-6 rounded-lg border p-4">
          <p className="font-medium">Doesn’t look like you own it.</p>
          {result.title && (
            <p className="mt-1 text-sm text-muted-foreground">
              {result.title}
              {result.year ? ` · ${result.year}` : ""}
              {result.format ? ` · ${result.format}` : ""}
            </p>
          )}
        </article>
      )}
    </main>
  )
}

function formatLabel(format: string) {
  return format === "blu-ray"
    ? "Blu-ray"
    : format === "dvd"
      ? "DVD"
      : format[0].toUpperCase() + format.slice(1)
}
