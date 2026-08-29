import * as React from "react"

export function useSyncExternalStoreWithSelector<Snapshot, Selection>(
  subscribe: (callback: () => void) => () => void,
  getSnapshot: () => Snapshot,
  getServerSnapshot: (() => Snapshot) | undefined,
  selector: (snapshot: Snapshot) => Selection,
  isEqual?: (a: Selection, b: Selection) => boolean
) {
  const [getSelection, getServerSelection] = React.useMemo(() => {
    let hasSelection = false
    let previousSnapshot: Snapshot
    let previousSelection: Selection

    const select = (snapshot: Snapshot) => {
      if (hasSelection && Object.is(previousSnapshot, snapshot)) {
        return previousSelection
      }

      const selection = selector(snapshot)
      if (hasSelection && isEqual?.(previousSelection, selection)) {
        previousSnapshot = snapshot
        return previousSelection
      }

      hasSelection = true
      previousSnapshot = snapshot
      previousSelection = selection
      return selection
    }

    return [
      () => select(getSnapshot()),
      getServerSnapshot ? () => select(getServerSnapshot()) : undefined,
    ]
  }, [getServerSnapshot, getSnapshot, isEqual, selector])

  return React.useSyncExternalStore(subscribe, getSelection, getServerSelection)
}
