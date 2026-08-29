import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { getLoginMode, login } from "@/server/items"

export const Route = createFileRoute("/admin/login")({
  loader: () => getLoginMode(),
  component: Login,
})

function Login() {
  const { requiresEmail } = Route.useLoaderData()
  const router = useRouter()
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      const form = new FormData(event.currentTarget)
      const result = await login({
        data: {
          email: requiresEmail ? String(form.get("email")) : "",
          password: String(form.get("password")),
        },
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      await router.invalidate()
      await router.navigate({ to: "/admin" })
    } catch {
      setError("Couldn’t sign in. Try again.")
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="container mx-auto flex min-h-[calc(100vh-4rem)] max-w-sm items-center px-4">
      <form className="w-full rounded-lg border p-6" onSubmit={submit}>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to add and manage the shared collection.
        </p>
        <div className="mt-6 grid gap-6">
          {requiresEmail && (
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  autoComplete="email"
                  id="email"
                  name="email"
                  required
                  type="email"
                />
              </InputGroup>
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <InputGroup>
              <InputGroupInput
                autoFocus
                aria-invalid={Boolean(error)}
                autoComplete="current-password"
                id="password"
                name="password"
                required
                type={isPasswordVisible ? "text" : "password"}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label={
                    isPasswordVisible ? "Hide password" : "Show password"
                  }
                  onClick={() => setIsPasswordVisible((visible) => !visible)}
                  size="icon-xs"
                  type="button"
                  variant="ghost"
                >
                  {isPasswordVisible ? <EyeOffIcon /> : <EyeIcon />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </Field>
          <Button className="w-full" disabled={busy} type="submit">
            {busy ? "Logging in…" : "Login"}
          </Button>
        </div>
        {error && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </form>
    </main>
  )
}
