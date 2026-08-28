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
    <main className="login-page">
      <form className="login-form" onSubmit={submit}>
        <p className="eyebrow">Private index</p>
        <h1>Welcome back.</h1>
        <p>Enter the key to make changes to Shelf.</p>
        <label className="field"><span>Password</span><Input autoFocus name="password" required type="password" /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button disabled={busy} type="submit">{busy ? "Opening…" : "Open Shelf"}</Button>
      </form>
    </main>
  )
}
