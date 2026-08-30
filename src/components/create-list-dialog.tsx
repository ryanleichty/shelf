"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { createList } from "@/server/lists"

const types = [
  { value: "book", label: "Books" },
  { value: "movie", label: "Movies" },
  { value: "tv", label: "TV" },
] as const

type ListType = (typeof types)[number]["value"]

export function CreateListDialog({
  defaultType = "book",
  onCreated,
  onOpenChange,
  open,
}: {
  defaultType?: ListType
  onCreated: () => Promise<void>
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [name, setName] = useState("")
  const [type, setType] = useState<ListType>(defaultType)

  useEffect(() => {
    if (open) {
      setError("")
      setName("")
      setType(defaultType)
    }
  }, [defaultType, open])

  async function create() {
    setBusy(true)
    setError("")
    try {
      await createList({ data: { name, type } })
      await onCreated()
      onOpenChange(false)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Couldn’t create the list."
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New list</DialogTitle>
          <DialogDescription>
            Create a list for one catalog type.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void create()
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="list-name">Name</FieldLabel>
              <Input
                id="list-name"
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="list-type">Type</FieldLabel>
              <ToggleGroup
                multiple={false}
                onValueChange={(value) =>
                  value[0] && setType(value[0] as ListType)
                }
                value={[type]}
              >
                {types.map((option) => (
                  <ToggleGroupItem key={option.value} value={option.value}>
                    {option.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
          </FieldGroup>
          {error && (
            <p className="mt-4 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter className="mt-4">
            <Button disabled={busy} type="submit">
              Create list
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
