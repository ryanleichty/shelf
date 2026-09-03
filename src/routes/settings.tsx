import { useCallback, useEffect, useState } from "react"
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router"
import {
  EllipsisIcon,
  EyeIcon,
  EyeOffIcon,
  PencilIcon,
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
import { useSignedInStatus } from "@/components/signed-in-status"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { getSignedInStatus } from "@/server/session"
import { ListsSettings } from "@/components/lists-settings"
import { PeopleSettings } from "@/components/people-settings"
import { getCatalogPlacementOptions, getListPlacements } from "@/server/lists"
import { getPeople } from "@/server/people"
import {
  deleteUser,
  getSettings,
  saveProfile,
  saveUser,
  uploadProfilePhoto,
} from "@/server/users"

export const Route = createFileRoute("/settings")({
  beforeLoad: async () => {
    if (!(await getSignedInStatus())) throw redirect({ to: "/admin/login" })
  },
  loader: async () => {
    const [settings, placements, catalogOptions] = await Promise.all([
      getSettings(),
      getListPlacements(),
      getCatalogPlacementOptions(),
    ])
    return {
      settings,
      placements,
      catalogOptions,
    }
  },
  pendingComponent: SettingsPending,
  pendingMs: 150,
  staleTime: 60_000,
  component: Settings,
})

type UserForm = {
  id?: number
  firstName: string
  lastName: string
  email: string
  role: "admin" | "member"
  password: string
}

function Settings() {
  const { settings: data, placements, catalogOptions } = Route.useLoaderData()
  const router = useRouter()
  const { currentUser, setCurrentUser } = useSignedInStatus()
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [activeTab, setActiveTab] = useState("profile")
  const [editing, setEditing] = useState<UserForm | null>(null)
  const [deletingUser, setDeletingUser] = useState<{
    id: number
    name: string
  } | null>(null)
  const [isProfilePasswordVisible, setIsProfilePasswordVisible] =
    useState(false)
  const [isUserPasswordVisible, setIsUserPasswordVisible] = useState(false)

  async function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError("")
    const form = new FormData(event.currentTarget)
    try {
      await saveProfile({
        data: {
          firstName: String(form.get("firstName")),
          lastName: String(form.get("lastName")),
          email: String(form.get("email")),
          password: String(form.get("password") || ""),
        },
      })
      await router.invalidate()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Couldn’t save your profile."
      )
    } finally {
      setBusy(false)
    }
  }

  async function uploadPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const image = input.files?.[0]
    if (!image) return
    setBusy(true)
    setError("")
    try {
      const form = new FormData()
      form.set("image", image)
      const { avatarUrl } = await uploadProfilePhoto({ data: form })
      if (currentUser) setCurrentUser({ ...currentUser, avatarUrl })
      await router.invalidate()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Couldn’t upload your photo."
      )
    } finally {
      setBusy(false)
      input.value = ""
    }
  }

  async function submitUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    setBusy(true)
    setError("")
    try {
      await saveUser({ data: editing })
      setEditing(null)
      await router.invalidate()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Couldn’t save this user."
      )
    } finally {
      setBusy(false)
    }
  }

  async function removeUser(id: number) {
    setBusy(true)
    setError("")
    try {
      await deleteUser({ data: { id } })
      await router.invalidate()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Couldn’t delete this user."
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="container mx-auto max-w-4xl px-4 py-10">
      <p className="text-sm text-muted-foreground">Account</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Settings</h1>
      {error && (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Tabs className="mt-8" onValueChange={setActiveTab} value={activeTab}>
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="lists">Lists</TabsTrigger>
          {data.isAdmin && <TabsTrigger value="users">Users</TabsTrigger>}
          {data.isAdmin && <TabsTrigger value="people">People</TabsTrigger>}
        </TabsList>
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>
                {data.bootstrap
                  ? "Set up the first Shelf admin account."
                  : "Update your account details."}
              </CardDescription>
            </CardHeader>
            <form onSubmit={submitProfile}>
              <FieldGroup className="px-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="firstName">First name</FieldLabel>
                  <Input
                    defaultValue={data.profile.firstName}
                    id="firstName"
                    name="firstName"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="lastName">Last name</FieldLabel>
                  <Input
                    defaultValue={data.profile.lastName}
                    id="lastName"
                    name="lastName"
                    required
                  />
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    autoComplete="email"
                    defaultValue={data.profile.email}
                    id="email"
                    name="email"
                    required
                    type="email"
                  />
                </Field>
                {!data.bootstrap && (
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor="photo">Profile photo</FieldLabel>
                    <div className="flex items-center gap-3">
                      <Avatar size="lg">
                        {currentUser?.avatarUrl && (
                          <AvatarImage
                            alt={`${currentUser.firstName} ${currentUser.lastName}`}
                            src={currentUser.avatarUrl}
                          />
                        )}
                        <AvatarFallback>
                          {currentUser?.firstName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <Input
                        accept="image/*"
                        disabled={busy}
                        id="photo"
                        onChange={uploadPhoto}
                        type="file"
                      />
                    </div>
                  </Field>
                )}
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="password">
                    {data.bootstrap ? "Password" : "New password"}
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      autoComplete="new-password"
                      id="password"
                      minLength={8}
                      name="password"
                      placeholder={
                        data.bootstrap
                          ? "At least 8 characters"
                          : "Leave blank to keep your current password"
                      }
                      required={data.bootstrap}
                      type={isProfilePasswordVisible ? "text" : "password"}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        aria-label={
                          isProfilePasswordVisible
                            ? "Hide password"
                            : "Show password"
                        }
                        onClick={() =>
                          setIsProfilePasswordVisible((visible) => !visible)
                        }
                        size="icon-xs"
                        type="button"
                        variant="ghost"
                      >
                        {isProfilePasswordVisible ? (
                          <EyeOffIcon />
                        ) : (
                          <EyeIcon />
                        )}
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
                <Button
                  className="w-fit sm:col-span-2"
                  disabled={busy}
                  type="submit"
                >
                  Save profile
                </Button>
              </FieldGroup>
            </form>
          </Card>
        </TabsContent>
        <TabsContent value="lists">
          <ListsSettings
            catalogOptions={catalogOptions}
            onChange={() => router.invalidate()}
            placements={placements}
          />
        </TabsContent>
        {data.isAdmin && (
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>Users</CardTitle>
                <CardDescription>
                  Manage who can access this shared shelf.
                </CardDescription>
                <CardAction>
                  <Button
                    onClick={() =>
                      setEditing({
                        firstName: "",
                        lastName: "",
                        email: "",
                        role: "member",
                        password: "",
                      })
                    }
                  >
                    Add user
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="w-24 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="font-medium">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-muted-foreground">
                            {user.email}
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">
                          {user.role}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  aria-label={`Actions for ${user.firstName} ${user.lastName}`}
                                  size="icon-sm"
                                  variant="ghost"
                                >
                                  <EllipsisIcon />
                                </Button>
                              }
                            />
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  setEditing({
                                    id: user.id,
                                    firstName: user.firstName,
                                    lastName: user.lastName,
                                    email: user.email,
                                    role: user.role,
                                    password: "",
                                  })
                                }
                              >
                                <PencilIcon /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  setDeletingUser({
                                    id: user.id,
                                    name: `${user.firstName} ${user.lastName}`,
                                  })
                                }
                                variant="destructive"
                              >
                                <Trash2Icon /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
              <AlertDialog
                onOpenChange={(open) => !open && setDeletingUser(null)}
                open={Boolean(deletingUser)}
              >
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Delete {deletingUser?.name}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      They will no longer be able to sign in.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={busy}
                      onClick={() => {
                        if (deletingUser) void removeUser(deletingUser.id)
                        setDeletingUser(null)
                      }}
                      variant="destructive"
                    >
                      Delete user
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </Card>
          </TabsContent>
        )}
        {data.isAdmin && (
          <TabsContent value="people">
            {activeTab === "people" && (
              <PeopleTab onSettingsChange={() => router.invalidate()} />
            )}
          </TabsContent>
        )}
      </Tabs>

      <Sheet
        onOpenChange={(open) => !open && setEditing(null)}
        open={Boolean(editing)}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editing?.id ? "Edit user" : "Add user"}</SheetTitle>
            <SheetDescription>
              Set this person’s account details and access role.
            </SheetDescription>
          </SheetHeader>
          {editing && (
            <form className="contents" onSubmit={submitUser}>
              <FieldGroup className="px-4">
                <Field>
                  <FieldLabel htmlFor="user-first-name">First name</FieldLabel>
                  <Input
                    id="user-first-name"
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        firstName: event.target.value,
                      })
                    }
                    required
                    value={editing.firstName}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="user-last-name">Last name</FieldLabel>
                  <Input
                    id="user-last-name"
                    onChange={(event) =>
                      setEditing({ ...editing, lastName: event.target.value })
                    }
                    required
                    value={editing.lastName}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="user-email">Email</FieldLabel>
                  <Input
                    id="user-email"
                    onChange={(event) =>
                      setEditing({ ...editing, email: event.target.value })
                    }
                    required
                    type="email"
                    value={editing.email}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="user-role">Role</FieldLabel>
                  <Select
                    onValueChange={(value) =>
                      setEditing({
                        ...editing,
                        role: value as UserForm["role"],
                      })
                    }
                    value={editing.role}
                  >
                    <SelectTrigger id="user-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="user-password">
                    {editing.id ? "New password" : "Password"}
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="user-password"
                      minLength={8}
                      onChange={(event) =>
                        setEditing({ ...editing, password: event.target.value })
                      }
                      placeholder={
                        editing.id
                          ? "Leave blank to keep current password"
                          : "At least 8 characters"
                      }
                      required={!editing.id}
                      type={isUserPasswordVisible ? "text" : "password"}
                      value={editing.password}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        aria-label={
                          isUserPasswordVisible
                            ? "Hide password"
                            : "Show password"
                        }
                        onClick={() =>
                          setIsUserPasswordVisible((visible) => !visible)
                        }
                        size="icon-xs"
                        type="button"
                        variant="ghost"
                      >
                        {isUserPasswordVisible ? <EyeOffIcon /> : <EyeIcon />}
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
              </FieldGroup>
              <SheetFooter>
                <Button disabled={busy} type="submit">
                  Save user
                </Button>
                <Button
                  onClick={() => setEditing(null)}
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
              </SheetFooter>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </main>
  )
}

function PeopleTab({
  onSettingsChange,
}: {
  onSettingsChange: () => Promise<void>
}) {
  const [people, setPeople] = useState<Awaited<ReturnType<typeof getPeople>>>()
  const [error, setError] = useState("")

  const loadPeople = useCallback(async () => {
    setError("")
    try {
      setPeople(await getPeople())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn’t load people.")
    }
  }, [])

  useEffect(() => {
    void loadPeople()
  }, [loadPeople])

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Authors</CardTitle>
          <CardDescription>
            Correct names, slugs, and duplicate authors.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!people) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Authors</CardTitle>
          <CardDescription>
            Correct names, slugs, and duplicate authors.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="text-right">Item count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 4 }, (_, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-4 w-8" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    )
  }

  return (
    <PeopleSettings
      people={people}
      onChange={async () => {
        await onSettingsChange()
        await loadPeople()
      }}
    />
  )
}

function SettingsPending() {
  return (
    <main className="container mx-auto max-w-4xl px-4 py-10">
      <p className="text-sm text-muted-foreground">Account</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Settings</h1>
      <Tabs className="mt-8" defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="lists">Lists</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Update your account details.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Setting</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 3 }, (_, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-48" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  )
}
