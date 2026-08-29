import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { login } from "@/server/items"

export const Route = createFileRoute("/admin/login")({ component: Login })

function Login() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError("")
    const password = new FormData(event.currentTarget).get("password")
    const result = await login({ data: { password: String(password) } })
    if (!result.ok) {
      setError(result.error)
      setBusy(false)
      return
    }
    await router.navigate({ to: "/admin" })
  }
  return (
    <main className="container mx-auto flex min-h-[calc(100vh-4rem)] max-w-sm items-center px-4">
      <form className="w-full rounded-lg border p-6" onSubmit={submit}>
        <p className="text-sm text-muted-foreground">Admin</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Welcome back
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your password to edit the catalog.
        </p>
        <div className="mt-6 grid gap-6">
          <label className="grid gap-2 text-sm font-medium">
            <span>Password</span>
            <InputGroup>
              <InputGroupInput
                autoFocus
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
          </label>
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
