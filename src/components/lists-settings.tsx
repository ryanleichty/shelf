"use client"

import { useState } from "react"
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  createList,
  deleteList,
  moveListPlacement,
  renameList,
  setListPlacementVisible,
} from "@/server/lists"

type Placement = {
  id: number
  listId: number | null
  slug: string | null
  name: string | null
  system: boolean | null
  kind: "recent" | "list"
  type: "book" | "movie" | "tv"
  position: number
  visible: boolean
}

const types = [
  { value: "book", label: "Books" },
  { value: "movie", label: "Movies" },
  { value: "tv", label: "TV" },
] as const

export function ListsSettings({
  placements,
  onChange,
}: {
  placements: Placement[]
  onChange: () => Promise<void>
}) {
  const [error, setError] = useState("")
  const [newListOpen, setNewListOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newType, setNewType] = useState<Placement["type"]>("book")
  const [deleting, setDeleting] = useState<Placement | null>(null)
  const [busy, setBusy] = useState(false)

  async function change(action: () => Promise<unknown>) {
    setBusy(true)
    setError("")
    try {
      await action()
      await onChange()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Couldn’t update lists."
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button onClick={() => setNewListOpen(true)}>
          <PlusIcon data-icon="inline-start" />
          New list
        </Button>
      </div>
      {types.map((type) => {
        const rows = placements.filter(
          (placement) => placement.type === type.value
        )
        return (
          <Card key={type.value}>
            <CardHeader>
              <CardTitle>{type.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                {rows.map((placement, index) => (
                  <Field className="flex-row items-center" key={placement.id}>
                    <Switch
                      aria-label={`Show ${placement.name ?? "Recently added"} on ${type.label}`}
                      checked={placement.visible}
                      disabled={busy}
                      onCheckedChange={(visible) =>
                        void change(() =>
                          setListPlacementVisible({
                            data: {
                              placementId: placement.id,
                              type: placement.type,
                              visible,
                            },
                          })
                        )
                      }
                    />
                    {placement.kind === "recent" || placement.system ? (
                      <FieldLabel className="flex-1">
                        {placement.name ?? "Recently added"}
                      </FieldLabel>
                    ) : (
                      <form
                        className="flex flex-1 gap-2"
                        onSubmit={(event) => {
                          event.preventDefault()
                          const name = String(
                            new FormData(event.currentTarget).get("name") ?? ""
                          )
                          void change(() =>
                            renameList({
                              data: { listId: placement.listId!, name },
                            })
                          )
                        }}
                      >
                        <Input
                          defaultValue={placement.name ?? ""}
                          name="name"
                          required
                        />
                        <Button
                          disabled={busy}
                          size="sm"
                          type="submit"
                          variant="outline"
                        >
                          Rename
                        </Button>
                      </form>
                    )}
                    <ButtonGroup>
                      <Button
                        aria-label={`Move ${placement.name} up`}
                        disabled={busy || index === 0}
                        onClick={() =>
                          void change(() =>
                            moveListPlacement({
                              data: {
                                placementId: placement.id,
                                type: placement.type,
                                direction: "up",
                              },
                            })
                          )
                        }
                        size="icon-sm"
                        variant="outline"
                      >
                        <ChevronUpIcon />
                      </Button>
                      <Button
                        aria-label={`Move ${placement.name} down`}
                        disabled={busy || index === rows.length - 1}
                        onClick={() =>
                          void change(() =>
                            moveListPlacement({
                              data: {
                                placementId: placement.id,
                                type: placement.type,
                                direction: "down",
                              },
                            })
                          )
                        }
                        size="icon-sm"
                        variant="outline"
                      >
                        <ChevronDownIcon />
                      </Button>
                    </ButtonGroup>
                    {placement.kind === "list" && !placement.system && (
                      <Button
                        aria-label={`Delete ${placement.name}`}
                        onClick={() => setDeleting(placement)}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <Trash2Icon />
                      </Button>
                    )}
                  </Field>
                ))}
              </FieldGroup>
            </CardContent>
          </Card>
        )
      })}
      <Dialog onOpenChange={setNewListOpen} open={newListOpen}>
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
              void change(async () => {
                await createList({ data: { name: newName, type: newType } })
                setNewName("")
                setNewListOpen(false)
              })
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="list-name">Name</FieldLabel>
                <Input
                  id="list-name"
                  onChange={(event) => setNewName(event.target.value)}
                  required
                  value={newName}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="list-type">Type</FieldLabel>
                <ToggleGroup
                  onValueChange={(value) =>
                    value[0] && setNewType(value[0] as Placement["type"])
                  }
                  value={[newType]}
                >
                  {types.map((type) => (
                    <ToggleGroupItem key={type.value} value={type.value}>
                      {type.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Field>
            </FieldGroup>
            <DialogFooter className="mt-4">
              <Button disabled={busy} type="submit">
                Create list
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        onOpenChange={(open) => !open && setDeleting(null)}
        open={Boolean(deleting)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This also removes every title in the list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => {
                if (deleting)
                  void change(() =>
                    deleteList({ data: { listId: deleting.listId! } })
                  )
                setDeleting(null)
              }}
              variant="destructive"
            >
              Delete list
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
