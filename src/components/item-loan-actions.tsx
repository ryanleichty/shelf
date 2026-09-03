"use client"

import { useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getShelfMembers, lendItem, returnLoan } from "@/server/loans"

type ShelfMember = { id: number; firstName: string; lastName: string }

const someoneElseValue = "someone-else"

export function ItemLoanActions({
  itemId,
  hasOpenLoan,
  signedIn,
}: {
  itemId: number
  hasOpenLoan: boolean
  signedIn: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [members, setMembers] = useState<ShelfMember[]>([])
  const [borrowerChoice, setBorrowerChoice] = useState(someoneElseValue)
  const [borrowerName, setBorrowerName] = useState("")
  const [dueAt, setDueAt] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  if (!signedIn) return null

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setError("")
      setBorrowerChoice(someoneElseValue)
      setBorrowerName("")
      setDueAt("")
      getShelfMembers()
        .then(setMembers)
        .catch(() => setMembers([]))
    }
    setOpen(nextOpen)
  }

  async function lend() {
    setBusy(true)
    setError("")
    try {
      await lendItem({
        data: {
          itemId,
          borrowerUserId:
            borrowerChoice === someoneElseValue
              ? undefined
              : Number(borrowerChoice),
          borrowerName:
            borrowerChoice === someoneElseValue ? borrowerName : undefined,
          dueAt: dueAt || undefined,
        },
      })
      await router.invalidate()
      setOpen(false)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not lend this item."
      )
    } finally {
      setBusy(false)
    }
  }

  async function markReturned() {
    setBusy(true)
    setError("")
    try {
      await returnLoan({ data: { itemId } })
      await router.invalidate()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not mark this returned."
      )
    } finally {
      setBusy(false)
    }
  }

  if (hasOpenLoan) {
    return (
      <div className="flex flex-col items-end gap-2">
        <Button disabled={busy} onClick={markReturned} variant="outline">
          Mark returned
        </Button>
        {error && (
          <p className="text-right text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <>
      <Button onClick={() => handleOpenChange(true)} variant="outline">
        Lend
      </Button>
      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lend this item</DialogTitle>
            <DialogDescription>
              Record who has it and, optionally, when it is due back.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void lend()
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="loan-borrower">Borrower</FieldLabel>
                <Select
                  onValueChange={(value) =>
                    setBorrowerChoice(value ?? someoneElseValue)
                  }
                  value={borrowerChoice}
                >
                  <SelectTrigger id="loan-borrower">
                    <SelectValue placeholder="Someone else…" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={String(member.id)}>
                        {member.firstName} {member.lastName}
                      </SelectItem>
                    ))}
                    <SelectItem value={someoneElseValue}>
                      Someone else…
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {borrowerChoice === someoneElseValue && (
                <Field>
                  <FieldLabel htmlFor="loan-borrower-name">Name</FieldLabel>
                  <Input
                    id="loan-borrower-name"
                    onChange={(event) => setBorrowerName(event.target.value)}
                    required
                    value={borrowerName}
                  />
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="loan-due-at">Due date</FieldLabel>
                <Input
                  id="loan-due-at"
                  onChange={(event) => setDueAt(event.target.value)}
                  type="date"
                  value={dueAt}
                />
              </Field>
            </FieldGroup>
            {error && (
              <p className="mt-4 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <DialogFooter className="mt-4">
              <Button disabled={busy} type="submit">
                {busy ? "Lending…" : "Lend"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
