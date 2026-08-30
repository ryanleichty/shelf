"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
} from "@/components/ui/combobox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { addCatalogPlacements } from "@/server/lists"

type ItemType = "book" | "movie" | "tv"
type CatalogKind = "genre" | "collection" | "director" | "actor" | "author"
type CatalogOption = { type: ItemType; slug: string; name: string }
type CatalogOptions = Record<CatalogKind, CatalogOption[]>

const labels: Record<CatalogKind, string> = {
  genre: "Genre",
  collection: "Collection",
  director: "Director",
  actor: "Actor",
  author: "Author",
}

function allowedKinds(type: ItemType): CatalogKind[] {
  if (type === "book") return ["genre", "author"]
  return type === "movie"
    ? ["genre", "collection", "director", "actor"]
    : ["genre", "director", "actor"]
}

export function AddCatalogPlacementsDialog({
  existing,
  onAdded,
  onOpenChange,
  open,
  options,
  type,
}: {
  existing: Array<{ kind: string; sourceSlug: string | null }>
  onAdded: () => Promise<void>
  onOpenChange: (open: boolean) => void
  open: boolean
  options: CatalogOptions
  type: ItemType
}) {
  const kinds = allowedKinds(type)
  const [kind, setKind] = useState<CatalogKind>(kinds[0])
  const [selected, setSelected] = useState<CatalogOption[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const available = useMemo(() => {
    const placed = new Set(
      existing
        .filter((placement) => placement.kind === kind)
        .flatMap((placement) =>
          placement.sourceSlug ? [placement.sourceSlug] : []
        )
    )
    return options[kind].filter(
      (option) => option.type === type && !placed.has(option.slug)
    )
  }, [existing, kind, options, type])

  useEffect(() => {
    if (!open) return
    setKind(kinds[0])
    setSelected([])
    setError("")
  }, [open, type])

  async function submit() {
    setBusy(true)
    setError("")
    try {
      await addCatalogPlacements({
        data: { type, kind, slugs: selected.map((option) => option.slug) },
      })
      await onAdded()
      onOpenChange(false)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Couldn’t add catalog rows."
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add from catalog</DialogTitle>
          <DialogDescription>
            Add catalog rows to the {type === "tv" ? "TV" : `${type}s`} index.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>Catalog type</FieldLabel>
            <ToggleGroup
              multiple={false}
              onValueChange={(value) => {
                const nextKind = kinds.find(
                  (candidate) => candidate === value[0]
                )
                if (nextKind) {
                  setKind(nextKind)
                  setSelected([])
                }
              }}
              value={[kind]}
            >
              {kinds.map((option) => (
                <ToggleGroupItem key={option} value={option}>
                  {labels[option]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
          <Field>
            <FieldLabel>Select rows</FieldLabel>
            <Combobox
              itemToStringValue={(option) => option.name}
              items={available}
              multiple
              onValueChange={setSelected}
              value={selected}
            >
              <ComboboxChips>
                <ComboboxValue>
                  {selected.map((option) => (
                    <ComboboxChip key={option.slug}>{option.name}</ComboboxChip>
                  ))}
                </ComboboxValue>
                <ComboboxChipsInput
                  placeholder={`Add ${labels[kind].toLowerCase()}`}
                />
              </ComboboxChips>
              <ComboboxContent>
                <ComboboxEmpty>No catalog rows available.</ComboboxEmpty>
                <ComboboxList>
                  {(option) => (
                    <ComboboxItem key={option.slug} value={option}>
                      {option.name}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </Field>
        </FieldGroup>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            disabled={busy || selected.length === 0}
            onClick={() => void submit()}
          >
            Add rows
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
