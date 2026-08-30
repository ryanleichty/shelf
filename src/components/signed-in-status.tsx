"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { getSignedInStatus } from "@/server/items"

type SignedInStatus = {
  signedIn: boolean | null
  setSignedIn: (signedIn: boolean) => void
}

const SignedInStatusContext = createContext<SignedInStatus | null>(null)

export function SignedInStatusProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null)

  useEffect(() => {
    getSignedInStatus()
      .then(setSignedIn)
      .catch(() => setSignedIn(false))
  }, [])

  return (
    <SignedInStatusContext value={{ signedIn, setSignedIn }}>
      {children}
    </SignedInStatusContext>
  )
}

export function useSignedInStatus() {
  const status = useContext(SignedInStatusContext)
  if (!status)
    throw new Error(
      "useSignedInStatus must be used inside SignedInStatusProvider."
    )
  return status
}
