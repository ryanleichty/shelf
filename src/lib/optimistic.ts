// Whether a freshly loaded server value should replace local state while an
// optimistic override may still be in flight. `override` is null once the
// server has confirmed the last toggle.
export function acceptServerValue<T>(override: T | null, incoming: T) {
  return override === null || incoming === override
}
