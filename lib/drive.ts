export interface DriveFile {
  id: string
  name: string
  mimeType: string
  webViewLink: string
  iconLink: string
  modifiedTime: string
  size?: string
}

const MIME_LABELS: Record<string, string> = {
  "application/vnd.google-apps.folder": "Folder",
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
  "application/vnd.google-apps.document": "Google Doc",
  "application/vnd.google-apps.presentation": "Google Slides",
  "application/vnd.google-apps.spreadsheet": "Google Sheets",
  "video/mp4": "Video",
  "audio/mpeg": "Audio",
  "audio/mp3": "Audio",
  "image/jpeg": "Image",
  "image/png": "Image",
}

export function mimeLabel(mimeType: string): string {
  return MIME_LABELS[mimeType] ?? "File"
}

export function isFolder(mimeType: string): boolean {
  return mimeType === "application/vnd.google-apps.folder"
}

export function formatSize(bytes?: string): string {
  if (!bytes) return ""
  const n = parseInt(bytes, 10)
  if (isNaN(n)) return ""
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export async function getDriveFiles(
  folderId: string,
  resourceKey?: string
): Promise<DriveFile[]> {
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) return []

  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`)
  const fields = encodeURIComponent(
    "files(id,name,mimeType,webViewLink,iconLink,modifiedTime,size)"
  )

  const headers: HeadersInit = { "Content-Type": "application/json" }
  if (resourceKey) {
    headers["X-Goog-Drive-Resource-Keys"] = `${folderId}/${resourceKey}`
  }

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&key=${apiKey}&fields=${fields}&orderBy=folder,name`,
    { headers, next: { revalidate: process.env.NODE_ENV === "development" ? 0 : 3600 } }
  )

  if (!res.ok) return []

  const data = await res.json()
  return (data.files as DriveFile[]) ?? []
}
