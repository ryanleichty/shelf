import { isIP } from "node:net"

const MAX_REDIRECTS = 3
const TIMEOUT_MS = 10_000

export const isBlobUrl = (url: URL) =>
  url.hostname.endsWith(".blob.vercel-storage.com")

// Hosts that must never be fetched from the server: loopback, link-local,
// private ranges, and names that only resolve inside a network.
export function isDisallowedHost(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase()
  if (host === "localhost" || host.endsWith(".localhost")) return true
  if (host.endsWith(".local") || host.endsWith(".internal")) return true
  const version = isIP(host)
  if (version === 4) {
    const [a, b] = host.split(".").map(Number)
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    )
  }
  if (version === 6)
    return (
      host === "::" ||
      host === "::1" ||
      host.startsWith("fc") ||
      host.startsWith("fd") ||
      host.startsWith("fe80") ||
      host.startsWith("::ffff:")
    )
  return false
}

export class RemoteImageError extends Error {}

// Fetches an image over https from a public host, following at most a few
// redirects (re-checking each hop), with a timeout and a byte ceiling.
export async function fetchRemoteImage(
  input: string,
  { maxBytes }: { maxBytes: number }
): Promise<{ body: Blob; contentType: string; url: URL }> {
  let url = new URL(input)
  for (let hop = 0; ; hop++) {
    if (url.protocol !== "https:")
      throw new RemoteImageError("Image links must use https.")
    if (isDisallowedHost(url.hostname))
      throw new RemoteImageError("That host can’t be fetched.")
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": "Shelf (https://github.com/ryanleichty/shelf)" },
    })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location")
      if (!location || hop >= MAX_REDIRECTS)
        throw new RemoteImageError("Couldn’t download that image.")
      url = new URL(location, url)
      continue
    }
    if (!response.ok || !response.body)
      throw new RemoteImageError("Couldn’t download that image.")
    const contentType = response.headers.get("content-type") ?? ""
    if (!contentType.startsWith("image/"))
      throw new RemoteImageError("That link isn’t an image.")
    const declared = Number(response.headers.get("content-length") ?? 0)
    if (declared > maxBytes)
      throw new RemoteImageError("That image is too large.")
    const chunks: Uint8Array<ArrayBuffer>[] = []
    let received = 0
    for await (const chunk of response.body as AsyncIterable<
      Uint8Array<ArrayBuffer>
    >) {
      received += chunk.byteLength
      if (received > maxBytes)
        throw new RemoteImageError("That image is too large.")
      chunks.push(chunk)
    }
    return { body: new Blob(chunks, { type: contentType }), contentType, url }
  }
}
