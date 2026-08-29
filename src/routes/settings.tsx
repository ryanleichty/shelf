import { useState } from "react"
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getSignedInStatus } from "@/server/items"
import { deleteUser, getSettings, saveProfile, saveUser } from "@/server/users"

export const Route = createFileRoute("/settings")({
  beforeLoad: async () => {
    if (!(await getSignedInStatus())) throw redirect({ to: "/admin/login" })
  },
  loader: () => getSettings(),
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
  const data = Route.useLoaderData()
  const router = useRouter()
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<UserForm | null>(null)

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

  async function removeUser(id: number, name: string) {
    if (
      !window.confirm(`Delete ${name}? They will no longer be able to sign in.`)
    )
      return
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

      <section className="mt-8 rounded-lg border p-6">
        <h2 className="text-lg font-semibold">Profile</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.bootstrap
            ? "Set up the first Shelf admin account."
            : "Update your account details."}
        </p>
        <form
          className="mt-6 grid gap-4 sm:grid-cols-2"
          onSubmit={submitProfile}
        >
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
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="password">
              {data.bootstrap ? "Password" : "New password"}
            </FieldLabel>
            <Input
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
              type="password"
            />
          </Field>
          <div className="sm:col-span-2">
            <Button disabled={busy} type="submit">
              Save profile
            </Button>
          </div>
        </form>
      </section>

      {data.isAdmin && (
        <section className="mt-6 rounded-lg border p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Users</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage who can access this shared shelf.
              </p>
            </div>
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
          </div>
          <div className="mt-6 divide-y border-y">
            {data.users.map((user) => (
              <div
                className="flex items-center justify-between gap-4 py-3"
                key={user.id}
              >
                <div>
                  <p className="font-medium">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {user.email} · {user.role}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
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
                    size="sm"
                    variant="outline"
                  >
                    Edit
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      removeUser(user.id, `${user.firstName} ${user.lastName}`)
                    }
                    size="sm"
                    variant="destructive"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {editing && (
            <form
              className="mt-6 grid gap-4 rounded-lg border p-4 sm:grid-cols-2"
              onSubmit={submitUser}
            >
              <Field>
                <FieldLabel htmlFor="user-first-name">First name</FieldLabel>
                <Input
                  id="user-first-name"
                  onChange={(event) =>
                    setEditing({ ...editing, firstName: event.target.value })
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
              <Field className="sm:col-span-2">
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
                    setEditing({ ...editing, role: value as UserForm["role"] })
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
                <Input
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
                  type="password"
                  value={editing.password}
                />
              </Field>
              <div className="flex gap-2 sm:col-span-2">
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
              </div>
            </form>
          )}
        </section>
      )}
    </main>
  )
}
