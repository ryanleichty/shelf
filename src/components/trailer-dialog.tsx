"use client"

import { PlayIcon } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function TrailerDialog({
  title,
  trailerKey,
  showLabel = false,
}: {
  title: string
  trailerKey: string
  showLabel?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <Tooltip>
        <TooltipTrigger
          render={
            <DialogTrigger
              render={
                <Button
                  aria-label={showLabel ? undefined : "Trailer"}
                  size={showLabel ? "default" : "icon"}
                  variant="outline"
                >
                  <PlayIcon
                    data-icon={showLabel ? "inline-start" : undefined}
                  />
                  {showLabel && "Play trailer"}
                </Button>
              }
            />
          }
        />
        <TooltipContent>Trailer</TooltipContent>
      </Tooltip>
      <DialogContent className="gap-0 overflow-hidden bg-black p-0 sm:max-w-3xl">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {open && (
          <iframe
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="aspect-video w-full"
            referrerPolicy="strict-origin-when-cross-origin"
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailerKey)}?autoplay=1&mute=1&rel=0`}
            title={`${title} trailer`}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
