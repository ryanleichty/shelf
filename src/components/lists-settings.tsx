"use client"

import { type ComponentProps, useEffect, useRef, useState } from "react"
import { DragDropProvider } from "@dnd-kit/react"
import { isSortable, useSortable } from "@dnd-kit/react/sortable"
import { GripVerticalIcon, PlusIcon, Trash2Icon } from "lucide-react"
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CreateListDialog } from "@/components/create-list-dialog"
import { AddCatalogPlacementsDialog } from "@/components/add-catalog-placements-dialog"
import {
  deleteCatalogPlacement,
  deleteList,
  reorderListPlacements,
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

type ListType = (typeof types)[number]["value"]

function isListType(value: string): value is ListType {
  return types.some((type) => type.value === value)
}

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
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [deleting, setDeleting] = useState<Placement | null>(null)
  const [busy, setBusy] = useState(false)
  const [activeType, setActiveType] = useState<ListType>("book")
  const [orderedPlacements, setOrderedPlacements] = useState(placements)
  const orderedPlacementsRef = useRef(placements)
  const reorderInFlight = useRef(new Set<ListType>())
  const visibilityRequestGenerations = useRef(new Map<number, number>())

  useEffect(() => {
    const nextPlacements = placements.map((placement) => {
      const optimisticPlacement = orderedPlacementsRef.current.find(
        (candidate) => candidate.id === placement.id
      )
      return visibilityRequestGenerations.current.has(placement.id) &&
        optimisticPlacement
        ? { ...placement, visible: optimisticPlacement.visible }
        : placement
    })
    orderedPlacementsRef.current = nextPlacements
    setOrderedPlacements(nextPlacements)
  }, [placements])

  async function change(action: () => Promise<unknown>) {
    setBusy(true)
    setError("")
    try {
      await action()
      await onChange()
      return true
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Couldn’t update lists."
      )
      return false
    } finally {
      setBusy(false)
    }
  }

  const activeTypeLabel = types.find((type) => type.value === activeType)?.label
  const rows = orderedPlacements.filter(
    (placement) => placement.type === activeType
  )

  function handleDragEnd(
    event: Parameters<
      NonNullable<ComponentProps<typeof DragDropProvider>["onDragEnd"]>
    >[0]
  ) {
    if (event.canceled || reorderInFlight.current.has(activeType)) return
    const { source } = event.operation
    if (!isSortable(source)) return
    const { initialIndex, index } = source
    if (initialIndex === index) return

    const previousPlacements = orderedPlacements
    const nextRows = [...rows]
    const [movedRow] = nextRows.splice(initialIndex, 1)
    if (!movedRow) return
    nextRows.splice(index, 0, movedRow)
    setOrderedPlacements((currentPlacements) => {
      let nextRowIndex = 0
      return currentPlacements.map((placement) =>
        placement.type === activeType ? nextRows[nextRowIndex++] : placement
      )
    })
    void (async () => {
      reorderInFlight.current.add(activeType)
      setError("")
      try {
        await reorderListPlacements({
          data: {
            type: activeType,
            placementIds: nextRows.map((placement) => placement.id),
          },
        })
        void onChange().catch(() => undefined)
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Couldn’t update lists."
        )
        setOrderedPlacements(previousPlacements)
      } finally {
        reorderInFlight.current.delete(activeType)
      }
    })()
  }

  function updateVisibility(placement: Placement, visible: boolean) {
    const currentPlacement = orderedPlacementsRef.current.find(
      (candidate) => candidate.id === placement.id
    )
    if (!currentPlacement) return
    const previousVisible = currentPlacement.visible
    const generation =
      (visibilityRequestGenerations.current.get(placement.id) ?? 0) + 1
    visibilityRequestGenerations.current.set(placement.id, generation)
    setError("")
    const nextPlacements = orderedPlacementsRef.current.map((candidate) =>
      candidate.id === placement.id ? { ...candidate, visible } : candidate
    )
    orderedPlacementsRef.current = nextPlacements
    setOrderedPlacements(nextPlacements)
    void (async () => {
      try {
        await setListPlacementVisible({
          data: {
            placementId: placement.id,
            type: placement.type,
            visible,
          },
        })
        if (
          visibilityRequestGenerations.current.get(placement.id) !== generation
        )
          return
        await onChange()
      } catch (cause) {
        if (
          visibilityRequestGenerations.current.get(placement.id) !== generation
        )
          return
        setError(
          cause instanceof Error ? cause.message : "Couldn’t update lists."
        )
        const revertedPlacements = orderedPlacementsRef.current.map(
          (candidate) =>
            candidate.id === placement.id
              ? { ...candidate, visible: previousVisible }
              : candidate
        )
        orderedPlacementsRef.current = revertedPlacements
        setOrderedPlacements(revertedPlacements)
      } finally {
        if (
          visibilityRequestGenerations.current.get(placement.id) === generation
        )
          visibilityRequestGenerations.current.delete(placement.id)
      }
    })()
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Tabs
        onValueChange={(value) => {
          if (isListType(value)) setActiveType(value)
        }}
        value={activeType}
      >
        <div className="flex items-center justify-between gap-2">
          <TabsList>
            {types.map((type) => (
              <TabsTrigger key={type.value} value={type.value}>
                {type.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <ButtonGroup>
            <Button onClick={() => setNewListOpen(true)}>
              <PlusIcon data-icon="inline-start" />
              New list
            </Button>
            <Button onClick={() => setCatalogOpen(true)} variant="outline">
              Add row
            </Button>
          </ButtonGroup>
        </div>
        <TabsContent value={activeType}>
          <Card>
            <CardHeader>
              <CardTitle>{activeTypeLabel}</CardTitle>
              <CardDescription>
                Choose which rows appear on the {activeTypeLabel?.toLowerCase()}{" "}
                index.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DragDropProvider onDragEnd={handleDragEnd}>
                <FieldGroup>
                  {rows.map((placement, index) => (
                    <SortablePlacement
                      busy={busy}
                      key={placement.id}
                      onDelete={() => {
                        if (placement.kind === "list") {
                          setDeleting(placement)
                          return
                        }
                        void change(() =>
                          deleteCatalogPlacement({
                            data: {
                              placementId: placement.id,
                              type: placement.type,
                            },
                          })
                        )
                      }}
                      onRename={(name) =>
                        void change(() =>
                          renameList({
                            data: { listId: placement.listId!, name },
                          })
                        )
                      }
                      onVisibilityChange={(visible) =>
                        updateVisibility(placement, visible)
                      }
                      placement={placement}
                      index={index}
                    />
                  ))}
                </FieldGroup>
              </DragDropProvider>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <CreateListDialog
        onCreated={onChange}
        onOpenChange={setNewListOpen}
        open={newListOpen}
        type={activeType}
      />
      {catalogOpen && (
        <AddCatalogPlacementsDialog
          existing={orderedPlacements.filter(
            (placement) => placement.type === activeType
          )}
          onAdded={onChange}
          onOpenChange={setCatalogOpen}
          open
          options={catalogOptions}
          type={activeType}
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

function SortablePlacement({
  busy,
  index,
  onDelete,
  onRename,
  onVisibilityChange,
  placement,
}: {
  busy: boolean
  index: number
  onDelete: () => void
  onRename: (name: string) => void
  onVisibilityChange: (visible: boolean) => void
  placement: Placement
}) {
  const { handleRef, ref } = useSortable({
    disabled: busy,
    group: placement.type,
    id: placement.id,
    index,
  })
  const label = placement.name ?? "Recently added"
  const switchId = `placement-${placement.id}`
  const canRename = placement.kind === "list" && !placement.system
  const canDelete = placement.kind !== "recent" && !placement.system

  return (
    <Field orientation="horizontal" ref={ref}>
      <Button
        aria-label={`Reorder ${label}`}
        disabled={busy}
        ref={handleRef}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <GripVerticalIcon />
      </Button>
      <Switch
        aria-label={`Show ${label} on ${placement.type === "tv" ? "TV" : `${placement.type}s`}`}
        checked={placement.visible}
        id={switchId}
        onCheckedChange={onVisibilityChange}
      />
      {canRename ? (
        <form
          className="flex flex-1"
          onSubmit={(event) => {
            event.preventDefault()
            const name = String(
              new FormData(event.currentTarget).get("name") ?? ""
            )
            if (name && name !== placement.name) onRename(name)
          }}
        >
          <Input defaultValue={placement.name ?? ""} name="name" required />
        </form>
      ) : (
        <FieldLabel className="flex-1" htmlFor={switchId}>
          {label}
        </FieldLabel>
      )}
      {canDelete && (
        <Button
          aria-label={`${placement.kind === "list" ? "Delete" : "Remove"} ${label}`}
          disabled={busy}
          onClick={onDelete}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <Trash2Icon />
        </Button>
      )}
    </Field>
  )
}
