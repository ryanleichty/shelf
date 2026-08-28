import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { login } from "@/server/items"

export const Route = createFileRoute("/admin/login")({ component: Login })

function Login() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
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
        <p className="text-sm text-muted-foreground">Private index</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Welcome back.</h1>
        <p className="mt-2 text-sm text-muted-foreground">Enter the key to make changes to Shelf.</p>
        <label className="mt-6 grid gap-2 text-sm font-medium"><span>Password</span><Input autoFocus name="password" required type="password" /></label>
        {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
        <Button disabled={busy} type="submit">{busy ? "Opening…" : "Open Shelf"}</Button>
      </form>
    </main>
  )
}
