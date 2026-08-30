"use client"

import { useState } from "react"
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
import { createList } from "@/server/lists"

type ListType = "book" | "movie" | "tv"

export function CreateListDialog({
  onCreated,
  onOpenChange,
  open,
  type,
}: {
  onCreated: () => Promise<void>
  onOpenChange: (open: boolean) => void
  open: boolean
  type: ListType
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [name, setName] = useState("")

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setError("")
      setName("")
    }
    onOpenChange(nextOpen)
  }

  async function create() {
    setBusy(true)
    setError("")
    try {
      await createList({ data: { name, type } })
      await onCreated()
      setError("")
      setName("")
      handleOpenChange(false)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Couldn’t create the list."
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
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
