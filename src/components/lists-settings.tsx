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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { CreateListDialog } from "@/components/create-list-dialog"
import { AddCatalogPlacementsDialog } from "@/components/add-catalog-placements-dialog"
import {
  deleteCatalogPlacement,
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
  kind:
    "recent" | "list" | "genre" | "collection" | "director" | "actor" | "author"
  sourceSlug: string | null
  type: "book" | "movie" | "tv"
  position: number
  visible: boolean
}
type CatalogOptions = Record<
  Exclude<Placement["kind"], "recent" | "list">,
  Array<{ type: Placement["type"]; slug: string; name: string }>
>

const types = [
  { value: "book", label: "Books" },
  { value: "movie", label: "Movies" },
  { value: "tv", label: "TV" },
] as const

export function ListsSettings({
  placements,
  catalogOptions,
  onChange,
}: {
  placements: Placement[]
  catalogOptions: CatalogOptions
  onChange: () => Promise<void>
}) {
  const [error, setError] = useState("")
  const [newListOpen, setNewListOpen] = useState(false)
  const [catalogType, setCatalogType] = useState<Placement["type"] | null>(null)
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
      <div className="flex justify-end gap-2">
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
              <Button
                onClick={() => setCatalogType(type.value)}
                size="sm"
                variant="outline"
              >
                Add from catalog
              </Button>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                {rows.map((placement, index) => (
                  <Field orientation="horizontal" key={placement.id}>
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
                    {placement.kind === "recent" ||
                    placement.system ||
                    placement.kind !== "list" ? (
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
                    {placement.kind !== "recent" &&
                      placement.kind !== "list" && (
                        <Button
                          aria-label={`Remove ${placement.name}`}
                          onClick={() =>
                            void change(() =>
                              deleteCatalogPlacement({
                                data: {
                                  placementId: placement.id,
                                  type: placement.type,
                                },
                              })
                            )
                          }
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
      <CreateListDialog
        onCreated={onChange}
        onOpenChange={setNewListOpen}
        open={newListOpen}
      />
      {catalogType && (
        <AddCatalogPlacementsDialog
          existing={placements.filter(
            (placement) => placement.type === catalogType
          )}
          onAdded={onChange}
          onOpenChange={(open) => !open && setCatalogType(null)}
          open
          options={catalogOptions}
          type={catalogType}
        />
      )}
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
