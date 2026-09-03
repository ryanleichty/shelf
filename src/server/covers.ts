import { put } from "@vercel/blob"

const MAX_COVER_BYTES = 10 * 1024 * 1024

export async function storeCover(remoteUrl: string, slug: string) {
  if (!remoteUrl || !process.env.BLOB_READ_WRITE_TOKEN) return remoteUrl
  try {
    // Imported here so node:net never reaches the client bundle.
    const { fetchRemoteImage, isBlobUrl } = await import("./remote-image")
    const source = new URL(remoteUrl)
    if (isBlobUrl(source)) return remoteUrl
    const image = await fetchRemoteImage(remoteUrl, {
      maxBytes: MAX_COVER_BYTES,
    })
    const extension =
      image.url.pathname
        .split(".")
        .pop()
        ?.replace(/[^a-z0-9]/gi, "") || "jpg"
    const blob = await put(`covers/${slug}.${extension}`, image.body, {
      access: "public",
      addRandomSuffix: true,
      contentType: image.contentType,
    })
    return blob.url
  } catch {
    return remoteUrl
  }
}
