import { useMemo, useState } from "react"
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router"
import { ScanLineIcon } from "lucide-react"
import { BarcodeScanner } from "@/components/barcode-scanner"
import {
  CheckBarcodeResult,
  ShelfItemSummary,
} from "@/components/check-barcode-result"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { FieldError } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { matchesQuery, typeLabels } from "@/lib/catalog"
import { useCatalog } from "@/lib/use-catalog"
import { cn } from "@/lib/utils"
import { checkBarcode } from "@/server/barcode"
import { getAdminStatus } from "@/server/session"

type CheckResult = Awaited<ReturnType<typeof checkBarcode>>

const MAX_RESULTS = 12

// Mirrors barcodeInput on the server: EAN-13, UPC-A, ISBN-10 or ISBN-13.
function looksLikeBarcode(value: string) {
  const code = value.replace(/\s/g, "").toUpperCase()
  return /^\d{12,13}$/.test(code) || /^\d{9}[\dX]$/.test(code)
}

export const Route = createFileRoute("/check")({
  beforeLoad: async () => {
    if (!(await getAdminStatus())) throw redirect({ to: "/admin/login" })
  },
  component: Check,
})

function Check() {
  const router = useRouter()
  const catalog = useCatalog()
  const [query, setQuery] = useState("")
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState("")
  const [scannerReset, setScannerReset] = useState(0)
  const [checked, setChecked] = useState<{
    result: CheckResult
    code: string
  } | null>(null)

  const isCode = looksLikeBarcode(query)
  const matches = useMemo(() => {
    const trimmed = query.trim()
    if (!trimmed || looksLikeBarcode(trimmed)) return []
    return [...catalog.items, ...catalog.wishlist]
      .filter((item) => matchesQuery(item, trimmed))
      .slice(0, MAX_RESULTS)
  }, [catalog, query])

  async function submitCode(value: string) {
    if (checking) return
    const code = value.replace(/\s/g, "").toUpperCase()
    setChecking(true)
    setError("")
    setChecked(null)
    try {
      setChecked({ result: await checkBarcode({ data: { code } }), code })
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not check that barcode. Try again."
      )
    } finally {
      setChecking(false)
    }
  }

  return (
    <main className="container mx-auto max-w-md px-4 py-6 sm:py-10">
      <p className="text-sm text-muted-foreground">Private index</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Do I have this?
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Scan a barcode or search the shelf before you buy.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        <BarcodeScanner
          onDetected={(value) => {
            setQuery(value)
            void submitCode(value)
          }}
          stopSignal={scannerReset}
        />
        <Command
          className="gap-2 overflow-visible bg-transparent p-0 [&_[data-slot=command-input-wrapper]]:p-0"
          shouldFilter={false}
        >
          <CommandInput
            aria-label="Barcode or title"
            autoComplete="off"
            autoFocus
            onValueChange={setQuery}
            placeholder="Type a barcode or search by title, person, genre…"
            value={query}
          />
          <CommandList
            className={cn(
              "max-h-80 rounded-lg border bg-popover p-1",
              !query.trim() && "hidden"
            )}
          >
            {query.trim() && !isCode && (
              <CommandEmpty>Nothing on the shelf matches.</CommandEmpty>
            )}
            {isCode && (
              <CommandGroup>
                <CommandItem
                  disabled={checking}
                  onSelect={() => {
                    setScannerReset((current) => current + 1)
                    void submitCode(query)
                  }}
                  value={`check:${query}`}
                >
                  {checking ? <Spinner /> : <ScanLineIcon />}
                  <span className="min-w-0 flex-1 truncate">
                    Check barcode {query.trim()}
                  </span>
                </CommandItem>
              </CommandGroup>
            )}
            {matches.length > 0 && (
              <CommandGroup heading="On the shelf">
                {matches.map((item) => (
                  <CommandItem
                    key={item.id}
                    onSelect={() =>
                      router.navigate({
                        to: "/item/$slug",
                        params: { slug: item.slug },
                      })
                    }
                    value={`item:${item.id}`}
                  >
                    <ShelfItemSummary item={item} />
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {typeLabels[item.type]}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
        {error && <FieldError>{error}</FieldError>}
        {checked && (
          <CheckBarcodeResult code={checked.code} result={checked.result} />
        )}
      </div>
    </main>
  )
}
