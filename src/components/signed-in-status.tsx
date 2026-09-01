"use client"

import { createContext, useContext, useState } from "react"
import type { CurrentUser } from "@/server/auth"

type SignedInStatus = {
  signedIn: boolean
  setSignedIn: (signedIn: boolean) => void
  currentUser: CurrentUser | null
  setCurrentUser: (user: CurrentUser | null) => void
}

const SignedInStatusContext = createContext<SignedInStatus | null>(null)

export function SignedInStatusProvider({
  children,
  initialSignedIn,
  initialUser,
}: {
  children: React.ReactNode
  initialSignedIn: boolean
  initialUser: CurrentUser | null
}) {
  const [signedIn, setSignedIn] = useState(initialSignedIn)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(
    initialUser
  )

  return (
    <SignedInStatusContext
      value={{ signedIn, setSignedIn, currentUser, setCurrentUser }}
    >
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
