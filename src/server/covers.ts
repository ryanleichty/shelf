import { put } from "@vercel/blob"

const isBlobUrl = (url: URL) =>
  url.hostname.endsWith(".blob.vercel-storage.com")

export async function storeCover(remoteUrl: string, slug: string) {
  if (!remoteUrl || !process.env.BLOB_READ_WRITE_TOKEN) return remoteUrl
  try {
    const source = new URL(remoteUrl)
    if (!["http:", "https:"].includes(source.protocol) || isBlobUrl(source))
      return remoteUrl
    const response = await fetch(source, {
      headers: { "User-Agent": "Shelf (https://github.com/ryanleichty/shelf)" },
    })
    if (!response.ok || !response.body) return remoteUrl
    const extension =
      source.pathname
        .split(".")
        .pop()
        ?.replace(/[^a-z0-9]/gi, "") || "jpg"
    const blob = await put(`covers/${slug}.${extension}`, response.body, {
      access: "public",
      addRandomSuffix: true,
      contentType: response.headers.get("content-type") ?? "image/jpeg",
    })
    return blob.url
  } catch {
    return remoteUrl
  }
}
