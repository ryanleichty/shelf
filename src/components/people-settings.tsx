import { useMemo, useState } from "react"
import { SearchIcon, UsersRoundIcon } from "lucide-react"
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  deletePerson,
  mergePeople,
  savePerson,
  type Person,
  type PersonKind,
} from "@/server/people"

type People = Record<`${PersonKind}s`, Person[]>
type EditingPerson = Person & { kind: PersonKind }

const labels: Record<PersonKind, string> = {
  author: "Author",
  director: "Director",
  actor: "Actor",
}

export function PeopleSettings({
  people,
  onChange,
}: {
  people: People
  onChange: () => Promise<void>
}) {
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<EditingPerson | null>(null)
  const [mergeTarget, setMergeTarget] = useState<Person | null>(null)
  const [confirmingMerge, setConfirmingMerge] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const peopleForEditing = editing ? people[`${editing.kind}s`] : []
  const mergeOptions = useMemo(
    () => peopleForEditing.filter((person) => person.id !== editing?.id),
    [editing?.id, peopleForEditing]
  )

  async function save() {
    if (!editing) return
    setBusy(true)
    setError("")
    try {
      await savePerson({
        data: {
          kind: editing.kind,
          id: editing.id,
          name: editing.name,
          slug: editing.slug,
        },
      })
      await onChange()
      setEditing(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn’t save person.")
    } finally {
      setBusy(false)
    }
  }

  async function merge() {
    if (!editing || !mergeTarget) return
    setBusy(true)
    setError("")
    try {
      await mergePeople({
        data: {
          kind: editing.kind,
          sourceId: editing.id,
          survivorId: mergeTarget.id,
        },
      })
      await onChange()
      setEditing(null)
      setMergeTarget(null)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Couldn’t merge people."
      )
    } finally {
      setBusy(false)
      setConfirmingMerge(false)
    }
  }

  async function remove() {
    if (!editing) return
    setBusy(true)
    setError("")
    try {
      await deletePerson({ data: { kind: editing.kind, id: editing.id } })
      await onChange()
      setEditing(null)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Couldn’t delete person."
      )
    } finally {
      setBusy(false)
      setConfirmingDelete(false)
    }
  }

  function closeSheet() {
    setEditing(null)
    setMergeTarget(null)
    setError("")
  }

  return (
    <>
      <Tabs defaultValue="authors" onValueChange={() => setQuery("")}>
        <TabsList>
          <TabsTrigger value="authors">Authors</TabsTrigger>
          <TabsTrigger value="directors">Directors</TabsTrigger>
          <TabsTrigger value="actors">Actors</TabsTrigger>
        </TabsList>
        {(["author", "director", "actor"] as const).map((kind) => (
          <TabsContent key={kind} value={`${kind}s`}>
            <PeopleTable
              kind={kind}
              onQueryChange={setQuery}
              onSelect={(person) => setEditing({ ...person, kind })}
              people={people[`${kind}s`]}
              query={query}
            />
          </TabsContent>
        ))}
      </Tabs>

      <Sheet
        onOpenChange={(open) => !open && closeSheet()}
        open={Boolean(editing)}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              Edit {editing ? labels[editing.kind].toLowerCase() : "person"}
            </SheetTitle>
            <SheetDescription>
              Correct the name or slug, merge duplicate people, or remove unused
              people.
            </SheetDescription>
          </SheetHeader>
          {editing && (
            <>
              <FieldGroup className="px-4">
                <Field>
                  <FieldLabel htmlFor="person-name">Name</FieldLabel>
                  <Input
                    id="person-name"
                    onChange={(event) =>
                      setEditing({ ...editing, name: event.target.value })
                    }
                    value={editing.name}
                  />
                </Field>
                <Field data-invalid={Boolean(error)}>
                  <FieldLabel htmlFor="person-slug">Slug</FieldLabel>
                  <Input
                    aria-invalid={Boolean(error)}
                    id="person-slug"
                    onChange={(event) =>
                      setEditing({ ...editing, slug: event.target.value })
                    }
                    value={editing.slug}
                  />
                  <FieldError>{error}</FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor="merge-person">
                    Merge into {labels[editing.kind].toLowerCase()}
                  </FieldLabel>
                  <Combobox
                    itemToStringValue={(person) => person.name}
                    items={mergeOptions}
                    onValueChange={setMergeTarget}
                    value={mergeTarget}
                  >
                    <ComboboxTrigger
                      render={
                        <Button
                          id="merge-person"
                          type="button"
                          variant="outline"
                        />
                      }
                    >
                      {mergeTarget?.name ??
                        `Choose ${labels[editing.kind].toLowerCase()}…`}
                    </ComboboxTrigger>
                    <ComboboxContent
                      collisionAvoidance={{
                        align: "shift",
                        fallbackAxisSide: "none",
                        side: "shift",
                      }}
                      collisionPadding={8}
                      positionMethod="fixed"
                    >
                      <ComboboxInput
                        placeholder="Search people…"
                        showTrigger={false}
                      />
                      <ComboboxEmpty>No people found.</ComboboxEmpty>
                      <ComboboxList>
                        {(person) => (
                          <ComboboxItem key={person.id} value={person}>
                            {person.name}
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </Field>
              </FieldGroup>
              <SheetFooter>
                <Button disabled={busy} onClick={save} type="button">
                  Save {labels[editing.kind].toLowerCase()}
                </Button>
                {editing.itemCount === 0 ? (
                  <Button
                    disabled={busy}
                    onClick={() => setConfirmingDelete(true)}
                    type="button"
                    variant="destructive"
                  >
                    Delete {labels[editing.kind].toLowerCase()}
                  </Button>
                ) : (
                  <Button
                    disabled={busy || !mergeTarget}
                    onClick={() => setConfirmingMerge(true)}
                    type="button"
                    variant="outline"
                  >
                    Merge person
                  </Button>
                )}
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog
        onOpenChange={(open) => !open && setConfirmingMerge(false)}
        open={confirmingMerge}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Merge {editing?.name} into {mergeTarget?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Every linked item will use {mergeTarget?.name}. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void merge()}>
              Merge people
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        onOpenChange={(open) => !open && setConfirmingDelete(false)}
        open={confirmingDelete}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {editing?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This unused person will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => void remove()}
              variant="destructive"
            >
              Delete person
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function PeopleTable({
  kind,
  people,
  query,
  onQueryChange,
  onSelect,
}: {
  kind: PersonKind
  people: Person[]
  query: string
  onQueryChange: (query: string) => void
  onSelect: (person: Person) => void
}) {
  const filteredPeople = people.filter((person) =>
    `${person.name} ${person.slug}`
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase())
  )
  const plural = `${labels[kind]}s`

  return (
    <Card>
      <CardHeader>
        <CardTitle>{plural}</CardTitle>
        <CardDescription>
          Correct names, slugs, and duplicate {plural.toLocaleLowerCase()}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={`Search ${plural.toLocaleLowerCase()}…`}
            value={query}
          />
        </InputGroup>
        {filteredPeople.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="text-right">Item count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPeople.map((person) => (
                <TableRow key={person.id} onClick={() => onSelect(person)}>
                  <TableCell className="font-medium">{person.name}</TableCell>
                  <TableCell>{person.slug}</TableCell>
                  <TableCell className="text-right">
                    {person.itemCount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UsersRoundIcon />
              </EmptyMedia>
              <EmptyTitle>No {plural.toLocaleLowerCase()} found</EmptyTitle>
              <EmptyDescription>Try a different search.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  )
}
