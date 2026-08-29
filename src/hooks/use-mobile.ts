import * as React from "react"

const MOBILE_BREAKPOINT = 768
const mobileQuery = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

export function useIsMobile() {
  return React.useSyncExternalStore(
    (onStoreChange) => {
      const mediaQuery = window.matchMedia(mobileQuery)
      mediaQuery.addEventListener("change", onStoreChange)
      return () => mediaQuery.removeEventListener("change", onStoreChange)
    },
    () => window.matchMedia(mobileQuery).matches,
    () => false
  )
}
