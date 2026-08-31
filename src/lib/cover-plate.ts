export function coverPlateBackground(slug: string): string {
  let hash = 2166136261

  for (const character of slug) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  }

  const hue = (hash >>> 0) % 360
  return `oklch(0.88 0.035 ${hue})`
}
